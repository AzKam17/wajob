import { ScraperSource } from '@models/ScraperSource'
import { ScraperSourceEntity } from '../entities/ScraperSourceEntity'
import { BaseMapper } from './BaseMapper'

class ScraperSourceMapperClass extends BaseMapper<
  ScraperSource,
  ScraperSourceEntity
> {
  toEntity(model: ScraperSource): Partial<ScraperSourceEntity> {
    return {
      ...this.mapBaseToEntity(model),
      name: model.name,
      url: model.url,
      lastScrapedAt: model.lastScrapedAt,
      lastPageScrapped: model.lastPageScrapped || 0,
      isActive: model.isActive,
      shouldScrapeNext: model.shouldScrapeNext,
      scrapeInterval: model.scrapeInterval,
      maxPages: model.maxPages,
      totalJobsFound: model.totalJobsFound || 0,
    }
  }

  toModel(entity: ScraperSourceEntity): ScraperSource {
    const model = new ScraperSource({
      name: entity.name,
      url: entity.url,
      lastScrapedAt: entity.lastScrapedAt,
      lastPageScrapped: entity.lastPageScrapped,
      isActive: entity.isActive,
      shouldScrapeNext: entity.shouldScrapeNext,
      scrapeInterval: entity.scrapeInterval,
      maxPages: entity.maxPages,
      totalJobsFound: entity.totalJobsFound,
    })

    // Set base fields
    model.id = entity.id
    model.createdAt = entity.createdAt
    model.updatedAt = entity.updatedAt

    return model
  }
}

export const ScraperSourceMapper = new ScraperSourceMapperClass()
