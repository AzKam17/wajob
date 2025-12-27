import { describe, it, expect, beforeEach, afterEach } from 'bun:test'
import Redis from 'ioredis'
import { ConversationStateService } from '@/services/conversation-state.service'

describe('ConversationStateService', () => {
  let redis: Redis
  let conversationState: ConversationStateService
  const testPhoneNumber = '+1234567890'

  beforeEach(() => {
    redis = new Redis({
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379'),
      password: process.env.REDIS_PASSWORD,
      db: 1, // Use different database for tests
    })

    conversationState = new ConversationStateService(redis)
  })

  afterEach(async () => {
    await conversationState.clearSession(testPhoneNumber)
    await redis.quit()
  })

  describe('Session Management', () => {
    it('should create a new session for first-time user', async () => {
      const session = await conversationState.loadOrCreateSession(testPhoneNumber)

      expect(session.sessionId).toBeDefined()
      expect(session.phoneNumber).toBe(testPhoneNumber)
      expect(session.currentState).toBe('idle')
      expect(session.context.phoneNumber).toBe(testPhoneNumber)
    })

    it('should load existing session for returning user', async () => {
      const session1 = await conversationState.loadOrCreateSession(testPhoneNumber)
      const sessionId1 = session1.sessionId

      const session2 = await conversationState.loadOrCreateSession(testPhoneNumber)
      const sessionId2 = session2.sessionId

      expect(sessionId1).toBe(sessionId2)
    })

    it('should create new session if existing session is stale (> 1 hour)', async () => {
      const session1 = await conversationState.loadOrCreateSession(testPhoneNumber)

      // Manually update session to be stale
      const key = `conversation:session:${testPhoneNumber}`
      await redis.hset(key, 'lastMessageAt', (Date.now() - 61 * 60 * 1000).toString())

      const session2 = await conversationState.loadOrCreateSession(testPhoneNumber)

      expect(session1.sessionId).not.toBe(session2.sessionId)
      expect(session2.currentState).toBe('idle')
    })
  })

  describe('Message Handling', () => {
    it('should transition from idle to welcomed on first message', async () => {
      const result = await conversationState.handleMessage(testPhoneNumber, 'Hello')

      expect(result.state).toBe('welcomed')
      expect(result.shouldSendWelcome).toBe(true)
    })

    it('should NOT send welcome if already sent in session', async () => {
      // First message
      await conversationState.handleMessage(testPhoneNumber, 'Hello')
      await conversationState.markWelcomeSent(testPhoneNumber)

      // Second message
      const result = await conversationState.handleMessage(testPhoneNumber, 'Another message')

      expect(result.shouldSendWelcome).toBe(false)
    })

    it('should update context with message timestamp', async () => {
      const before = Date.now()
      await conversationState.handleMessage(testPhoneNumber, 'Hello')
      const after = Date.now()

      const context = await conversationState.getContext(testPhoneNumber)

      expect(context.lastMessageAt).toBeGreaterThanOrEqual(before)
      expect(context.lastMessageAt).toBeLessThanOrEqual(after)
    })

    it('should handle ice breaker messages correctly', async () => {
      await conversationState.handleMessage(testPhoneNumber, 'Hello')
      await conversationState.markWelcomeSent(testPhoneNumber)

      const result = await conversationState.handleMessage(testPhoneNumber, 'bonjour')

      expect(result.state).toBe('awaitingJobTitle')
    })

    it('should transition to searchingJobs on job query', async () => {
      await conversationState.handleMessage(testPhoneNumber, 'Hello')
      await conversationState.markWelcomeSent(testPhoneNumber)

      const result = await conversationState.handleMessage(testPhoneNumber, 'software engineer')

      expect(result.state).toBe('searchingJobs')
    })
  })

  describe('Welcome Message Flow', () => {
    it('should mark welcome as sent with timestamp', async () => {
      await conversationState.handleMessage(testPhoneNumber, 'Hello')

      const before = Date.now()
      await conversationState.markWelcomeSent(testPhoneNumber)
      const after = Date.now()

      const context = await conversationState.getContext(testPhoneNumber)

      expect(context.welcomeSentAt).toBeDefined()
      expect(context.welcomeSentAt!).toBeGreaterThanOrEqual(before)
      expect(context.welcomeSentAt!).toBeLessThanOrEqual(after)
    })

    it('should transition to awaitingJobTitle after welcome sent', async () => {
      await conversationState.handleMessage(testPhoneNumber, 'Hello')
      await conversationState.markWelcomeSent(testPhoneNumber)

      const state = await conversationState.getCurrentState(testPhoneNumber)

      expect(state).toBe('awaitingJobTitle')
    })
  })

  describe('Search Completion', () => {
    it('should store search context on completion', async () => {
      await conversationState.handleMessage(testPhoneNumber, 'Hello')
      await conversationState.markWelcomeSent(testPhoneNumber)
      await conversationState.handleMessage(testPhoneNumber, 'developer')

      await conversationState.markSearchCompleted(testPhoneNumber, 'developer', 0)

      const context = await conversationState.getContext(testPhoneNumber)

      expect(context.lastQuery).toBe('developer')
      expect(context.lastOffset).toBe(0)
    })

    it('should transition to displayingResults after search completed', async () => {
      await conversationState.handleMessage(testPhoneNumber, 'Hello')
      await conversationState.markWelcomeSent(testPhoneNumber)
      await conversationState.handleMessage(testPhoneNumber, 'developer')

      await conversationState.markSearchCompleted(testPhoneNumber, 'developer', 0)

      const state = await conversationState.getCurrentState(testPhoneNumber)

      expect(state).toBe('displayingResults')
    })
  })

  describe('Pagination', () => {
    beforeEach(async () => {
      await conversationState.handleMessage(testPhoneNumber, 'Hello')
      await conversationState.markWelcomeSent(testPhoneNumber)
      await conversationState.handleMessage(testPhoneNumber, 'developer')
      await conversationState.markSearchCompleted(testPhoneNumber, 'developer', 0)
    })

    it('should handle pagination request', async () => {
      await conversationState.handleMessage(testPhoneNumber, 'voir plus')

      const state = await conversationState.getCurrentState(testPhoneNumber)

      expect(state).toBe('browsing')
    })

    it('should update offset on pagination', async () => {
      await conversationState.handleMessage(testPhoneNumber, 'voir plus')
      await conversationState.markPaginationRequested(testPhoneNumber, 3)

      const context = await conversationState.getContext(testPhoneNumber)

      expect(context.lastOffset).toBe(3)
    })

    it('should support multiple pagination requests', async () => {
      await conversationState.handleMessage(testPhoneNumber, 'voir plus')
      await conversationState.markPaginationRequested(testPhoneNumber, 3)

      await conversationState.markPaginationRequested(testPhoneNumber, 6)

      const context = await conversationState.getContext(testPhoneNumber)

      expect(context.lastOffset).toBe(6)
    })
  })

  describe('Session Persistence', () => {
    it('should persist state to Redis', async () => {
      await conversationState.handleMessage(testPhoneNumber, 'Hello')

      const key = `conversation:session:${testPhoneNumber}`
      const exists = await redis.exists(key)

      expect(exists).toBe(1)
    })

    it('should persist context correctly', async () => {
      await conversationState.handleMessage(testPhoneNumber, 'Hello')
      await conversationState.markWelcomeSent(testPhoneNumber)

      const key = `conversation:session:${testPhoneNumber}`
      const contextStr = await redis.hget(key, 'context')

      expect(contextStr).toBeDefined()

      const context = JSON.parse(contextStr!)

      expect(context.phoneNumber).toBe(testPhoneNumber)
      expect(context.welcomeSentAt).toBeDefined()
    })

    it('should set TTL on session', async () => {
      await conversationState.handleMessage(testPhoneNumber, 'Hello')

      const key = `conversation:session:${testPhoneNumber}`
      const ttl = await redis.ttl(key)

      expect(ttl).toBeGreaterThan(0)
      expect(ttl).toBeLessThanOrEqual(3600) // 1 hour
    })

    it('should restore actor from persisted state', async () => {
      await conversationState.handleMessage(testPhoneNumber, 'Hello')
      await conversationState.markWelcomeSent(testPhoneNumber)

      // Clear in-memory actor cache
      const newService = new ConversationStateService(redis)

      const state = await newService.getCurrentState(testPhoneNumber)
      const context = await newService.getContext(testPhoneNumber)

      expect(state).toBe('awaitingJobTitle')
      expect(context.welcomeSentAt).toBeDefined()
    })
  })

  describe('Session Clearing', () => {
    it('should clear session from Redis', async () => {
      await conversationState.handleMessage(testPhoneNumber, 'Hello')

      const key = `conversation:session:${testPhoneNumber}`
      let exists = await redis.exists(key)
      expect(exists).toBe(1)

      await conversationState.clearSession(testPhoneNumber)

      exists = await redis.exists(key)
      expect(exists).toBe(0)
    })

    it('should clear in-memory actor', async () => {
      await conversationState.handleMessage(testPhoneNumber, 'Hello')
      await conversationState.clearSession(testPhoneNumber)

      // After clearing, next message should start fresh
      const result = await conversationState.handleMessage(testPhoneNumber, 'Hello again')

      expect(result.state).toBe('welcomed')
      expect(result.shouldSendWelcome).toBe(true)
    })
  })

  describe('getCurrentState', () => {
    it('should return current state', async () => {
      await conversationState.handleMessage(testPhoneNumber, 'Hello')

      const state = await conversationState.getCurrentState(testPhoneNumber)

      expect(state).toBe('welcomed')
    })

    it('should return idle for new user', async () => {
      const state = await conversationState.getCurrentState(testPhoneNumber)

      expect(state).toBe('idle')
    })
  })

  describe('getSessionId', () => {
    it('should return session ID', async () => {
      const sessionId = await conversationState.getSessionId(testPhoneNumber)

      expect(sessionId).toBeDefined()
      expect(typeof sessionId).toBe('string')
    })

    it('should return same session ID for same user', async () => {
      const sessionId1 = await conversationState.getSessionId(testPhoneNumber)
      const sessionId2 = await conversationState.getSessionId(testPhoneNumber)

      expect(sessionId1).toBe(sessionId2)
    })
  })

  describe('getContext', () => {
    it('should return conversation context', async () => {
      await conversationState.handleMessage(testPhoneNumber, 'Hello')
      await conversationState.markWelcomeSent(testPhoneNumber)

      const context = await conversationState.getContext(testPhoneNumber)

      expect(context.phoneNumber).toBe(testPhoneNumber)
      expect(context.sessionId).toBeDefined()
      expect(context.welcomeSentAt).toBeDefined()
    })
  })

  describe('Multiple Users', () => {
    const user1 = '+1111111111'
    const user2 = '+2222222222'

    afterEach(async () => {
      await conversationState.clearSession(user1)
      await conversationState.clearSession(user2)
    })

    it('should maintain separate states for different users', async () => {
      await conversationState.handleMessage(user1, 'Hello')
      await conversationState.markWelcomeSent(user1)
      await conversationState.handleMessage(user1, 'developer')

      await conversationState.handleMessage(user2, 'Hi')

      const state1 = await conversationState.getCurrentState(user1)
      const state2 = await conversationState.getCurrentState(user2)

      expect(state1).toBe('searchingJobs')
      expect(state2).toBe('welcomed')
    })

    it('should maintain separate contexts for different users', async () => {
      await conversationState.handleMessage(user1, 'Hello')
      await conversationState.markWelcomeSent(user1)
      await conversationState.handleMessage(user1, 'developer')
      await conversationState.markSearchCompleted(user1, 'developer', 0)

      await conversationState.handleMessage(user2, 'Hi')
      await conversationState.markWelcomeSent(user2)
      await conversationState.handleMessage(user2, 'designer')
      await conversationState.markSearchCompleted(user2, 'designer', 0)

      const context1 = await conversationState.getContext(user1)
      const context2 = await conversationState.getContext(user2)

      expect(context1.lastQuery).toBe('developer')
      expect(context2.lastQuery).toBe('designer')
    })
  })

  describe('Actor Cleanup', () => {
    it('should cleanup inactive actors', async () => {
      await conversationState.handleMessage(testPhoneNumber, 'Hello')

      // Manually set lastMessageAt to > 1 hour ago in the actor
      const key = `conversation:session:${testPhoneNumber}`
      await redis.hset(key, 'lastMessageAt', (Date.now() - 61 * 60 * 1000).toString())

      conversationState.cleanupInactiveActors()

      // The actor should be removed from memory
      // Next message should create a new session
      const result = await conversationState.handleMessage(testPhoneNumber, 'Hello again')

      expect(result.state).toBe('welcomed')
      expect(result.shouldSendWelcome).toBe(true)
    })
  })

  describe('Error Handling', () => {
    it('should handle corrupted session data gracefully', async () => {
      const key = `conversation:session:${testPhoneNumber}`
      await redis.hset(key, 'context', 'invalid-json')

      // Should create new session instead of crashing
      const session = await conversationState.loadOrCreateSession(testPhoneNumber)

      expect(session.currentState).toBe('idle')
    })
  })
})
