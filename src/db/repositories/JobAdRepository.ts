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
  async saveModel(model: JobAd): Promise<JobAd | null> {
    // Check if a job with the same URL already exists
    const existingJob = await this.findByUrl(model.url)

    if (existingJob) {
      const existingVersion = parseInt((existingJob.internalExtras as any)?.version || '0', 10)
      const newVersion = parseInt((model.internalExtras as any)?.version || '0', 10)

      // If new version is higher than existing version, update the job
      if (newVersion > existingVersion) {
        console.log(`[JobAdRepository] Updating job ${model.url} from version ${existingVersion} to ${newVersion}`)

        // Transform the title before saving
        model.title = TitleTransformer.transformWithArticles(model.title)

        const updatedEntity = await this.repository.save({
          ...existingJob,
          ...JobAdMapper.toEntity(model),
          id: existingJob.id,
        })
        return JobAdMapper.toModel(updatedEntity)
      }

      // Otherwise, skip saving (same version or lower version)
      console.log(`[JobAdRepository] Skipping job ${model.url} - existing version: ${existingVersion}, new version: ${newVersion}`)
      return null
    }

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
   * and fuzzy matching for typo tolerance
   *
   * Search Strategy:
   * 1. Full-text search (primary): Uses ts_vector and ts_query for exact word matching
   * 2. Fuzzy search (fallback): Uses trigram similarity to catch typos and similar strings
   *
   * Fuzzy Search Configuration:
   * - Fields: title, description, company
   * - Similarity threshold: 0.4 (40%) - strict matching
   * - Examples: "Comptabel" → "Comptable", "Developeur" → "Développeur"
   *
   * @param query - Search query
   * @param limit - Maximum number of results (default: 3)
   * @param offset - Pagination offset (default: 0)
   */
  async searchByQuery(query: string, limit: number = 3, offset: number = 0): Promise<JobAd[]> {
    // Prepare the query for ts_query (handle multiple words and French text)
    const tsQuery = query.trim().split(/\s+/).join(' & ')
    const rawQuery = query.trim()

    const entities = await this.repository
      .createQueryBuilder('job')
      .where('job.deletedAt IS NULL')
      .andWhere(
        `(
          -- Full-text search (primary)
          (
            to_tsvector('french', COALESCE(job.title, '')) ||
            to_tsvector('french', COALESCE(job.description, '')) ||
            to_tsvector('french', COALESCE(job.company, '')) ||
            to_tsvector('french', COALESCE(job.location, '')) ||
            to_tsvector('french', COALESCE(job."pageMetadata"::text, ''))
          ) @@ to_tsquery('french', :tsQuery)
          -- OR
          -- Fuzzy search using trigram similarity (catches typos and similar strings)
          -- (
          --   similarity(job.title, :rawQuery) > 0.4
          --   OR similarity(job.description, :rawQuery) > 0.4
          --   OR similarity(job.company, :rawQuery) > 0.4
          -- )
        )`,
        { tsQuery, rawQuery }
      )
      .addOrderBy(`CASE WHEN job."internalExtras"->>'version' = '2' THEN 0 ELSE 1 END`, 'ASC')
      .addOrderBy('job.postedDate', 'DESC')
      .skip(offset)
      .take(limit)
      .getMany()

    return JobAdMapper.toModels(entities)
  }

  /**
   * Find all jobs with pagination, search, and sorting
   */
  async findAllPaginated(
    page: number,
    limit: number,
    search?: string,
    sortBy: string = 'postedDate',
    sortOrder: 'ASC' | 'DESC' = 'DESC'
  ): Promise<{ jobs: JobAdEntity[]; total: number }> {
    const offset = (page - 1) * limit

    const queryBuilder = this.repository
      .createQueryBuilder('job')
      .where('job.deletedAt IS NULL')

    if (search) {
      queryBuilder.andWhere(
        '(job.title ILIKE :search OR job.company ILIKE :search OR job.location ILIKE :search OR job.description ILIKE :search OR job."pageMetadata"::text ILIKE :search)',
        { search: `%${search}%` }
      )
    }

    const [jobs, total] = await queryBuilder
      .orderBy(`CASE WHEN job."internalExtras"->>'version' = '2' THEN 0 ELSE 1 END`, 'ASC')
      .addOrderBy(`job.${sortBy}`, sortOrder)
      .skip(offset)
      .take(limit)
      .getManyAndCount()

    return { jobs, total }
  }
}
