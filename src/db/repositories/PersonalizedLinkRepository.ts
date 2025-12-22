import { AppDataSource } from '../index'
import { PersonalizedLinkEntity } from '../entities/PersonalizedLinkEntity'
import { BaseRepository } from './BaseRepository'

export class PersonalizedLinkRepository extends BaseRepository<PersonalizedLinkEntity> {
  constructor() {
    super(AppDataSource.getRepository(PersonalizedLinkEntity))
  }

  async incrementClickCount(id: string, metadata: Record<string, any>): Promise<PersonalizedLinkEntity | null> {
    const link = await this.findById(id)
    if (!link) return null

    return await this.update(id, {
      clickCount: link.clickCount + 1,
      metadata: { ...link.metadata, ...metadata },
    })
  }

  async findByPhoneNumber(phoneNumber: string): Promise<PersonalizedLinkEntity[]> {
    return await this.findBy({ phoneNumber })
  }
}
