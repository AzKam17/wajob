import { AppDataSource } from '../data-source'
import { JobAdEntity } from '../entities/JobAdEntity'
import { BaseRepository } from './BaseRepository'

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
}
