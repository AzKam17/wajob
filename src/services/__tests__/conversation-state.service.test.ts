import { describe, test, expect, beforeEach, afterEach, mock } from 'bun:test'
import { Redis } from 'ioredis'
import { ConversationStateService } from '../conversation-state.service'

describe('ConversationStateService - Redis Token-based Conversation Detection', () => {
  let redis: Redis
  let service: ConversationStateService
  const testPhoneNumber = '1234567890'

  beforeEach(() => {
    // Create a real Redis instance (or use Redis mock if preferred)
    redis = new Redis({
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379'),
      db: 15, // Use separate DB for testing
    })
    service = new ConversationStateService(redis)
  })

  afterEach(async () => {
    // Cleanup: delete all test keys
    const keys = await redis.keys('conversation:*')
    if (keys.length > 0) {
      await redis.del(...keys)
    }
    await redis.quit()
  })

  describe('New Conversation Detection', () => {
    test('should create new conversation when no token exists', async () => {
      const result = await service.handleMessage(testPhoneNumber, 'Hello')

      expect(result.state).toBe('awaitingJobTitle')
      expect(result.shouldSendWelcome).toBe(true)
      expect(result.context.phoneNumber).toBe(testPhoneNumber)
      expect(result.context.sessionId).toBeTruthy()
    })

    test('should set Redis token with 20-minute TTL on new conversation', async () => {
      await service.handleMessage(testPhoneNumber, 'Hello')

      const tokenKey = `conversation:active:${testPhoneNumber}`
      const tokenValue = await redis.get(tokenKey)
      const ttl = await redis.ttl(tokenKey)

      expect(tokenValue).toBe('1')
      expect(ttl).toBeGreaterThan(1100) // Should be close to 1200 seconds (20 minutes)
      expect(ttl).toBeLessThanOrEqual(1200)
    })

    test('should send welcome message only once per session', async () => {
      const result1 = await service.handleMessage(testPhoneNumber, 'Hello')
      expect(result1.shouldSendWelcome).toBe(true)

      const result2 = await service.handleMessage(testPhoneNumber, 'Comptable')
      expect(result2.shouldSendWelcome).toBe(false)
    })
  })

  describe('Continuing Conversation', () => {
    test('should continue existing conversation when token exists', async () => {
      // First message creates conversation
      const result1 = await service.handleMessage(testPhoneNumber, 'Hello')
      const sessionId1 = result1.context.sessionId

      // Second message should continue same conversation
      const result2 = await service.handleMessage(testPhoneNumber, 'Comptable')
      const sessionId2 = result2.context.sessionId

      expect(sessionId1).toBe(sessionId2)
      expect(result2.shouldSendWelcome).toBe(false)
    })

    test('should reset token TTL on each message', async () => {
      const tokenKey = `conversation:active:${testPhoneNumber}`

      // First message
      await service.handleMessage(testPhoneNumber, 'Hello')
      const ttl1 = await redis.ttl(tokenKey)

      // Wait 2 seconds
      await new Promise((resolve) => setTimeout(resolve, 2000))

      // Second message should reset TTL
      await service.handleMessage(testPhoneNumber, 'Comptable')
      const ttl2 = await redis.ttl(tokenKey)

      expect(ttl2).toBeGreaterThan(ttl1)
      expect(ttl2).toBeGreaterThan(1100)
      expect(ttl2).toBeLessThanOrEqual(1200)
    })

    test('should preserve conversation context across messages', async () => {
      await service.handleMessage(testPhoneNumber, 'Hello')
      await service.handleMessage(testPhoneNumber, 'Comptable')

      const context = await service.getContext(testPhoneNumber)

      expect(context.phoneNumber).toBe(testPhoneNumber)
      expect(context.lastQuery).toBe('Comptable')
    })
  })

  describe('Stale Conversation Detection', () => {
    test('should create new conversation when token expires', async () => {
      // First conversation
      const result1 = await service.handleMessage(testPhoneNumber, 'Hello')
      const sessionId1 = result1.context.sessionId

      // Manually expire the token to simulate 20-minute timeout
      const tokenKey = `conversation:active:${testPhoneNumber}`
      await redis.del(tokenKey)

      // New message after token expiration should create new conversation
      const result2 = await service.handleMessage(testPhoneNumber, 'Hello again')
      const sessionId2 = result2.context.sessionId

      expect(sessionId2).not.toBe(sessionId1)
      expect(result2.shouldSendWelcome).toBe(true)
    })

    test('should send welcome message again after token expiration', async () => {
      // First conversation
      const result1 = await service.handleMessage(testPhoneNumber, 'Hello')
      expect(result1.shouldSendWelcome).toBe(true)

      // Manually expire the token
      const tokenKey = `conversation:active:${testPhoneNumber}`
      await redis.del(tokenKey)

      // New conversation should send welcome again
      const result2 = await service.handleMessage(testPhoneNumber, 'Hello')
      expect(result2.shouldSendWelcome).toBe(true)
    })
  })

  describe('State Transitions', () => {
    test('should transition from idle to awaitingJobTitle on first message', async () => {
      const result = await service.handleMessage(testPhoneNumber, 'Hello')

      expect(result.state).toBe('awaitingJobTitle')
    })

    test('should transition to searchingJobs when user sends job query', async () => {
      await service.handleMessage(testPhoneNumber, 'Hello')
      const result = await service.handleMessage(testPhoneNumber, 'Comptable')

      expect(result.state).toBe('searchingJobs')
      expect(result.context.lastQuery).toBe('Comptable')
    })

    test('should handle pagination request', async () => {
      await service.handleMessage(testPhoneNumber, 'Hello')
      await service.handleMessage(testPhoneNumber, 'Comptable')

      const result = await service.handleMessage(testPhoneNumber, 'voir plus')

      expect(result.state).toBe('browsing')
    })
  })

  describe('Multiple Conversations', () => {
    test('should handle multiple phone numbers independently', async () => {
      const phone1 = '1111111111'
      const phone2 = '2222222222'

      const result1 = await service.handleMessage(phone1, 'Hello')
      const result2 = await service.handleMessage(phone2, 'Hi')

      expect(result1.context.sessionId).not.toBe(result2.context.sessionId)
      expect(result1.context.phoneNumber).toBe(phone1)
      expect(result2.context.phoneNumber).toBe(phone2)
    })

    test('should maintain separate tokens for different phone numbers', async () => {
      const phone1 = '1111111111'
      const phone2 = '2222222222'

      await service.handleMessage(phone1, 'Hello')
      await service.handleMessage(phone2, 'Hi')

      const token1 = await redis.get(`conversation:active:${phone1}`)
      const token2 = await redis.get(`conversation:active:${phone2}`)

      expect(token1).toBe('1')
      expect(token2).toBe('1')
    })

    test('should not affect other conversations when one token expires', async () => {
      const phone1 = '1111111111'
      const phone2 = '2222222222'

      const result1 = await service.handleMessage(phone1, 'Hello')
      const sessionId1 = result1.context.sessionId

      await service.handleMessage(phone2, 'Hi')

      // Expire phone1's token
      await redis.del(`conversation:active:${phone1}`)

      // Phone2's conversation should continue
      const result2 = await service.handleMessage(phone2, 'Comptable')
      expect(result2.shouldSendWelcome).toBe(false)

      // Phone1's conversation should restart
      const result3 = await service.handleMessage(phone1, 'Hello again')
      expect(result3.shouldSendWelcome).toBe(true)
      expect(result3.context.sessionId).not.toBe(sessionId1)
    })
  })

  describe('Session Management', () => {
    test('should retrieve session ID correctly', async () => {
      await service.handleMessage(testPhoneNumber, 'Hello')
      const sessionId = await service.getSessionId(testPhoneNumber)

      expect(sessionId).toBeTruthy()
      expect(typeof sessionId).toBe('string')
    })

    test('should retrieve current state correctly', async () => {
      await service.handleMessage(testPhoneNumber, 'Hello')
      const state = await service.getCurrentState(testPhoneNumber)

      expect(state).toBe('awaitingJobTitle')
    })

    test('should clear session correctly', async () => {
      await service.handleMessage(testPhoneNumber, 'Hello')
      await service.clearSession(testPhoneNumber)

      const sessionKey = `conversation:session:${testPhoneNumber}`
      const session = await redis.hgetall(sessionKey)

      expect(Object.keys(session).length).toBe(0)
    })
  })

  describe('Full Conversation Flow', () => {
    test('should handle complete job search conversation flow', async () => {
      // Step 1: User initiates conversation
      const step1 = await service.handleMessage(testPhoneNumber, 'Bonjour')
      expect(step1.state).toBe('awaitingJobTitle')
      expect(step1.shouldSendWelcome).toBe(true)

      // Step 2: User sends job query
      const step2 = await service.handleMessage(testPhoneNumber, 'Comptable')
      expect(step2.state).toBe('searchingJobs')
      expect(step2.context.lastQuery).toBe('Comptable')
      expect(step2.shouldSendWelcome).toBe(false)

      // Step 3: User requests more results
      const step3 = await service.handleMessage(testPhoneNumber, 'voir plus')
      expect(step3.state).toBe('browsing')

      // Step 4: User sends new query
      const step4 = await service.handleMessage(testPhoneNumber, 'Chauffeur')
      expect(step4.state).toBe('searchingJobs')
      expect(step4.context.lastQuery).toBe('Chauffeur')

      // Verify same session throughout
      expect(step1.context.sessionId).toBe(step2.context.sessionId)
      expect(step2.context.sessionId).toBe(step3.context.sessionId)
      expect(step3.context.sessionId).toBe(step4.context.sessionId)
    })

    test('should handle conversation restart after 20-minute timeout', async () => {
      // First conversation
      const step1 = await service.handleMessage(testPhoneNumber, 'Hello')
      const sessionId1 = step1.context.sessionId

      await service.handleMessage(testPhoneNumber, 'Comptable')

      // Simulate 20-minute timeout
      await redis.del(`conversation:active:${testPhoneNumber}`)

      // User returns after timeout
      const step2 = await service.handleMessage(testPhoneNumber, 'Bonjour')
      const sessionId2 = step2.context.sessionId

      expect(sessionId2).not.toBe(sessionId1)
      expect(step2.shouldSendWelcome).toBe(true)
      expect(step2.state).toBe('awaitingJobTitle')
    })
  })

  describe('Edge Cases', () => {
    test('should handle empty messages', async () => {
      const result = await service.handleMessage(testPhoneNumber, '')

      expect(result.state).toBeTruthy()
      expect(result.context).toBeTruthy()
    })

    test('should handle rapid consecutive messages', async () => {
      const messages = ['Hello', 'Comptable', 'voir plus', 'Chauffeur']
      const results = []

      for (const message of messages) {
        const result = await service.handleMessage(testPhoneNumber, message)
        results.push(result)
      }

      // All should be part of same session
      const sessionIds = results.map((r) => r.context.sessionId)
      expect(new Set(sessionIds).size).toBe(1)

      // Token should exist and have valid TTL
      const tokenKey = `conversation:active:${testPhoneNumber}`
      const token = await redis.get(tokenKey)
      const ttl = await redis.ttl(tokenKey)

      expect(token).toBe('1')
      expect(ttl).toBeGreaterThan(1100)
    })

    test('should handle very long messages', async () => {
      const longMessage = 'Comptable '.repeat(100)
      const result = await service.handleMessage(testPhoneNumber, longMessage)

      expect(result.state).toBe('searchingJobs')
      expect(result.context.lastQuery).toBe(longMessage)
    })

    test('should handle special characters in messages', async () => {
      const specialMessage = "Comptable @#$%^&*() avec expérience en français 🔍"
      const result = await service.handleMessage(testPhoneNumber, specialMessage)

      expect(result.state).toBeTruthy()
      expect(result.context).toBeTruthy()
    })
  })

  describe('Token Key Format', () => {
    test('should use correct token key format', async () => {
      await service.handleMessage(testPhoneNumber, 'Hello')

      const expectedKey = `conversation:active:${testPhoneNumber}`
      const token = await redis.get(expectedKey)

      expect(token).toBe('1')
    })

    test('should use correct session key format', async () => {
      await service.handleMessage(testPhoneNumber, 'Hello')

      const expectedKey = `conversation:session:${testPhoneNumber}`
      const session = await redis.hgetall(expectedKey)

      expect(Object.keys(session).length).toBeGreaterThan(0)
      expect(session.phoneNumber).toBe(testPhoneNumber)
    })
  })
})
