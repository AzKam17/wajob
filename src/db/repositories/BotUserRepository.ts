import { AppDataSource } from '../index'
import { BotUserEntity } from '../entities/BotUserEntity'
import { BaseRepository } from './BaseRepository'

export class BotUserRepository extends BaseRepository<BotUserEntity> {
  constructor() {
    super(AppDataSource.getRepository(BotUserEntity))
  }

  async findByPhoneNumber(phoneNumber: string): Promise<BotUserEntity | null> {
    return await this.findOneBy({ phoneNumber })
  }

  async updateLastMessageTime(id: string): Promise<BotUserEntity | null> {
    return await this.update(id, { lastMessageAt: new Date() })
  }

  async findAllPaginated(
    page: number,
    limit: number,
    search?: string,
    sortBy: string = 'createdAt',
    sortOrder: 'ASC' | 'DESC' = 'DESC'
  ): Promise<{ users: BotUserEntity[]; total: number }> {
    const offset = (page - 1) * limit

    const queryBuilder = this.repository
      .createQueryBuilder('user')
      .where('user.deletedAt IS NULL')

    if (search) {
      queryBuilder.andWhere('user.phoneNumber ILIKE :search', { search: `%${search}%` })
    }

    const [users, total] = await queryBuilder
      .orderBy(`user.${sortBy}`, sortOrder)
      .skip(offset)
      .take(limit)
      .getManyAndCount()

    return { users, total }
  }

  async getNewUsersPerTimeBucket(startTime: number, endTime: number): Promise<Array<{ bucket: number; count: number }>> {
    const bucketSize = this.calculateBucketSize(startTime, endTime)

    try {
      const results = await this.repository.query(`
        SELECT
          FLOOR(EXTRACT(EPOCH FROM "createdAt") * 1000 / $1) * $1 as bucket,
          COUNT(*) as count
        FROM bot_users
        WHERE "deletedAt" IS NULL
          AND EXTRACT(EPOCH FROM "createdAt") * 1000 >= $2
          AND EXTRACT(EPOCH FROM "createdAt") * 1000 <= $3
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

  async getReturningUsersPerTimeBucket(startTime: number, endTime: number): Promise<Array<{ bucket: number; count: number }>> {
    const bucketSize = this.calculateBucketSize(startTime, endTime)

    try {
      // Returning users = users who sent a message in this period but were created before the period
      // We use lastMessageAt to track when they were last active
      const results = await this.repository.query(`
        SELECT
          FLOOR(EXTRACT(EPOCH FROM "lastMessageAt") * 1000 / $1) * $1 as bucket,
          COUNT(DISTINCT id) as count
        FROM bot_users
        WHERE "deletedAt" IS NULL
          AND "lastMessageAt" IS NOT NULL
          AND EXTRACT(EPOCH FROM "lastMessageAt") * 1000 >= $2
          AND EXTRACT(EPOCH FROM "lastMessageAt") * 1000 <= $3
          AND "createdAt" < to_timestamp($2 / 1000.0)
        GROUP BY bucket
        ORDER BY bucket ASC
      `, [bucketSize, startTime, endTime])

      return results.map((r: any) => ({
        bucket: parseInt(r.bucket),
        count: parseInt(r.count),
      }))
    } catch (e) {
      console.error('getReturningUsersPerTimeBucket error:', e)
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
