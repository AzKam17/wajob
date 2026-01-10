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
}
