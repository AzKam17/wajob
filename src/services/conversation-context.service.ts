import type { Redis } from 'ioredis'
import { Logger } from '../utils/logger'
import { v4 as uuidv4 } from 'uuid'

export interface ConversationContext {
  sessionId: string
  phoneNumber: string
  createdAt: number
  lastMessageAt: number
  welcomeSentAt?: number
  lastQuery?: string
  lastOffset?: number
  messageCount: number
  latestRequestId?: string
}

/**
 * Conversation Context Service - Simplified context without state machine
 * Stores conversation context in Redis
 */
export class ConversationContextService {
  private readonly CONTEXT_TTL = 86400 // 24 hours
  private readonly CONTEXT_PREFIX = 'conversation:context:'

  constructor(private redis: Redis) {}

  /**
   * Get or create conversation context
   */
  async getOrCreate(phoneNumber: string): Promise<ConversationContext> {
    const key = this.getContextKey(phoneNumber)
    const data = await this.redis.get(key)

    if (data) {
      const context = JSON.parse(data) as ConversationContext
      // Update last message time
      context.lastMessageAt = Date.now()
      await this.save(context)
      return context
    }

    // Create new context
    const context: ConversationContext = {
      sessionId: uuidv4(),
      phoneNumber,
      createdAt: Date.now(),
      lastMessageAt: Date.now(),
      messageCount: 0,
    }

    await this.save(context)
    Logger.info('[ConversationContext] New context created', { phoneNumber, sessionId: context.sessionId })

    return context
  }

  /**
   * Save context to Redis
   */
  async save(context: ConversationContext): Promise<void> {
    const key = this.getContextKey(context.phoneNumber)
    await this.redis.setex(key, this.CONTEXT_TTL, JSON.stringify(context))
  }

  /**
   * Mark welcome as sent
   */
  async markWelcomeSent(phoneNumber: string): Promise<void> {
    const context = await this.getOrCreate(phoneNumber)
    context.welcomeSentAt = Date.now()
    await this.save(context)
  }

  /**
   * Update last query and offset
   */
  async updateLastQuery(phoneNumber: string, query: string, offset: number): Promise<void> {
    const context = await this.getOrCreate(phoneNumber)
    context.lastQuery = query
    context.lastOffset = offset
    await this.save(context)
  }

  /**
   * Increment message count
   */
  async incrementMessageCount(phoneNumber: string): Promise<void> {
    const context = await this.getOrCreate(phoneNumber)
    context.messageCount += 1
    await this.save(context)
  }

  /**
   * Update latest request ID
   */
  async updateLatestRequestId(phoneNumber: string, requestId: string): Promise<void> {
    const context = await this.getOrCreate(phoneNumber)
    context.latestRequestId = requestId
    await this.save(context)
  }

  /**
   * Clear context (useful for testing)
   */
  async clearContext(phoneNumber: string): Promise<void> {
    const key = this.getContextKey(phoneNumber)
    await this.redis.del(key)
    Logger.info('[ConversationContext] Context cleared', { phoneNumber })
  }

  /**
   * Get Redis key for context
   */
  private getContextKey(phoneNumber: string): string {
    return `${this.CONTEXT_PREFIX}${phoneNumber}`
  }
}
