import { WhatsAppWebhookPayload } from '@microfox/whatsapp-business'
import { BotUserRepository } from '../db/repositories/BotUserRepository'
import { BotMessages } from './bot-messages.service'
import { JobSearchService } from './job-search.service'
import { Logger } from '../utils/logger'
import { ConversationStateService } from './conversation-state.service'
import { ChatHistoryService } from './chat-history.service'

/**
 * Context object passed to state handlers
 */
interface MessageContext {
  from: string
  messageText: string
  sessionId: string
  state: string
  context: any
  shouldSendWelcome: boolean
  existingUser: any
  contactName: string
}

/**
 * State handler function type
 */
type StateHandler = (ctx: MessageContext) => Promise<void>

export class WhatsAppMessageService {
  private botMessages = new BotMessages()
  private botUserRepo = new BotUserRepository()
  private jobSearch = new JobSearchService()

  // Track processed message IDs to prevent duplicate processing
  private processedMessages = new Set<string>()
  private readonly MAX_PROCESSED_CACHE = 1000

  /**
   * Table-Driven Pattern: Command Map for state handling
   * Maps conversation states to their respective handler functions
   */
  private readonly stateHandlers: Map<string, StateHandler> = new Map([
    ['idle', this.handleIdleState.bind(this)],
    ['welcomed', this.handleWelcomedState.bind(this)],
    ['awaitingJobTitle', this.handleAwaitingJobTitleState.bind(this)],
    ['searchingJobs', this.handleJobSearchState.bind(this)],
    ['displayingResults', this.handleJobSearchState.bind(this)],
    ['browsing', this.handleJobSearchState.bind(this)],
  ])

  constructor(
    private readonly conversationState: ConversationStateService,
    private readonly chatHistory: ChatHistoryService
  ) {}

  async handleIncomingMessage(payload: WhatsAppWebhookPayload): Promise<void> {
    try {
      Logger.info('Webhook received', {
        entriesCount: payload.entry.length,
        changesCount: payload.entry.reduce((acc, e) => acc + e.changes.length, 0),
        messagesCount: payload.entry.reduce((acc, e) =>
          acc + e.changes.reduce((acc2, c) => acc2 + (c.value.messages?.length || 0), 0), 0
        )
      })

      for (const entry of payload.entry) {
        for (const change of entry.changes) {
          const { messages, contacts } = change.value

          if (!messages || messages.length === 0) {
            Logger.debug('No messages in webhook payload')
            continue
          }

          for (const message of messages) {
            const from = message.from
            const messageId = message.id
            const contactName = contacts?.[0]?.profile?.name || 'User'

            // Check if we've already processed this message
            if (this.processedMessages.has(messageId)) {
              Logger.warn('Duplicate message detected, skipping', { messageId, from })
              continue
            }

            // Add to processed set
            this.processedMessages.add(messageId)

            // Limit cache size to prevent memory issues
            if (this.processedMessages.size > this.MAX_PROCESSED_CACHE) {
              const firstItem = this.processedMessages.values().next().value
              if (firstItem) {
                this.processedMessages.delete(firstItem)
              }
            }

            Logger.info('Processing incoming message', {
              from,
              messageId,
              contactName,
              type: message.type
            })

            // Handle non-text messages (image, audio, video, etc.)
            if (message.type !== 'text') {
              Logger.info('Received non-text message, sending unsupported media response', {
                type: message.type,
                from
              })

              // Send typing indicator first
              await this.botMessages.sendTypingIndicator(messageId)

              // Send unsupported media message
              await this.botMessages.sendUnsupportedMediaMessage(from, message.type)

              // Get session ID for chat history
              const sessionId = await this.conversationState.getSessionId(from)

              // Save to chat history
              await this.chatHistory.saveIncomingMessage(
                from,
                sessionId,
                `[${message.type} message - not supported]`,
                'browsing'
              )
              await this.chatHistory.saveOutgoingTextMessage(
                from,
                sessionId,
                'Unsupported media type response',
                'browsing'
              )

              continue
            }

            // Send typing indicator (also marks as read automatically)
            await this.botMessages.sendTypingIndicator(messageId)

            const messageText = message.text.body.trim()

            // Get session ID for chat history
            const sessionId = await this.conversationState.getSessionId(from)

            // Handle message through XState machine
            const { state, context, shouldSendWelcome } = await this.conversationState.handleMessage(
              from,
              messageText
            )

            Logger.info('Conversation state after message', {
              from,
              state,
              context,
              shouldSendWelcome,
            })

            // Save incoming message to chat history
            await this.chatHistory.saveIncomingMessage(from, sessionId, messageText, state)

            // Check if this is the first message from this user
            const existingUser = await this.botUserRepo.findByPhoneNumber(from)

            // Create user if doesn't exist
            if (!existingUser) {
              await this.botUserRepo.create({
                phoneNumber: from,
                preferences: {},
                lastMessageAt: new Date(),
              })
            } else {
              // Update last message time
              await this.botUserRepo.update(existingUser.id, {
                lastMessageAt: new Date(),
              })
            }

            // Table-driven dispatch: Look up and execute the appropriate state handler
            const handler = this.stateHandlers.get(state)
            if (handler) {
              await handler({
                from,
                messageText,
                sessionId,
                state,
                context,
                shouldSendWelcome,
                existingUser,
                contactName,
              })
            } else {
              Logger.warn('No handler found for state', { state, from })
            }
          }
        }
      }
    } catch (error) {
      Logger.error('Error handling incoming message', { error })
      throw error
    }
  }

  async verifyWebhook(mode: string, token: string, challenge: string): Promise<boolean> {
    const verifyToken = process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN || 'your-verify-token-here'

    if (mode === 'subscribe' && token === verifyToken) {
      Logger.success('Webhook verified successfully')
      return true
    }

    Logger.warn('Webhook verification failed', { mode, token })
    return false
  }

  /**
   * STATE HANDLERS - Table-Driven Pattern Implementation
   * Each function handles a specific conversation state
   */

  /**
   * Handle idle state - typically shouldn't execute actions here
   * as the welcome flow is triggered by shouldSendWelcome flag
   */
  private async handleIdleState(ctx: MessageContext): Promise<void> {
    if (ctx.shouldSendWelcome) {
      await this.sendWelcomeFlow(ctx)
    }
  }

  /**
   * Handle welcomed state - user just received welcome message
   */
  private async handleWelcomedState(ctx: MessageContext): Promise<void> {
    if (ctx.shouldSendWelcome) {
      await this.sendWelcomeFlow(ctx)
    }
  }

  /**
   * Handle awaiting job title state - user is expected to provide job title
   */
  private async handleAwaitingJobTitleState(ctx: MessageContext): Promise<void> {
    if (ctx.shouldSendWelcome) {
      await this.sendWelcomeFlow(ctx)
      return
    }

    // Check if conversation is moderately stale
    const lastMessageTime = ctx.existingUser?.lastMessageAt
      ? new Date(ctx.existingUser.lastMessageAt)
      : null
    const twoMinutesAgo = new Date(Date.now() - 2 * 60 * 1000)
    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000)

    const isModeratelyStale =
      lastMessageTime && lastMessageTime < twoMinutesAgo && lastMessageTime >= tenMinutesAgo

    if (isModeratelyStale) {
      Logger.info('Sending re-enter job title prompt', {
        from: ctx.from,
        reason: 'moderately_stale_conversation',
      })

      await this.botMessages.sendReenterJobTitlePrompt(ctx.from)
      await this.chatHistory.saveOutgoingTextMessage(
        ctx.from,
        ctx.sessionId,
        'Re-enter job title prompt',
        ctx.state
      )

      Logger.success('Re-enter prompt sent successfully', { to: ctx.from })
    }
  }

  /**
   * Handle job search states (searchingJobs, displayingResults, browsing)
   * Processes job queries and pagination requests
   */
  private async handleJobSearchState(ctx: MessageContext): Promise<void> {
    Logger.info('Processing job search', {
      from: ctx.from,
      state: ctx.state,
      messageText: ctx.messageText,
    })

    const isSeeMore = ctx.messageText.toLowerCase() === 'voir plus'
    let userQuery: string
    let offset: number = 0

    if (isSeeMore) {
      // Handle pagination request
      const result = await this.handlePaginationRequest(ctx)
      if (!result) return // Early exit if no previous query

      userQuery = result.query
      offset = result.offset
    } else {
      // Handle new search query
      userQuery = ctx.messageText
      offset = 0
      Logger.info('Processing new job search', { from: ctx.from, query: userQuery })
    }

    // Execute job search
    await this.executeJobSearch(ctx, userQuery, offset)
  }

  /**
   * HELPER FUNCTIONS - Extracted actions from state handlers
   */

  /**
   * Send welcome flow to user
   */
  private async sendWelcomeFlow(ctx: MessageContext): Promise<void> {
    Logger.info('Sending welcome flow', { from: ctx.from, state: ctx.state, contactName: ctx.contactName })

    await this.botMessages.sendWelcomeFlow(ctx.from, ctx.contactName)
    await this.chatHistory.saveOutgoingTemplateMessage(
      ctx.from,
      ctx.sessionId,
      'eska_job_title_prompt',
      'welcomed'
    )
    await this.conversationState.markWelcomeSent(ctx.from)
    await this.chatHistory.updateConversationMetadata(ctx.from, { welcomeSent: true })

    Logger.success('Welcome flow sent successfully', { to: ctx.from })
  }

  /**
   * Handle "voir plus" pagination request
   * Returns query and offset, or null if no previous query exists
   */
  private async handlePaginationRequest(
    ctx: MessageContext
  ): Promise<{ query: string; offset: number } | null> {
    const lastQuery = ctx.context.lastQuery
    const lastOffset = ctx.context.lastOffset || 0

    if (!lastQuery) {
      await this.botMessages.sendTextMessage(
        ctx.from,
        "Veuillez d'abord effectuer une recherche en m'indiquant le poste que vous recherchez! 💼"
      )
      await this.chatHistory.saveOutgoingTextMessage(
        ctx.from,
        ctx.sessionId,
        "Veuillez d'abord effectuer une recherche...",
        ctx.state
      )
      return null
    }

    const offset = lastOffset + 3
    await this.conversationState.markPaginationRequested(ctx.from, offset)

    Logger.info('Loading more results', { from: ctx.from, query: lastQuery, offset })

    return { query: lastQuery, offset }
  }

  /**
   * Execute job search and send results
   */
  private async executeJobSearch(
    ctx: MessageContext,
    userQuery: string,
    offset: number
  ): Promise<void> {
    const jobs = await this.jobSearch.searchJobs(userQuery, ctx.from, offset)

    Logger.info('Jobs retrieved from search', {
      from: ctx.from,
      query: userQuery,
      offset,
      count: jobs.length,
      jobs: jobs.map((j) => ({ title: j.title, linkId: j.linkId })),
    })

    if (jobs.length > 0) {
      await this.sendJobResults(ctx, jobs, userQuery, offset)
    } else {
      await this.handleNoJobsFound(ctx, userQuery, offset)
    }
  }

  /**
   * Send job results to user
   */
  private async sendJobResults(
    ctx: MessageContext,
    jobs: any[],
    userQuery: string,
    offset: number
  ): Promise<void> {
    await this.botMessages.sendMultipleJobOffers(ctx.from, jobs)
    await this.chatHistory.saveOutgoingInteractiveMessage(
      ctx.from,
      ctx.sessionId,
      'Job offers',
      jobs.map((j) => j.title),
      ctx.state,
      jobs.length
    )

    await this.conversationState.markSearchCompleted(ctx.from, userQuery, offset)
    await this.chatHistory.updateConversationMetadata(ctx.from, {
      jobOffersShownCount: jobs.length,
    })

    // Send "see more" prompt after 15 seconds
    setTimeout(() => {
      this.botMessages.sendSeeMorePrompt(ctx.from)
    }, 15_000)

    // Store query and offset for pagination (backwards compatibility)
    if (ctx.existingUser) {
      await this.botUserRepo.update(ctx.existingUser.id, {
        preferences: {
          ...ctx.existingUser.preferences,
          lastQuery: userQuery,
          lastOffset: offset,
        },
      })
    }
  }

  /**
   * Handle case when no jobs are found
   */
  private async handleNoJobsFound(
    ctx: MessageContext,
    userQuery: string,
    offset: number
  ): Promise<void> {
    if (offset > 0) {
      // No more results available for pagination
      const noMoreMessage =
        "Il n'y a plus d'offres disponibles pour cette recherche. 😔\n\nVous pouvez effectuer une nouvelle recherche! 🔍"

      await this.botMessages.sendTextMessage(ctx.from, noMoreMessage)
      await this.chatHistory.saveOutgoingTextMessage(ctx.from, ctx.sessionId, noMoreMessage, ctx.state)
    } else {
      // No exact matches on first page - try similar jobs
      await this.searchSimilarJobs(ctx, userQuery)
    }
  }

  /**
   * Search and send similar jobs when no exact matches found
   */
  private async searchSimilarJobs(ctx: MessageContext, userQuery: string): Promise<void> {
    const similarJobs = await this.jobSearch.searchSimilarJobs(userQuery, ctx.from, 0)

    if (similarJobs.length > 0) {
      await this.botMessages.sendNoExactMatchMessage(ctx.from)
      await this.botMessages.sendMultipleJobOffers(ctx.from, similarJobs)

      await this.chatHistory.saveOutgoingInteractiveMessage(
        ctx.from,
        ctx.sessionId,
        'Similar job offers',
        similarJobs.map((j) => j.title),
        ctx.state,
        similarJobs.length
      )

      await this.conversationState.markSearchCompleted(ctx.from, userQuery, 0)

      // Send "see more" prompt after 15 seconds
      setTimeout(() => {
        this.botMessages.sendSeeMorePrompt(ctx.from)
      }, 15_000)

      // Store query for pagination
      if (ctx.existingUser) {
        await this.botUserRepo.update(ctx.existingUser.id, {
          preferences: {
            ...ctx.existingUser.preferences,
            lastQuery: userQuery,
            lastOffset: 0,
          },
        })
      }
    } else {
      // No jobs at all
      await this.botMessages.sendNoJobsFoundMessage(ctx.from, userQuery, ctx.contactName)
      await this.chatHistory.saveOutgoingTextMessage(
        ctx.from,
        ctx.sessionId,
        'No jobs found for this search',
        ctx.state
      )
    }
  }
}
