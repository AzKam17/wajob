import { AppDataSource } from '../data-source'
import { ConversationEntity } from '../entities/ConversationEntity'
import { BaseRepository } from './BaseRepository'

export class ConversationRepository extends BaseRepository<ConversationEntity> {
  constructor() {
    super(AppDataSource.getRepository(ConversationEntity))
  }

  async findByPhoneNumber(phoneNumber: string, limit = 20, offset = 0) {
    return this.repository.find({
      where: { phoneNumber },
      order: { startedAt: 'DESC' },
      take: limit,
      skip: offset,
    })
  }

  async findActiveByPhoneNumber(phoneNumber: string) {
    return this.repository.findOne({
      where: { phoneNumber, status: 'active' },
      order: { startedAt: 'DESC' },
    })
  }

  async findBySessionId(sessionId: string) {
    return this.repository.findOne({
      where: { sessionId },
    })
  }

  async findWithMessages(conversationId: string) {
    return this.repository.findOne({
      where: { id: conversationId },
      relations: ['messages'],
      order: {
        messages: {
          timestamp: 'ASC',
        },
      },
    })
  }

  async updateStatus(id: string, status: 'active' | 'completed' | 'abandoned', endedAt?: number) {
    return this.repository.update(id, {
      status,
      endedAt: endedAt || Date.now(),
    })
  }

  async incrementMessageCount(id: string) {
    return this.repository.increment({ id }, 'messageCount', 1)
  }

  async updateLastActivity(id: string, lastActivityAt = Date.now()) {
    return this.repository.update(id, { lastActivityAt })
  }

  async updateMetadata(
    id: string,
    metadata: {
      welcomeSent?: boolean
      searchQueriesCount?: number
      jobOffersShownCount?: number
      paginationRequestsCount?: number
      finalState?: string
    }
  ) {
    const conversation = await this.findById(id)
    if (!conversation) return

    const updatedMetadata = {
      ...conversation.metadata,
      ...metadata,
    }

    return this.repository.update(id, { metadata: updatedMetadata })
  }

  async getStats(phoneNumber: string) {
    const result = await this.repository
      .createQueryBuilder('conversation')
      .select('COUNT(*)', 'totalConversations')
      .addSelect('AVG(conversation.messageCount)', 'avgMessagesPerConversation')
      .addSelect('SUM(CASE WHEN conversation.status = "completed" THEN 1 ELSE 0 END)', 'completedCount')
      .addSelect(
        'AVG(CASE WHEN conversation.endedAt IS NOT NULL THEN conversation.endedAt - conversation.startedAt ELSE NULL END)',
        'avgDuration'
      )
      .where('conversation.phoneNumber = :phoneNumber', { phoneNumber })
      .getRawOne()

    return {
      totalConversations: parseInt(result.totalConversations) || 0,
      avgMessagesPerConversation: parseFloat(result.avgMessagesPerConversation) || 0,
      completedCount: parseInt(result.completedCount) || 0,
      avgDuration: parseFloat(result.avgDuration) || 0,
    }
  }
}
