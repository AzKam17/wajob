import { AppDataSource } from '../data-source'
import { ScraperSourceEntity } from '../entities/ScraperSourceEntity'
import { BaseRepository } from './BaseRepository'

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
}
