import { AppDataSource } from '../data-source'
import { ScraperSourceEntity } from '../entities/ScraperSourceEntity'
import { BaseRepository } from './BaseRepository'
import { ScraperSourceMapper } from '../mappers'
import { ScraperSource } from '@models/ScraperSource'

export class ScraperSourceRepository extends BaseRepository<ScraperSourceEntity> {
  constructor() {
    super(AppDataSource.getRepository(ScraperSourceEntity))
  }

  async findByName(name: string): Promise<ScraperSourceEntity | null> {
    return this.findOneBy({ name })
  }

  async findActive(): Promise<ScraperSourceEntity[]> {
    return this.findBy({ isActive: true })
  }

  async findShouldScrape(): Promise<ScraperSourceEntity[]> {
    return this.findBy({
      isActive: true,
      shouldScrapeNext: true,
    })
  }

  async markAsScraped(
    id: string,
    page: number,
    jobsFound: number
  ): Promise<ScraperSourceEntity | null> {
    const current = await this.findById(id)
    return this.update(id, {
      lastScrapedAt: new Date(),
      lastPageScrapped: page,
      shouldScrapeNext: false,
      totalJobsFound: (current?.totalJobsFound || 0) + jobsFound,
    })
  }

  // Model-based methods
  async saveModel(model: ScraperSource): Promise<ScraperSource> {
    const entity = await this.create(ScraperSourceMapper.toEntity(model))
    return ScraperSourceMapper.toModel(entity)
  }

  async updateModel(model: ScraperSource): Promise<ScraperSource | null> {
    if (!model.id) return null
    const entity = await this.update(model.id, ScraperSourceMapper.toEntity(model))
    return entity ? ScraperSourceMapper.toModel(entity) : null
  }

  async findModelByName(name: string): Promise<ScraperSource | null> {
    const entity = await this.findByName(name)
    return entity ? ScraperSourceMapper.toModel(entity) : null
  }

  async findActiveModels(): Promise<ScraperSource[]> {
    const entities = await this.findActive()
    return ScraperSourceMapper.toModels(entities)
  }

  async findShouldScrapeModels(): Promise<ScraperSource[]> {
    const entities = await this.findShouldScrape()
    return ScraperSourceMapper.toModels(entities)
  }
}
