import { MessageEntity } from '../entities/MessageEntity'
import { BaseRepository } from './BaseRepository'

export class MessageRepository extends BaseRepository<MessageEntity> {
  constructor() {
    super(MessageEntity)
  }

  async findByConversationId(conversationId: string, limit = 100, offset = 0) {
    return this.repository.find({
      where: { conversationId },
      order: { timestamp: 'ASC' },
      take: limit,
      skip: offset,
    })
  }

  async findByPhoneNumber(phoneNumber: string, limit = 50, offset = 0) {
    return this.repository.find({
      where: { phoneNumber },
      order: { timestamp: 'DESC' },
      take: limit,
      skip: offset,
    })
  }

  async findBySessionId(sessionId: string) {
    return this.repository.find({
      where: { sessionId },
      order: { timestamp: 'ASC' },
    })
  }

  async countByConversationId(conversationId: string) {
    return this.repository.count({
      where: { conversationId },
    })
  }

  async getLatestByPhoneNumber(phoneNumber: string) {
    return this.repository.findOne({
      where: { phoneNumber },
      order: { timestamp: 'DESC' },
    })
  }

  async findInTimeRange(phoneNumber: string, startTime: number, endTime: number) {
    return this.repository
      .createQueryBuilder('message')
      .where('message.phoneNumber = :phoneNumber', { phoneNumber })
      .andWhere('message.timestamp >= :startTime', { startTime })
      .andWhere('message.timestamp <= :endTime', { endTime })
      .orderBy('message.timestamp', 'ASC')
      .getMany()
  }

  async searchMessages(phoneNumber: string, searchText: string, limit = 20) {
    return this.repository
      .createQueryBuilder('message')
      .where('message.phoneNumber = :phoneNumber', { phoneNumber })
      .andWhere(`JSON_EXTRACT(message.content, '$.text') LIKE :searchText`, {
        searchText: `%${searchText}%`,
      })
      .orderBy('message.timestamp', 'DESC')
      .take(limit)
      .getMany()
  }
}
