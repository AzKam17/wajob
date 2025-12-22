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
}
