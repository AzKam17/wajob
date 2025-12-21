import { AppDataSource } from '../data-source'
import { ScrapeSessionEntity } from '../entities/ScrapeSessionEntity'
import { BaseRepository } from './BaseRepository'

export class ScrapeSessionRepository extends BaseRepository<ScrapeSessionEntity> {
  constructor() {
    super(AppDataSource.getRepository(ScrapeSessionEntity))
  }

  async findBySessionId(sessionId: string): Promise<ScrapeSessionEntity | null> {
    return this.findOneBy({ sessionId })
  }

  async findBySource(sourceName: string): Promise<ScrapeSessionEntity[]> {
    return this.findBy({ sourceName })
  }

  async findByStatus(
    status: 'pending' | 'in_progress' | 'completed' | 'failed'
  ): Promise<ScrapeSessionEntity[]> {
    return this.findBy({ status })
  }

  async findRecent(limit: number = 10): Promise<ScrapeSessionEntity[]> {
    return this.repository.find({
      order: { startedAt: 'DESC' },
      take: limit,
    })
  }

  async markCompleted(
    sessionId: string,
    pagesScraped: number,
    jobsFound: number
  ): Promise<ScrapeSessionEntity | null> {
    const session = await this.findBySessionId(sessionId)
    if (!session) return null

    return this.update(session.id, {
      status: 'completed',
      completedAt: new Date(),
      pagesScraped,
      jobsFound,
    })
  }

  async markFailed(
    sessionId: string,
    error: string
  ): Promise<ScrapeSessionEntity | null> {
    const session = await this.findBySessionId(sessionId)
    if (!session) return null

    const currentErrors = session.errors || []
    currentErrors.push(error)

    return this.update(session.id, {
      status: 'failed',
      completedAt: new Date(),
      errors: currentErrors,
    })
  }
}
