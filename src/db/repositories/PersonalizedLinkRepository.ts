import { AppDataSource } from '../index'
import { PersonalizedLinkEntity } from '../entities/PersonalizedLinkEntity'
import { BaseRepository } from './BaseRepository'

export class PersonalizedLinkRepository extends BaseRepository<PersonalizedLinkEntity> {
  constructor() {
    super(AppDataSource.getRepository(PersonalizedLinkEntity))
  }

  async incrementClickCount(id: string, clickData: Record<string, any>): Promise<PersonalizedLinkEntity | null> {
    const link = await this.findById(id)
    if (!link) return null

    // Initialize click history if it doesn't exist
    const clickHistory = link.metadata?.clickHistory || []

    // Append the new click data to the history
    clickHistory.push({
      clickNumber: link.clickCount + 1,
      ...clickData,
    })

    return await this.update(id, {
      clickCount: link.clickCount + 1,
      metadata: {
        ...link.metadata,
        clickHistory,
        lastClick: clickData,
      },
    })
  }

  async findByPhoneNumber(phoneNumber: string): Promise<PersonalizedLinkEntity[]> {
    return await this.findBy({ phoneNumber })
  }
}
