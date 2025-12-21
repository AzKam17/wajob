import { JobAd } from '@models/JobAd'
import { JobAdEntity } from '../entities/JobAdEntity'
import { BaseMapper } from './BaseMapper'

class JobAdMapperClass extends BaseMapper<JobAd, JobAdEntity> {
  toEntity(model: JobAd): Partial<JobAdEntity> {
    return {
      ...this.mapBaseToEntity(model),
      title: model.title,
      url: model.url,
      postedDate: model.postedDate,
      source: model.source,
    }
  }

  toModel(entity: JobAdEntity): JobAd {
    const model = new JobAd({
      title: entity.title,
      url: entity.url,
      postedDate: entity.postedDate,
      source: entity.source,
    })

    // Set base fields
    model.id = entity.id
    model.createdAt = entity.createdAt
    model.updatedAt = entity.updatedAt

    return model
  }
}

export const JobAdMapper = new JobAdMapperClass()
