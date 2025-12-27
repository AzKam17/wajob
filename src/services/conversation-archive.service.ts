import type { Redis } from 'ioredis'
import { Conversation, ConversationSchema } from '@/models/Conversation'
import { ChatMessage } from '@/models/ChatMessage'
import { randomUUID } from 'crypto'

/**
 * ConversationArchiveService
 *
 * Manages complete conversation records with full message history.
 * Unlike chat history (which stores individual messages), this service
 * stores complete conversation metadata and archives entire conversations.
 *
 * Use cases:
 * - Analytics: Track conversation patterns and user engagement
 * - Support: Review complete conversation history
 * - Debugging: Understand conversation flow issues
 * - Compliance: Maintain conversation records
 */
export class ConversationArchiveService {
  private readonly CONVERSATION_PREFIX = 'conversation:archive:'
  private readonly ACTIVE_CONVERSATION_PREFIX = 'conversation:active:'
  private readonly CONVERSATION_INDEX_PREFIX = 'conversation:index:'
  private readonly ARCHIVE_TTL = 60 * 60 * 24 * 90 // 90 days

  constructor(private readonly redis: Redis) {}

  /**
   * Start a new conversation tracking
   */
  async startConversation(phoneNumber: string, sessionId: string): Promise<Conversation> {
    const conversation: Conversation = {
      id: randomUUID(),
      phoneNumber,
      sessionId,
      startedAt: Date.now(),
      lastActivityAt: Date.now(),
      messageCount: 0,
      status: 'active',
      metadata: {
        welcomeSent: false,
        searchQueriesCount: 0,
        jobOffersShownCount: 0,
        paginationRequestsCount: 0,
      },
    }

    await this.saveActiveConversation(phoneNumber, conversation)

    return conversation
  }

  /**
   * Get active conversation for a user
   */
  async getActiveConversation(phoneNumber: string): Promise<Conversation | null> {
    const key = this.getActiveConversationKey(phoneNumber)
    const data = await this.redis.get(key)

    if (!data) {
      return null
    }

    try {
      const parsed = JSON.parse(data)
      return ConversationSchema.parse(parsed)
    } catch (error) {
      console.error('Failed to parse active conversation:', error)
      return null
    }
  }

  /**
   * Update conversation activity and metadata
   */
  async updateConversation(
    phoneNumber: string,
    updates: {
      messageCount?: number
      welcomeSent?: boolean
      searchQueriesCount?: number
      jobOffersShownCount?: number
      paginationRequestsCount?: number
      finalState?: string
    }
  ): Promise<void> {
    const conversation = await this.getActiveConversation(phoneNumber)

    if (!conversation) {
      return
    }

    // Update fields
    conversation.lastActivityAt = Date.now()
    if (updates.messageCount !== undefined) {
      conversation.messageCount = updates.messageCount
    }

    // Update metadata
    if (!conversation.metadata) {
      conversation.metadata = {
        welcomeSent: false,
        searchQueriesCount: 0,
        jobOffersShownCount: 0,
        paginationRequestsCount: 0,
      }
    }

    if (updates.welcomeSent !== undefined) {
      conversation.metadata.welcomeSent = updates.welcomeSent
    }
    if (updates.searchQueriesCount !== undefined) {
      conversation.metadata.searchQueriesCount = updates.searchQueriesCount
    }
    if (updates.jobOffersShownCount !== undefined) {
      conversation.metadata.jobOffersShownCount = updates.jobOffersShownCount
    }
    if (updates.paginationRequestsCount !== undefined) {
      conversation.metadata.paginationRequestsCount = updates.paginationRequestsCount
    }
    if (updates.finalState !== undefined) {
      conversation.metadata.finalState = updates.finalState
    }

    await this.saveActiveConversation(phoneNumber, conversation)
  }

  /**
   * Increment message count
   */
  async incrementMessageCount(phoneNumber: string): Promise<void> {
    const conversation = await this.getActiveConversation(phoneNumber)

    if (!conversation) {
      return
    }

    conversation.messageCount++
    conversation.lastActivityAt = Date.now()

    await this.saveActiveConversation(phoneNumber, conversation)
  }

  /**
   * Archive a conversation (mark as completed and move to archive)
   */
  async archiveConversation(
    phoneNumber: string,
    status: 'completed' | 'abandoned' = 'completed'
  ): Promise<void> {
    const conversation = await this.getActiveConversation(phoneNumber)

    if (!conversation) {
      return
    }

    conversation.status = status
    conversation.endedAt = Date.now()

    // Save to archive
    const archiveKey = this.getArchiveKey(conversation.id)
    await this.redis.setex(archiveKey, this.ARCHIVE_TTL, JSON.stringify(conversation))

    // Add to user's conversation index
    const indexKey = this.getConversationIndexKey(phoneNumber)
    await this.redis.zadd(indexKey, conversation.endedAt, conversation.id)
    await this.redis.expire(indexKey, this.ARCHIVE_TTL)

    // Remove from active
    await this.redis.del(this.getActiveConversationKey(phoneNumber))
  }

  /**
   * Get archived conversation by ID
   */
  async getArchivedConversation(conversationId: string): Promise<Conversation | null> {
    const key = this.getArchiveKey(conversationId)
    const data = await this.redis.get(key)

    if (!data) {
      return null
    }

    try {
      return ConversationSchema.parse(JSON.parse(data))
    } catch (error) {
      console.error('Failed to parse archived conversation:', error)
      return null
    }
  }

  /**
   * Get all archived conversations for a user
   */
  async getUserConversations(
    phoneNumber: string,
    limit = 20,
    offset = 0
  ): Promise<Conversation[]> {
    const indexKey = this.getConversationIndexKey(phoneNumber)

    // Get conversation IDs sorted by end time (most recent first)
    const conversationIds = await this.redis.zrevrange(indexKey, offset, offset + limit - 1)

    const conversations: Conversation[] = []

    for (const id of conversationIds) {
      const conversation = await this.getArchivedConversation(id)
      if (conversation) {
        conversations.push(conversation)
      }
    }

    return conversations
  }

  /**
   * Get conversation count for a user
   */
  async getUserConversationCount(phoneNumber: string): Promise<number> {
    const indexKey = this.getConversationIndexKey(phoneNumber)
    return await this.redis.zcard(indexKey)
  }

  /**
   * Get complete conversation with all messages
   */
  async getCompleteConversation(
    conversationId: string,
    chatHistory: ChatMessage[]
  ): Promise<{
    conversation: Conversation
    messages: ChatMessage[]
  } | null> {
    const conversation = await this.getArchivedConversation(conversationId)

    if (!conversation) {
      return null
    }

    // Filter messages by sessionId
    const messages = chatHistory.filter((msg) => msg.sessionId === conversation.sessionId)

    return {
      conversation,
      messages,
    }
  }

  /**
   * Save active conversation to Redis
   */
  private async saveActiveConversation(
    phoneNumber: string,
    conversation: Conversation
  ): Promise<void> {
    const key = this.getActiveConversationKey(phoneNumber)
    const ttl = 60 * 60 * 2 // 2 hours for active conversations
    await this.redis.setex(key, ttl, JSON.stringify(conversation))
  }

  /**
   * Get Redis key for active conversation
   */
  private getActiveConversationKey(phoneNumber: string): string {
    return `${this.ACTIVE_CONVERSATION_PREFIX}${phoneNumber}`
  }

  /**
   * Get Redis key for archived conversation
   */
  private getArchiveKey(conversationId: string): string {
    return `${this.CONVERSATION_PREFIX}${conversationId}`
  }

  /**
   * Get Redis key for user's conversation index
   */
  private getConversationIndexKey(phoneNumber: string): string {
    return `${this.CONVERSATION_INDEX_PREFIX}${phoneNumber}`
  }

  /**
   * Get conversation statistics
   */
  async getConversationStats(conversationId: string): Promise<{
    duration: number
    messagesPerMinute: number
    completionRate: number
  } | null> {
    const conversation = await this.getArchivedConversation(conversationId)

    if (!conversation || !conversation.endedAt) {
      return null
    }

    const duration = conversation.endedAt - conversation.startedAt
    const durationMinutes = duration / (1000 * 60)
    const messagesPerMinute = durationMinutes > 0 ? conversation.messageCount / durationMinutes : 0

    // Completion rate: did they complete a search?
    const completionRate =
      conversation.metadata && conversation.metadata.searchQueriesCount > 0 ? 1 : 0

    return {
      duration,
      messagesPerMinute,
      completionRate,
    }
  }
}
