import { ScrapeSession } from '@models/ScrapeSession'
import { ScrapeSessionEntity } from '../entities/ScrapeSessionEntity'
import { BaseMapper } from './BaseMapper'

class ScrapeSessionMapperClass extends BaseMapper<
  ScrapeSession,
  ScrapeSessionEntity
> {
  toEntity(model: ScrapeSession): Partial<ScrapeSessionEntity> {
    return {
      ...this.mapBaseToEntity(model),
      sessionId: model.sessionId,
      sourceId: model.sourceId,
      sourceName: model.sourceName,
      mode: model.mode,
      status: model.status,
      startedAt: model.startedAt,
      completedAt: model.completedAt,
      pagesScraped: model.pagesScraped,
      jobsFound: model.jobsFound,
      errors: model.errors,
    }
  }

  toModel(entity: ScrapeSessionEntity): ScrapeSession {
    const model = new ScrapeSession({
      sourceName: entity.sourceName,
      mode: entity.mode as any,
      status: entity.status as any,
      startedAt: entity.startedAt,
      completedAt: entity.completedAt,
      pagesScraped: entity.pagesScraped,
      jobsFound: entity.jobsFound,
      errors: entity.errors || [],
    })

    // Set base fields and session-specific fields
    model.id = entity.id
    model.createdAt = entity.createdAt
    model.updatedAt = entity.updatedAt
    model.sessionId = entity.sessionId
    model.sourceId = entity.sourceId

    return model
  }
}

export const ScrapeSessionMapper = new ScrapeSessionMapperClass()
