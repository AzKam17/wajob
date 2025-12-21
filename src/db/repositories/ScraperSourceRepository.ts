import { BaseRepository } from './BaseRepository'
import {
  scraperSources,
  type ScraperSource,
  type NewScraperSource,
} from '../schema/scraperSources'
import { eq, and } from 'drizzle-orm'

export class ScraperSourceRepository extends BaseRepository<
  ScraperSource,
  NewScraperSource
> {
  constructor() {
    super(scraperSources)
  }

  async findByName(name: string): Promise<ScraperSource | null> {
    return this.findOneBy(eq(scraperSources.name, name))
  }

  async findActive(): Promise<ScraperSource[]> {
    return this.findBy(eq(scraperSources.isActive, true))
  }

  async findShouldScrape(): Promise<ScraperSource[]> {
    const condition = and(
      eq(scraperSources.isActive, true),
      eq(scraperSources.shouldScrapeNext, true)
    )
    if (!condition) return []
    return this.findBy(condition)
  }

  async markAsScraped(
    id: string,
    page: number,
    jobsFound: number
  ): Promise<ScraperSource | null> {
    const current = await this.findById(id)
    return this.update(id, {
      lastScrapedAt: new Date(),
      lastPageScrapped: page,
      shouldScrapeNext: false,
      totalJobsFound: (current?.totalJobsFound || 0) + jobsFound,
    })
  }
}
