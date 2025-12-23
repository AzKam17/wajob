import { AppDataSource } from '../data-source'
import { JobAdEntity } from '../entities/JobAdEntity'
import { BaseRepository } from './BaseRepository'
import { JobAdMapper } from '../mappers'
import { JobAd } from '@models/JobAd'
import { TitleTransformer } from '../../utils/title-transformer'

export class JobAdRepository extends BaseRepository<JobAdEntity> {
  constructor() {
    super(AppDataSource.getRepository(JobAdEntity))
  }

  async findByUrl(url: string): Promise<JobAdEntity | null> {
    return this.findOneBy({ url })
  }

  async findBySource(source: string): Promise<JobAdEntity[]> {
    return this.findBy({ source })
  }

  async findRecent(limit: number = 10): Promise<JobAdEntity[]> {
    return this.repository.find({
      order: { postedDate: 'DESC' },
      take: limit,
    })
  }

  // Model-based methods
  async saveModel(model: JobAd): Promise<JobAd> {
    // Transform the title before saving
    model.title = TitleTransformer.transformWithArticles(model.title)

    const entity = await this.create(JobAdMapper.toEntity(model))
    return JobAdMapper.toModel(entity)
  }

  async findModelByUrl(url: string): Promise<JobAd | null> {
    const entity = await this.findByUrl(url)
    return entity ? JobAdMapper.toModel(entity) : null
  }

  async findModelsBySource(source: string): Promise<JobAd[]> {
    const entities = await this.findBySource(source)
    return JobAdMapper.toModels(entities)
  }

  async findRecentModels(limit: number = 10): Promise<JobAd[]> {
    const entities = await this.findRecent(limit)
    return JobAdMapper.toModels(entities)
  }

  /**
   * Search jobs using PostgreSQL full-text search
   * Uses ILIKE for case-insensitive pattern matching
   * @param query - Search query
   * @param limit - Maximum number of results (default: 5)
   */
  async searchByQuery(query: string, limit: number = 5): Promise<JobAd[]> {
    const entities = await this.repository
      .createQueryBuilder('job')
      .where('job.title ILIKE :query', { query: `%${query}%` })
      .orWhere('job.description ILIKE :query', { query: `%${query}%` })
      .orderBy('job.postedDate', 'DESC')
      .take(limit)
      .getMany()

    return JobAdMapper.toModels(entities)
  }
}
