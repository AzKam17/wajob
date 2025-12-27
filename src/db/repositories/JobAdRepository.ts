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
   * Search jobs using PostgreSQL full-text search with French language support
   * Uses ts_vector and ts_query for better search quality
   * @param query - Search query
   * @param limit - Maximum number of results (default: 3)
   * @param offset - Pagination offset (default: 0)
   */
  async searchByQuery(query: string, limit: number = 3, offset: number = 0): Promise<JobAd[]> {
    // Prepare the query for ts_query (handle multiple words and French text)
    const tsQuery = query.trim().split(/\s+/).join(' & ')

    const entities = await this.repository
      .createQueryBuilder('job')
      .where('job.deletedAt IS NULL')
      .andWhere(
        `(
          to_tsvector('french', COALESCE(job.title, '')) ||
          to_tsvector('french', COALESCE(job.description, '')) ||
          to_tsvector('french', COALESCE(job.company, '')) ||
          to_tsvector('french', COALESCE(job.location, ''))
        ) @@ to_tsquery('french', :tsQuery)`,
        { tsQuery }
      )
      .orderBy('job.postedDate', 'DESC')
      .skip(offset)
      .take(limit)
      .getMany()

    return JobAdMapper.toModels(entities)
  }
}
