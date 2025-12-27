import { describe, it, expect, beforeEach, afterEach } from 'bun:test'
import Redis from 'ioredis'
import { ChatHistoryService } from '@/services/chat-history.service'
import type { ChatMessage } from '@/models/ChatMessage'

describe('ChatHistoryService', () => {
  let redis: Redis
  let chatHistory: ChatHistoryService
  const testPhoneNumber = '+1234567890'
  const testSessionId = 'test-session-123'

  beforeEach(() => {
    // Create Redis client for testing
    redis = new Redis({
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379'),
      password: process.env.REDIS_PASSWORD,
      db: 1, // Use different database for tests
    })

    chatHistory = new ChatHistoryService(redis)
  })

  afterEach(async () => {
    // Clean up test data
    await chatHistory.clearHistory(testPhoneNumber)
    await redis.quit()
  })

  describe('saveMessage', () => {
    it('should save an incoming text message', async () => {
      const message = await chatHistory.saveIncomingMessage(
        testPhoneNumber,
        testSessionId,
        'Hello, I need a job',
        'awaitingJobTitle'
      )

      expect(message.id).toBeDefined()
      expect(message.sessionId).toBe(testSessionId)
      expect(message.phoneNumber).toBe(testPhoneNumber)
      expect(message.direction).toBe('incoming')
      expect(message.content.type).toBe('text')
      expect(message.content.text).toBe('Hello, I need a job')
      expect(message.metadata?.state).toBe('awaitingJobTitle')
    })

    it('should save an outgoing text message', async () => {
      const message = await chatHistory.saveOutgoingTextMessage(
        testPhoneNumber,
        testSessionId,
        'What job are you looking for?',
        'welcomed'
      )

      expect(message.direction).toBe('outgoing')
      expect(message.content.type).toBe('text')
      expect(message.content.text).toBe('What job are you looking for?')
      expect(message.metadata?.state).toBe('welcomed')
    })

    it('should save an outgoing template message', async () => {
      const message = await chatHistory.saveOutgoingTemplateMessage(
        testPhoneNumber,
        testSessionId,
        'eska_job_title_prompt',
        'welcomed'
      )

      expect(message.direction).toBe('outgoing')
      expect(message.content.type).toBe('template')
      expect(message.content.templateName).toBe('eska_job_title_prompt')
    })

    it('should save an outgoing interactive message', async () => {
      const buttons = ['Software Engineer', 'Product Manager', 'Designer']

      const message = await chatHistory.saveOutgoingInteractiveMessage(
        testPhoneNumber,
        testSessionId,
        'Here are some jobs',
        buttons,
        'displayingResults',
        3
      )

      expect(message.direction).toBe('outgoing')
      expect(message.content.type).toBe('interactive')
      expect(message.content.text).toBe('Here are some jobs')
      expect(message.content.buttons).toEqual(buttons)
      expect(message.metadata?.jobOffersCount).toBe(3)
    })

    it('should generate unique IDs for each message', async () => {
      const msg1 = await chatHistory.saveIncomingMessage(
        testPhoneNumber,
        testSessionId,
        'First message',
        'idle'
      )

      const msg2 = await chatHistory.saveIncomingMessage(
        testPhoneNumber,
        testSessionId,
        'Second message',
        'idle'
      )

      expect(msg1.id).not.toBe(msg2.id)
    })

    it('should set timestamp automatically', async () => {
      const beforeTimestamp = Date.now()

      const message = await chatHistory.saveIncomingMessage(
        testPhoneNumber,
        testSessionId,
        'Test message',
        'idle'
      )

      const afterTimestamp = Date.now()

      expect(message.timestamp).toBeGreaterThanOrEqual(beforeTimestamp)
      expect(message.timestamp).toBeLessThanOrEqual(afterTimestamp)
    })
  })

  describe('getHistory', () => {
    it('should retrieve saved messages in chronological order', async () => {
      await chatHistory.saveIncomingMessage(testPhoneNumber, testSessionId, 'Message 1', 'idle')

      // Wait a tiny bit to ensure different timestamps
      await new Promise((resolve) => setTimeout(resolve, 10))

      await chatHistory.saveOutgoingTextMessage(
        testPhoneNumber,
        testSessionId,
        'Message 2',
        'welcomed'
      )

      await new Promise((resolve) => setTimeout(resolve, 10))

      await chatHistory.saveIncomingMessage(
        testPhoneNumber,
        testSessionId,
        'Message 3',
        'searchingJobs'
      )

      const history = await chatHistory.getHistory(testPhoneNumber)

      expect(history.length).toBe(3)
      expect(history[0].content.text).toBe('Message 1')
      expect(history[1].content.text).toBe('Message 2')
      expect(history[2].content.text).toBe('Message 3')
    })

    it('should respect the limit parameter', async () => {
      // Save 5 messages
      for (let i = 1; i <= 5; i++) {
        await chatHistory.saveIncomingMessage(
          testPhoneNumber,
          testSessionId,
          `Message ${i}`,
          'idle'
        )
      }

      const history = await chatHistory.getHistory(testPhoneNumber, 3)

      expect(history.length).toBe(3)
    })

    it('should return empty array for user with no history', async () => {
      const history = await chatHistory.getHistory('+9999999999')

      expect(history).toEqual([])
    })
  })

  describe('getRecentHistory', () => {
    it('should retrieve only the most recent messages', async () => {
      // Save 15 messages
      for (let i = 1; i <= 15; i++) {
        await chatHistory.saveIncomingMessage(
          testPhoneNumber,
          testSessionId,
          `Message ${i}`,
          'idle'
        )
      }

      const recent = await chatHistory.getRecentHistory(testPhoneNumber, 5)

      expect(recent.length).toBe(5)
      // Should get the last 5 messages
      expect(recent[0].content.text).toBe('Message 11')
      expect(recent[4].content.text).toBe('Message 15')
    })
  })

  describe('clearHistory', () => {
    it('should delete all messages for a user', async () => {
      await chatHistory.saveIncomingMessage(testPhoneNumber, testSessionId, 'Message 1', 'idle')
      await chatHistory.saveIncomingMessage(testPhoneNumber, testSessionId, 'Message 2', 'idle')

      let history = await chatHistory.getHistory(testPhoneNumber)
      expect(history.length).toBe(2)

      await chatHistory.clearHistory(testPhoneNumber)

      history = await chatHistory.getHistory(testPhoneNumber)
      expect(history.length).toBe(0)
    })
  })

  describe('getHistoryCount', () => {
    it('should return the correct count of messages', async () => {
      expect(await chatHistory.getHistoryCount(testPhoneNumber)).toBe(0)

      await chatHistory.saveIncomingMessage(testPhoneNumber, testSessionId, 'Message 1', 'idle')
      expect(await chatHistory.getHistoryCount(testPhoneNumber)).toBe(1)

      await chatHistory.saveIncomingMessage(testPhoneNumber, testSessionId, 'Message 2', 'idle')
      expect(await chatHistory.getHistoryCount(testPhoneNumber)).toBe(2)

      await chatHistory.saveIncomingMessage(testPhoneNumber, testSessionId, 'Message 3', 'idle')
      expect(await chatHistory.getHistoryCount(testPhoneNumber)).toBe(3)
    })
  })

  describe('Message Size Limits', () => {
    it('should enforce max history size (50 messages)', async () => {
      // Save 60 messages
      for (let i = 1; i <= 60; i++) {
        await chatHistory.saveIncomingMessage(
          testPhoneNumber,
          testSessionId,
          `Message ${i}`,
          'idle'
        )
      }

      const count = await chatHistory.getHistoryCount(testPhoneNumber)

      // Should only keep the last 50
      expect(count).toBe(50)

      const history = await chatHistory.getHistory(testPhoneNumber)

      // First message should be message 11 (oldest of the last 50)
      expect(history[0].content.text).toBe('Message 11')
      // Last message should be message 60
      expect(history[49].content.text).toBe('Message 60')
    })
  })

  describe('Multiple Users', () => {
    const user1 = '+1111111111'
    const user2 = '+2222222222'

    afterEach(async () => {
      await chatHistory.clearHistory(user1)
      await chatHistory.clearHistory(user2)
    })

    it('should keep messages separate for different users', async () => {
      await chatHistory.saveIncomingMessage(user1, 'session-1', 'User 1 message', 'idle')
      await chatHistory.saveIncomingMessage(user2, 'session-2', 'User 2 message', 'idle')

      const history1 = await chatHistory.getHistory(user1)
      const history2 = await chatHistory.getHistory(user2)

      expect(history1.length).toBe(1)
      expect(history2.length).toBe(1)
      expect(history1[0].content.text).toBe('User 1 message')
      expect(history2[0].content.text).toBe('User 2 message')
    })
  })

  describe('Data Validation', () => {
    it('should parse and validate message structure', async () => {
      const message = await chatHistory.saveIncomingMessage(
        testPhoneNumber,
        testSessionId,
        'Valid message',
        'idle'
      )

      const history = await chatHistory.getHistory(testPhoneNumber)

      // Zod validation should pass
      expect(history[0]).toBeDefined()
      expect(history[0].id).toBe(message.id)
    })

    it('should handle corrupted data gracefully', async () => {
      // Manually insert invalid data
      const key = `chat:history:${testPhoneNumber}`
      await redis.lpush(key, 'invalid-json-data')

      // Should not throw, should filter out invalid messages
      const history = await chatHistory.getHistory(testPhoneNumber)

      expect(history.length).toBe(0)
    })
  })

  describe('Redis Operations', () => {
    it('should set TTL on chat history', async () => {
      await chatHistory.saveIncomingMessage(testPhoneNumber, testSessionId, 'Message', 'idle')

      const key = `chat:history:${testPhoneNumber}`
      const ttl = await redis.ttl(key)

      // TTL should be set (30 days = 2592000 seconds)
      expect(ttl).toBeGreaterThan(0)
      expect(ttl).toBeLessThanOrEqual(2592000)
    })

    it('should use Redis lists for storage', async () => {
      await chatHistory.saveIncomingMessage(testPhoneNumber, testSessionId, 'Message', 'idle')

      const key = `chat:history:${testPhoneNumber}`
      const type = await redis.type(key)

      expect(type).toBe('list')
    })
  })
})
