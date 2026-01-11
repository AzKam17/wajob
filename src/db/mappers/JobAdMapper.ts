import { JobAd } from '@models/JobAd'
import { JobAdEntity } from '../entities/JobAdEntity'
import { BaseMapper } from './BaseMapper'

class JobAdMapperClass extends BaseMapper<JobAd, JobAdEntity> {
  private stripHtml(text: string | undefined): string | undefined {
    if (!text) return text

    return text
      .replace(/<[^>]*>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
  }

  toEntity(model: JobAd): Partial<JobAdEntity> {
    return {
      ...this.mapBaseToEntity(model),
      title: model.title,
      company: model.company,
      location: model.location,
      description: this.stripHtml(model.description),
      url: model.url,
      postedDate: model.postedDate,
      source: model.source,
      pageMetadata: model.pageMetadata,
      internalExtras: { version: '2', ...model.internalExtras },
    }
  }

  toModel(entity: JobAdEntity): JobAd {
    const model = new JobAd({
      title: entity.title,
      company: entity.company,
      location: entity.location,
      description: entity.description,
      url: entity.url,
      postedDate: entity.postedDate,
      source: entity.source,
      pageMetadata: entity.pageMetadata,
      internalExtras: entity.internalExtras,
    })

    // Set base fields
    model.id = entity.id
    model.createdAt = entity.createdAt
    model.updatedAt = entity.updatedAt

    return model
  }
}

export const JobAdMapper = new JobAdMapperClass()
