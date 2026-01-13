import { AppDataSource } from '../data-source'
import { MessageEntity } from '../entities/MessageEntity'
import { BaseRepository } from './BaseRepository'

export class MessageRepository extends BaseRepository<MessageEntity> {
  constructor() {
    super(AppDataSource.getRepository(MessageEntity))
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

  async countIncomingByPhoneNumber(phoneNumber: string): Promise<number> {
    return this.repository
      .createQueryBuilder('message')
      .where('message.phoneNumber = :phoneNumber', { phoneNumber })
      .andWhere('message.direction = :direction', { direction: 'incoming' })
      .getCount()
  }

  async getFirstIncomingMessage(phoneNumber: string): Promise<MessageEntity | null> {
    return this.repository
      .createQueryBuilder('message')
      .where('message.phoneNumber = :phoneNumber', { phoneNumber })
      .andWhere('message.direction = :direction', { direction: 'incoming' })
      .orderBy('message.timestamp', 'ASC')
      .getOne()
  }

  async getMessagesPerTimeBucket(startTime: number, endTime: number): Promise<Array<{ bucket: number; count: number }>> {
    const bucketSize = this.calculateBucketSize(startTime, endTime)

    try {
      const results = await this.repository.query(`
        SELECT
          FLOOR(timestamp / $1) * $1 as bucket,
          COUNT(*) as count
        FROM messages
        WHERE "deletedAt" IS NULL
          AND timestamp >= $2
          AND timestamp <= $3
          AND "phoneNumber" != '22579136356'
        GROUP BY bucket
        ORDER BY bucket ASC
      `, [bucketSize, startTime, endTime])

      return results.map((r: any) => ({
        bucket: parseInt(r.bucket),
        count: parseInt(r.count),
      }))
    } catch {
      return []
    }
  }

  private calculateBucketSize(startTime: number, endTime: number): number {
    const duration = endTime - startTime
    const fifteenMin = 15 * 60 * 1000
    const oneHour = 60 * 60 * 1000
    const oneDay = 24 * 60 * 60 * 1000

    if (duration <= fifteenMin) return 60 * 1000 // 1 minute buckets
    if (duration <= oneHour) return 5 * 60 * 1000 // 5 minute buckets
    if (duration <= 6 * oneHour) return 15 * 60 * 1000 // 15 minute buckets
    if (duration <= oneDay) return oneHour // 1 hour buckets
    if (duration <= 7 * oneDay) return 6 * oneHour // 6 hour buckets
    return oneDay // 1 day buckets
  }
}
