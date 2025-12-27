import { describe, it, expect, beforeEach } from 'bun:test'
import { createActor } from 'xstate'
import { conversationMachine, type ConversationContext } from '@/machines/conversationMachine'

describe('Conversation State Machine', () => {
  let actor: ReturnType<typeof createActor<typeof conversationMachine>>
  let initialContext: ConversationContext

  beforeEach(() => {
    initialContext = {
      phoneNumber: '+1234567890',
      sessionId: 'test-session-123',
      lastMessageAt: Date.now(),
    }

    actor = createActor(conversationMachine, {
      input: initialContext,
    })
    actor.start()
  })

  describe('Initial State', () => {
    it('should start in idle state', () => {
      expect(actor.getSnapshot().value).toBe('idle')
    })

    it('should have correct initial context', () => {
      const snapshot = actor.getSnapshot()
      expect(snapshot.context.phoneNumber).toBe('+1234567890')
      expect(snapshot.context.sessionId).toBe('test-session-123')
      expect(snapshot.context.welcomeSentAt).toBeUndefined()
    })
  })

  describe('Welcome Flow', () => {
    it('should transition from idle to welcomed on first USER_MESSAGE', () => {
      actor.send({
        type: 'USER_MESSAGE',
        message: 'Hello',
        timestamp: Date.now(),
      })

      expect(actor.getSnapshot().value).toBe('welcomed')
    })

    it('should transition to awaitingJobTitle after WELCOME_SENT', () => {
      actor.send({
        type: 'USER_MESSAGE',
        message: 'Hello',
        timestamp: Date.now(),
      })

      actor.send({
        type: 'WELCOME_SENT',
        timestamp: Date.now(),
      })

      expect(actor.getSnapshot().value).toBe('awaitingJobTitle')
    })

    it('should set welcomeSentAt timestamp when WELCOME_SENT', () => {
      const timestamp = Date.now()

      actor.send({
        type: 'USER_MESSAGE',
        message: 'Hello',
        timestamp,
      })

      actor.send({
        type: 'WELCOME_SENT',
        timestamp,
      })

      const snapshot = actor.getSnapshot()
      expect(snapshot.context.welcomeSentAt).toBeDefined()
      expect(snapshot.context.welcomeSentAt).toBe(timestamp)
    })

    it('should NOT send welcome again if welcomeSentAt is already set', () => {
      // First welcome flow
      actor.send({
        type: 'USER_MESSAGE',
        message: 'Hello',
        timestamp: Date.now(),
      })

      actor.send({
        type: 'WELCOME_SENT',
        timestamp: Date.now(),
      })

      expect(actor.getSnapshot().value).toBe('awaitingJobTitle')

      // Simulate timeout to idle
      actor.send({ type: 'TIMEOUT' })
      expect(actor.getSnapshot().value).toBe('idle')

      // Context should be reset after timeout
      expect(actor.getSnapshot().context.welcomeSentAt).toBeUndefined()
    })

    it('should prevent welcome message loop by checking canSendWelcome guard', () => {
      // Create actor with welcomeSentAt already set
      const actorWithWelcomeSent = createActor(conversationMachine, {
        input: {
          ...initialContext,
          welcomeSentAt: Date.now(),
        },
      })
      actorWithWelcomeSent.start()

      actorWithWelcomeSent.send({
        type: 'USER_MESSAGE',
        message: 'Hello',
        timestamp: Date.now(),
      })

      // Should NOT go to welcomed state
      expect(actorWithWelcomeSent.getSnapshot().value).toBe('awaitingJobTitle')
    })
  })

  describe('Ice Breaker Messages', () => {
    beforeEach(() => {
      // Move to awaitingJobTitle state
      actor.send({
        type: 'USER_MESSAGE',
        message: 'Hello',
        timestamp: Date.now(),
      })
      actor.send({
        type: 'WELCOME_SENT',
        timestamp: Date.now(),
      })
    })

    it('should stay in awaitingJobTitle when ice breaker "bonjour" is sent', () => {
      actor.send({
        type: 'USER_MESSAGE',
        message: 'bonjour',
        timestamp: Date.now(),
      })

      expect(actor.getSnapshot().value).toBe('awaitingJobTitle')
    })

    it('should stay in awaitingJobTitle when ice breaker "je cherche un emploi" is sent', () => {
      actor.send({
        type: 'USER_MESSAGE',
        message: 'Je cherche un emploi',
        timestamp: Date.now(),
      })

      expect(actor.getSnapshot().value).toBe('awaitingJobTitle')
    })

    it('should recognize all ice breaker variations', () => {
      const iceBreakers = ['bonjour', 'salut', 'hey', 'emploi', 'travail', 'job']

      iceBreakers.forEach((message) => {
        const testActor = createActor(conversationMachine, {
          input: {
            ...initialContext,
            welcomeSentAt: Date.now(),
          },
        })
        testActor.start()

        testActor.send({
          type: 'USER_MESSAGE',
          message,
          timestamp: Date.now(),
        })

        expect(testActor.getSnapshot().value).toBe('awaitingJobTitle')
      })
    })
  })

  describe('Job Search Flow', () => {
    beforeEach(() => {
      // Move to awaitingJobTitle state
      actor.send({
        type: 'USER_MESSAGE',
        message: 'Hello',
        timestamp: Date.now(),
      })
      actor.send({
        type: 'WELCOME_SENT',
        timestamp: Date.now(),
      })
    })

    it('should transition to searchingJobs when user sends job query', () => {
      actor.send({
        type: 'USER_MESSAGE',
        message: 'software engineer',
        timestamp: Date.now(),
      })

      expect(actor.getSnapshot().value).toBe('searchingJobs')
    })

    it('should transition to displayingResults after SEARCH_COMPLETED', () => {
      actor.send({
        type: 'USER_MESSAGE',
        message: 'software engineer',
        timestamp: Date.now(),
      })

      actor.send({
        type: 'SEARCH_COMPLETED',
        query: 'software engineer',
        offset: 0,
      })

      expect(actor.getSnapshot().value).toBe('displayingResults')
    })

    it('should save search context (query and offset) on SEARCH_COMPLETED', () => {
      actor.send({
        type: 'USER_MESSAGE',
        message: 'software engineer',
        timestamp: Date.now(),
      })

      actor.send({
        type: 'SEARCH_COMPLETED',
        query: 'software engineer',
        offset: 0,
      })

      const snapshot = actor.getSnapshot()
      expect(snapshot.context.lastQuery).toBe('software engineer')
      expect(snapshot.context.lastOffset).toBe(0)
    })

    it('should allow starting new search from displayingResults', () => {
      actor.send({
        type: 'USER_MESSAGE',
        message: 'software engineer',
        timestamp: Date.now(),
      })

      actor.send({
        type: 'SEARCH_COMPLETED',
        query: 'software engineer',
        offset: 0,
      })

      // Start new search
      actor.send({
        type: 'USER_MESSAGE',
        message: 'product manager',
        timestamp: Date.now(),
      })

      expect(actor.getSnapshot().value).toBe('searchingJobs')
    })
  })

  describe('Pagination Flow', () => {
    beforeEach(() => {
      // Setup: Complete a search
      actor.send({
        type: 'USER_MESSAGE',
        message: 'Hello',
        timestamp: Date.now(),
      })
      actor.send({
        type: 'WELCOME_SENT',
        timestamp: Date.now(),
      })
      actor.send({
        type: 'USER_MESSAGE',
        message: 'developer',
        timestamp: Date.now(),
      })
      actor.send({
        type: 'SEARCH_COMPLETED',
        query: 'developer',
        offset: 0,
      })
    })

    it('should transition to browsing when user sends "voir plus"', () => {
      actor.send({
        type: 'USER_MESSAGE',
        message: 'voir plus',
        timestamp: Date.now(),
      })

      expect(actor.getSnapshot().value).toBe('browsing')
    })

    it('should recognize pagination request case-insensitively', () => {
      actor.send({
        type: 'USER_MESSAGE',
        message: 'VOIR PLUS',
        timestamp: Date.now(),
      })

      expect(actor.getSnapshot().value).toBe('browsing')
    })

    it('should recognize "plus" as pagination request', () => {
      actor.send({
        type: 'USER_MESSAGE',
        message: 'plus',
        timestamp: Date.now(),
      })

      expect(actor.getSnapshot().value).toBe('browsing')
    })

    it('should stay in browsing state on PAGINATION_REQUESTED', () => {
      actor.send({
        type: 'USER_MESSAGE',
        message: 'voir plus',
        timestamp: Date.now(),
      })

      actor.send({
        type: 'PAGINATION_REQUESTED',
        offset: 3,
      })

      expect(actor.getSnapshot().value).toBe('browsing')
    })

    it('should update offset on PAGINATION_REQUESTED', () => {
      actor.send({
        type: 'USER_MESSAGE',
        message: 'voir plus',
        timestamp: Date.now(),
      })

      actor.send({
        type: 'PAGINATION_REQUESTED',
        offset: 3,
      })

      expect(actor.getSnapshot().context.lastOffset).toBe(3)

      actor.send({
        type: 'PAGINATION_REQUESTED',
        offset: 6,
      })

      expect(actor.getSnapshot().context.lastOffset).toBe(6)
    })

    it('should allow starting new search from browsing state', () => {
      actor.send({
        type: 'USER_MESSAGE',
        message: 'voir plus',
        timestamp: Date.now(),
      })

      actor.send({
        type: 'USER_MESSAGE',
        message: 'designer',
        timestamp: Date.now(),
      })

      expect(actor.getSnapshot().value).toBe('searchingJobs')
    })
  })

  describe('Timeout and Reset', () => {
    it('should reset context on TIMEOUT', () => {
      actor.send({
        type: 'USER_MESSAGE',
        message: 'Hello',
        timestamp: Date.now(),
      })
      actor.send({
        type: 'WELCOME_SENT',
        timestamp: Date.now(),
      })
      actor.send({
        type: 'USER_MESSAGE',
        message: 'developer',
        timestamp: Date.now(),
      })
      actor.send({
        type: 'SEARCH_COMPLETED',
        query: 'developer',
        offset: 0,
      })

      // Context should have data
      expect(actor.getSnapshot().context.welcomeSentAt).toBeDefined()
      expect(actor.getSnapshot().context.lastQuery).toBe('developer')

      actor.send({ type: 'TIMEOUT' })

      // Context should be reset
      const snapshot = actor.getSnapshot()
      expect(snapshot.value).toBe('idle')
      expect(snapshot.context.welcomeSentAt).toBeUndefined()
      expect(snapshot.context.lastQuery).toBeUndefined()
      expect(snapshot.context.lastOffset).toBeUndefined()
    })

    it('should return to idle from awaitingJobTitle on TIMEOUT', () => {
      actor.send({
        type: 'USER_MESSAGE',
        message: 'Hello',
        timestamp: Date.now(),
      })
      actor.send({
        type: 'WELCOME_SENT',
        timestamp: Date.now(),
      })

      expect(actor.getSnapshot().value).toBe('awaitingJobTitle')

      actor.send({ type: 'TIMEOUT' })

      expect(actor.getSnapshot().value).toBe('idle')
    })

    it('should return to idle from displayingResults on TIMEOUT', () => {
      actor.send({
        type: 'USER_MESSAGE',
        message: 'Hello',
        timestamp: Date.now(),
      })
      actor.send({
        type: 'WELCOME_SENT',
        timestamp: Date.now(),
      })
      actor.send({
        type: 'USER_MESSAGE',
        message: 'developer',
        timestamp: Date.now(),
      })
      actor.send({
        type: 'SEARCH_COMPLETED',
        query: 'developer',
        offset: 0,
      })

      expect(actor.getSnapshot().value).toBe('displayingResults')

      actor.send({ type: 'TIMEOUT' })

      expect(actor.getSnapshot().value).toBe('idle')
    })

    it('should return to idle from browsing on TIMEOUT', () => {
      actor.send({
        type: 'USER_MESSAGE',
        message: 'Hello',
        timestamp: Date.now(),
      })
      actor.send({
        type: 'WELCOME_SENT',
        timestamp: Date.now(),
      })
      actor.send({
        type: 'USER_MESSAGE',
        message: 'developer',
        timestamp: Date.now(),
      })
      actor.send({
        type: 'SEARCH_COMPLETED',
        query: 'developer',
        offset: 0,
      })
      actor.send({
        type: 'USER_MESSAGE',
        message: 'voir plus',
        timestamp: Date.now(),
      })

      expect(actor.getSnapshot().value).toBe('browsing')

      actor.send({ type: 'TIMEOUT' })

      expect(actor.getSnapshot().value).toBe('idle')
    })
  })

  describe('Context Updates', () => {
    it('should update lastMessageAt on USER_MESSAGE events', () => {
      const timestamp1 = Date.now()
      actor.send({
        type: 'USER_MESSAGE',
        message: 'Hello',
        timestamp: timestamp1,
      })

      expect(actor.getSnapshot().context.lastMessageAt).toBe(timestamp1)

      const timestamp2 = Date.now() + 1000
      actor.send({
        type: 'WELCOME_SENT',
        timestamp: timestamp2,
      })
      actor.send({
        type: 'USER_MESSAGE',
        message: 'developer',
        timestamp: timestamp2,
      })

      expect(actor.getSnapshot().context.lastMessageAt).toBe(timestamp2)
    })
  })

  describe('Edge Cases', () => {
    it('should handle USER_MESSAGE in welcomed state before WELCOME_SENT', () => {
      actor.send({
        type: 'USER_MESSAGE',
        message: 'Hello',
        timestamp: Date.now(),
      })

      expect(actor.getSnapshot().value).toBe('welcomed')

      // User sends another message before welcome is sent
      actor.send({
        type: 'USER_MESSAGE',
        message: 'Are you there?',
        timestamp: Date.now(),
      })

      // Should move to awaitingJobTitle
      expect(actor.getSnapshot().value).toBe('awaitingJobTitle')
    })

    it('should handle USER_MESSAGE in searchingJobs state (user impatient)', () => {
      actor.send({
        type: 'USER_MESSAGE',
        message: 'Hello',
        timestamp: Date.now(),
      })
      actor.send({
        type: 'WELCOME_SENT',
        timestamp: Date.now(),
      })
      actor.send({
        type: 'USER_MESSAGE',
        message: 'developer',
        timestamp: Date.now(),
      })

      expect(actor.getSnapshot().value).toBe('searchingJobs')

      // User sends another message while search is running
      actor.send({
        type: 'USER_MESSAGE',
        message: 'still searching?',
        timestamp: Date.now(),
      })

      // Should stay in searchingJobs
      expect(actor.getSnapshot().value).toBe('searchingJobs')
    })
  })
})
