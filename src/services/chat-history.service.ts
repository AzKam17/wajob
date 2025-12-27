import type { Redis } from 'ioredis'
import { ChatMessage, ChatMessageSchema } from '@/models/ChatMessage'
import { MessageRepository } from '@/db/repositories/MessageRepository'
import { ConversationRepository } from '@/db/repositories/ConversationRepository'
import { randomUUID } from 'crypto'

export class ChatHistoryService {
  private readonly HISTORY_PREFIX = 'chat:history:'
  private readonly MAX_HISTORY_SIZE = 50
  private readonly HISTORY_TTL = 60 * 60 * 24 * 30 // 30 days in seconds

  private messageRepo = new MessageRepository()
  private conversationRepo = new ConversationRepository()

  constructor(private readonly redis: Redis) {}

  async saveMessage(
    phoneNumber: string,
    sessionId: string,
    direction: 'incoming' | 'outgoing',
    content: ChatMessage['content'],
    metadata?: ChatMessage['metadata']
  ): Promise<ChatMessage> {
    const message: ChatMessage = {
      id: randomUUID(),
      sessionId,
      phoneNumber,
      timestamp: Date.now(),
      direction,
      content,
      metadata,
    }

    const key = this.getHistoryKey(phoneNumber)

    // Save to Redis for fast access
    const pipeline = this.redis.pipeline()
    pipeline.lpush(key, JSON.stringify(message))
    pipeline.ltrim(key, 0, this.MAX_HISTORY_SIZE - 1)
    pipeline.expire(key, this.HISTORY_TTL)
    await pipeline.exec()

    // Save to database for persistent storage
    try {
      // Get or create active conversation
      let conversation = await this.conversationRepo.findActiveByPhoneNumber(phoneNumber)

      if (!conversation) {
        // Create new conversation if none exists
        conversation = await this.conversationRepo.create({
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
        })
      }

      // Save message to database
      await this.messageRepo.create({
        id: message.id,
        conversationId: conversation.id,
        sessionId,
        phoneNumber,
        timestamp: message.timestamp,
        direction,
        content,
        metadata,
      })

      // Update conversation activity and message count
      await this.conversationRepo.incrementMessageCount(conversation.id)
      await this.conversationRepo.updateLastActivity(conversation.id, message.timestamp)
    } catch (error) {
      console.error('Failed to save message to database:', error)
      // Don't fail the entire operation if DB save fails
    }

    return message
  }

  async getHistory(phoneNumber: string, limit = 50): Promise<ChatMessage[]> {
    const key = this.getHistoryKey(phoneNumber)

    const messages = await this.redis.lrange(key, 0, limit - 1)

    return messages
      .map((msg) => {
        try {
          const parsed = JSON.parse(msg)
          return ChatMessageSchema.parse(parsed)
        } catch (error) {
          console.error('Failed to parse chat message:', error)
          return null
        }
      })
      .filter((msg): msg is ChatMessage => msg !== null)
      .reverse() // Reverse to get chronological order (oldest first)
  }

  async getRecentHistory(phoneNumber: string, count = 10): Promise<ChatMessage[]> {
    const key = this.getHistoryKey(phoneNumber)

    const messages = await this.redis.lrange(key, 0, count - 1)

    return messages
      .map((msg) => {
        try {
          const parsed = JSON.parse(msg)
          return ChatMessageSchema.parse(parsed)
        } catch (error) {
          console.error('Failed to parse chat message:', error)
          return null
        }
      })
      .filter((msg): msg is ChatMessage => msg !== null)
      .reverse()
  }

  async clearHistory(phoneNumber: string): Promise<void> {
    const key = this.getHistoryKey(phoneNumber)
    await this.redis.del(key)
  }

  async getHistoryCount(phoneNumber: string): Promise<number> {
    const key = this.getHistoryKey(phoneNumber)
    return await this.redis.llen(key)
  }

  async saveIncomingMessage(
    phoneNumber: string,
    sessionId: string,
    message: string,
    state?: string
  ): Promise<ChatMessage> {
    return this.saveMessage(
      phoneNumber,
      sessionId,
      'incoming',
      {
        type: 'text',
        text: message,
      },
      {
        state,
        processedAt: Date.now(),
      }
    )
  }

  async saveOutgoingTextMessage(
    phoneNumber: string,
    sessionId: string,
    message: string,
    state?: string
  ): Promise<ChatMessage> {
    return this.saveMessage(
      phoneNumber,
      sessionId,
      'outgoing',
      {
        type: 'text',
        text: message,
      },
      {
        state,
      }
    )
  }

  async saveOutgoingTemplateMessage(
    phoneNumber: string,
    sessionId: string,
    templateName: string,
    state?: string
  ): Promise<ChatMessage> {
    return this.saveMessage(
      phoneNumber,
      sessionId,
      'outgoing',
      {
        type: 'template',
        templateName,
      },
      {
        state,
      }
    )
  }

  async saveOutgoingInteractiveMessage(
    phoneNumber: string,
    sessionId: string,
    text: string,
    buttons: any[],
    state?: string,
    jobOffersCount?: number
  ): Promise<ChatMessage> {
    return this.saveMessage(
      phoneNumber,
      sessionId,
      'outgoing',
      {
        type: 'interactive',
        text,
        buttons,
      },
      {
        state,
        jobOffersCount,
      }
    )
  }

  private getHistoryKey(phoneNumber: string): string {
    return `${this.HISTORY_PREFIX}${phoneNumber}`
  }

  /**
   * Get history from database (persistent storage)
   */
  async getHistoryFromDatabase(phoneNumber: string, limit = 50): Promise<ChatMessage[]> {
    try {
      const messages = await this.messageRepo.findByPhoneNumber(phoneNumber, limit, 0)

      return messages.map((msg) => ({
        id: msg.id,
        sessionId: msg.sessionId,
        phoneNumber: msg.phoneNumber,
        timestamp: msg.timestamp,
        direction: msg.direction,
        content: msg.content,
        metadata: msg.metadata,
      }))
    } catch (error) {
      console.error('Failed to get history from database:', error)
      return []
    }
  }

  /**
   * Get conversation with all messages from database
   */
  async getConversationFromDatabase(conversationId: string) {
    try {
      const conversation = await this.conversationRepo.findWithMessages(conversationId)

      if (!conversation) {
        return null
      }

      return {
        ...conversation,
        messages:
          conversation.messages?.map((msg) => ({
            id: msg.id,
            sessionId: msg.sessionId,
            phoneNumber: msg.phoneNumber,
            timestamp: msg.timestamp,
            direction: msg.direction,
            content: msg.content,
            metadata: msg.metadata,
          })) || [],
      }
    } catch (error) {
      console.error('Failed to get conversation from database:', error)
      return null
    }
  }

  /**
   * Get all conversations for a user from database
   */
  async getUserConversations(phoneNumber: string, limit = 20, offset = 0) {
    try {
      return await this.conversationRepo.findByPhoneNumber(phoneNumber, limit, offset)
    } catch (error) {
      console.error('Failed to get user conversations:', error)
      return []
    }
  }

  /**
   * Update conversation metadata (welcome sent, search count, etc.)
   */
  async updateConversationMetadata(
    phoneNumber: string,
    metadata: {
      welcomeSent?: boolean
      searchQueriesCount?: number
      jobOffersShownCount?: number
      paginationRequestsCount?: number
      finalState?: string
    }
  ) {
    try {
      const conversation = await this.conversationRepo.findActiveByPhoneNumber(phoneNumber)

      if (conversation) {
        await this.conversationRepo.updateMetadata(conversation.id, metadata)
      }
    } catch (error) {
      console.error('Failed to update conversation metadata:', error)
    }
  }

  /**
   * Mark conversation as completed
   */
  async completeConversation(phoneNumber: string) {
    try {
      const conversation = await this.conversationRepo.findActiveByPhoneNumber(phoneNumber)

      if (conversation) {
        await this.conversationRepo.updateStatus(conversation.id, 'completed')
      }
    } catch (error) {
      console.error('Failed to complete conversation:', error)
    }
  }

  /**
   * Get conversation statistics
   */
  async getConversationStats(phoneNumber: string) {
    try {
      return await this.conversationRepo.getStats(phoneNumber)
    } catch (error) {
      console.error('Failed to get conversation stats:', error)
      return null
    }
  }
}
