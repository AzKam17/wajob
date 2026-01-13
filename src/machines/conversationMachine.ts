import { assign, setup } from 'xstate'

/**
 * CONVERSATION STATE MACHINE
 * ==========================
 *
 * This XState machine manages the conversation flow for the WhatsApp job search bot.
 * It prevents the welcome message loop issue by explicitly tracking conversation states
 * and ensuring welcome messages are only sent once per session.
 *
 * STATES:
 * -------
 *
 * 1. idle (initial state)
 *    - First contact or session expired (> 30 minutes)
 *    - Ready to send welcome message on first USER_MESSAGE
 *    - Transitions: → welcomed (if canSendWelcome) OR → awaitingJobTitle
 *
 * 2. welcomed
 *    - Transitional state after deciding to send welcome
 *    - Waiting for WELCOME_SENT confirmation
 *    - Transitions: → awaitingJobTitle (on WELCOME_SENT or USER_MESSAGE)
 *
 * 3. awaitingJobTitle
 *    - Welcome message sent, waiting for user to provide job search query
 *    - Also used for moderately stale conversations (2-10 min)
 *    - Transitions: → searchingJobs (normal message) OR → browsing (pagination) OR → idle (timeout)
 *
 * 4. searchingJobs
 *    - Processing user's job search query
 *    - Fetching results from database
 *    - Transitions: → displayingResults (on SEARCH_COMPLETED)
 *
 * 5. displayingResults
 *    - Showing job results to user
 *    - User can start new search or paginate
 *    - Transitions: → searchingJobs (new query) OR → browsing (pagination) OR → idle (timeout)
 *
 * 6. browsing
 *    - User is paginating through results ("Voir plus")
 *    - Can continue paginating or start new search
 *    - Transitions: → browsing (more pagination) OR → searchingJobs (new query) OR → idle (timeout)
 *
 *
 * EVENTS:
 * -------
 *
 * 1. USER_MESSAGE { message: string, timestamp: number }
 *    - User sent a text message
 *    - Triggers state transitions based on current state and guards
 *
 * 2. WELCOME_SENT { timestamp: number }
 *    - Confirmation that welcome message was successfully sent
 *    - Moves from 'welcomed' → 'awaitingJobTitle'
 *    - Sets welcomeSentAt timestamp to prevent re-sending
 *
 * 3. SEARCH_COMPLETED { query: string, offset: number }
 *    - Job search finished executing
 *    - Stores search context for pagination
 *    - Moves from 'searchingJobs' → 'displayingResults'
 *
 * 4. PAGINATION_REQUESTED { offset: number }
 *    - User clicked "Voir plus" / pagination
 *    - Updates offset for next batch of results
 *
 * 5. TIMEOUT
 *    - Session expired (> 30 minutes of inactivity)
 *    - Resets conversation to idle state
 *
 * 6. RESET
 *    - Manual reset (future use)
 *
 *
 * GUARDS:
 * -------
 * Guards are conditions that must be true for a transition to occur.
 *
 * 1. canSendWelcome
 *    - Checks if welcomeSentAt is undefined
 *    - Prevents sending welcome message multiple times in same session
 *    - KEY SOLUTION to the welcome message loop problem
 *
 * 2. isStaleSession
 *    - Checks if lastMessageAt > 30 minutes ago
 *    - Used to determine if session should be reset
 *
 * 3. isPaginationRequest
 *    - Checks if message is "voir plus" or "plus" (case-insensitive)
 *    - Routes to pagination flow instead of new search
 *
 * 4. isIceBreaker
 *    - Checks if message matches predefined ice breaker phrases
 *    - Examples: "je cherche un emploi", "bonjour", "salut", "job"
 *    - Keeps user in awaitingJobTitle state instead of treating as search query
 *
 *
 * ACTIONS:
 * --------
 * Actions modify the context (state data) during transitions.
 * All actions use XState's `assign()` function for immutable updates.
 *
 * 1. updateLastMessageTime
 *    - Updates lastMessageAt to current timestamp
 *    - Extends session lifetime
 *    - Runs on most USER_MESSAGE events
 *
 * 2. markWelcomeSent
 *    - Sets welcomeSentAt to current timestamp
 *    - Critical for preventing welcome message loops
 *    - Only runs on WELCOME_SENT event
 *
 * 3. saveSearchContext
 *    - Stores lastQuery and lastOffset from SEARCH_COMPLETED event
 *    - Enables pagination functionality
 *    - User can request "Voir plus" to continue paginating
 *
 * 4. updatePaginationOffset
 *    - Updates lastOffset when user requests next page
 *    - Incremented by 3 (results per page)
 *
 * 5. resetContext
 *    - Clears welcomeSentAt, lastQuery, lastOffset
 *    - Runs on TIMEOUT events
 *    - Prepares for fresh conversation
 *
 *
 * CONTEXT:
 * --------
 * The context holds all stateful data for the conversation.
 *
 * - phoneNumber: User's WhatsApp number (identifier)
 * - sessionId: Unique UUID for this conversation session
 * - welcomeSentAt?: Timestamp when welcome was sent (undefined = not sent yet)
 * - lastMessageAt: Timestamp of last activity (for session expiry)
 * - lastQuery?: Last job search query (for pagination)
 * - lastOffset?: Current pagination offset (for "Voir plus")
 *
 *
 * PERSISTENCE:
 * ------------
 * This machine state is persisted to Redis via ConversationStateService:
 * - Key: conversation:session:{phoneNumber}
 * - TTL: 30 minutes
 * - Serialized: currentState + context as JSON
 * - On each message, state is loaded, transitioned, and saved back
 *
 *
 * HOW IT PREVENTS WELCOME MESSAGE LOOPS:
 * ---------------------------------------
 *
 * OLD BEHAVIOR (time-based):
 * - If lastMessageAt > 10 minutes → send welcome
 * - Problem: No memory of already sending welcome
 * - Result: Welcome sent repeatedly in same conversation
 *
 * NEW BEHAVIOR (state machine):
 * - Welcome only sent when transitioning idle → welcomed
 * - canSendWelcome guard checks: !context.welcomeSentAt
 * - Once welcomeSentAt is set, guard fails
 * - State cannot transition to 'welcomed' again in same session
 * - Result: Welcome sent exactly once per session
 *
 * Example flow:
 * 1. User sends first message → idle → welcomed (canSendWelcome = true)
 * 2. Welcome sent → WELCOME_SENT → awaitingJobTitle (welcomeSentAt now set)
 * 3. User sends another message → stays in awaitingJobTitle
 * 4. User goes idle 5 minutes → no state change
 * 5. User sends message → awaitingJobTitle → searchingJobs (NOT back to welcomed!)
 * 6. Session expires (30 minutes) → TIMEOUT → idle → resetContext (welcomeSentAt cleared)
 * 7. New session can now send welcome again
 */

export interface ConversationContext {
  phoneNumber: string
  sessionId: string
  welcomeSentAt?: number
  lastMessageAt: number
  lastQuery?: string
  lastOffset?: number
  latestRequestId?: string // Tracks the most recent search request ID
  pendingDebounceTimeout?: number // Tracks debounce timeout for cancellation
}

export type ConversationEvent =
  | { type: 'USER_MESSAGE'; message: string; timestamp: number }
  | { type: 'WELCOME_SENT'; timestamp: number }
  | { type: 'SEARCH_COMPLETED'; query: string; offset: number }
  | { type: 'PAGINATION_REQUESTED'; offset: number }
  | { type: 'TIMEOUT' }
  | { type: 'RESET' }

export const conversationMachine = setup({
  types: {
    context: {} as ConversationContext,
    events: {} as ConversationEvent,
    input: {} as ConversationContext,
  },
  guards: {
    canSendWelcome: ({ context }) => {
      // Don't send welcome if already sent in this session
      return !context.welcomeSentAt
    },
    isPaginationRequest: ({ event }) => {
      if (event.type !== 'USER_MESSAGE') return false
      const message = event.message.toLowerCase().trim()
      return message === 'voir plus' || message === 'plus'
    },
  },
  actions: {
    updateLastMessageTime: assign({
      lastMessageAt: ({ event }) => {
        if (event.type === 'USER_MESSAGE') {
          return event.timestamp
        }
        return Date.now()
      },
    }),
    markWelcomeSent: assign({
      welcomeSentAt: ({ event }) => {
        if (event.type === 'WELCOME_SENT') {
          return event.timestamp
        }
        return Date.now()
      },
    }),
    saveSearchContext: assign({
      lastQuery: ({ event }) => {
        if (event.type === 'SEARCH_COMPLETED') {
          return event.query
        }
        return undefined
      },
      lastOffset: ({ event }) => {
        if (event.type === 'SEARCH_COMPLETED') {
          return event.offset
        }
        return undefined
      },
    }),
    generateRequestId: assign({
      latestRequestId: () => `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    }),
    updatePaginationOffset: assign({
      lastOffset: ({ event }) => {
        if (event.type === 'PAGINATION_REQUESTED') {
          return event.offset
        }
        return undefined
      },
    }),
    resetContext: assign({
      welcomeSentAt: undefined,
      lastQuery: undefined,
      lastOffset: undefined,
      latestRequestId: undefined,
      pendingDebounceTimeout: undefined,
    }),
  },
}).createMachine({
  id: 'conversation',
  initial: 'idle',
  context: ({ input }) => input,
  states: {
    idle: {
      on: {
        USER_MESSAGE: [
          {
            guard: 'canSendWelcome',
            target: 'welcomed',
            actions: 'updateLastMessageTime',
          },
          {
            target: 'awaitingJobTitle',
            actions: 'updateLastMessageTime',
          },
        ],
        TIMEOUT: {
          target: 'idle',
          actions: 'resetContext',
        },
      },
    },
    welcomed: {
      on: {
        WELCOME_SENT: {
          target: 'awaitingJobTitle',
          actions: ['markWelcomeSent', 'updateLastMessageTime'],
        },
        USER_MESSAGE: {
          // If user messages before welcome completes, move to awaiting
          target: 'awaitingJobTitle',
          actions: 'updateLastMessageTime',
        },
      },
    },
    awaitingJobTitle: {
      on: {
        USER_MESSAGE: [
          {
            guard: 'isPaginationRequest',
            target: 'browsing',
            actions: 'updateLastMessageTime',
          },
          {
            target: 'searchingJobs',
            actions: 'updateLastMessageTime',
          },
        ],
        TIMEOUT: {
          target: 'idle',
          actions: 'resetContext',
        },
      },
    },
    searchingJobs: {
      on: {
        SEARCH_COMPLETED: {
          target: 'displayingResults',
          actions: ['saveSearchContext', 'updateLastMessageTime'],
        },
        USER_MESSAGE: {
          // User sent another message while searching
          target: 'searchingJobs',
          actions: 'updateLastMessageTime',
        },
      },
    },
    displayingResults: {
      on: {
        USER_MESSAGE: [
          {
            guard: 'isPaginationRequest',
            target: 'browsing',
            actions: 'updateLastMessageTime',
          },
          {
            // New search query
            target: 'searchingJobs',
            actions: 'updateLastMessageTime',
          },
        ],
        TIMEOUT: {
          target: 'idle',
          actions: 'resetContext',
        },
      },
    },
    browsing: {
      on: {
        PAGINATION_REQUESTED: {
          target: 'browsing',
          actions: ['updatePaginationOffset', 'updateLastMessageTime'],
        },
        USER_MESSAGE: [
          {
            guard: 'isPaginationRequest',
            target: 'browsing',
            actions: 'updateLastMessageTime',
          },
          {
            // New search query
            target: 'searchingJobs',
            actions: 'updateLastMessageTime',
          },
        ],
        TIMEOUT: {
          target: 'idle',
          actions: 'resetContext',
        },
      },
    },
  },
})

export type ConversationMachine = typeof conversationMachine
