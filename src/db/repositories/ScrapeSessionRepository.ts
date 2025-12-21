import { BaseRepository } from './BaseRepository'
import {
  scrapeSessions,
  type ScrapeSession,
  type NewScrapeSession,
} from '../schema/scrapeSessions'
import { eq, and, desc } from 'drizzle-orm'
import { db } from '../index'

export class ScrapeSessionRepository extends BaseRepository<
  ScrapeSession,
  NewScrapeSession
> {
  constructor() {
    super(scrapeSessions)
  }

  async findBySessionId(sessionId: string): Promise<ScrapeSession | null> {
    return this.findOneBy(eq(scrapeSessions.sessionId, sessionId))
  }

  async findBySource(sourceName: string): Promise<ScrapeSession[]> {
    return this.findBy(eq(scrapeSessions.sourceName, sourceName))
  }

  async findByStatus(status: string): Promise<ScrapeSession[]> {
    return this.findBy(eq(scrapeSessions.status, status))
  }

  async findRecent(limit: number = 10): Promise<ScrapeSession[]> {
    const result = await db
      .select()
      .from(scrapeSessions)
      .where(eq(scrapeSessions.deletedAt, null))
      .orderBy(desc(scrapeSessions.startedAt))
      .limit(limit)

    return result as ScrapeSession[]
  }

  async markCompleted(
    sessionId: string,
    pagesScraped: number,
    jobsFound: number
  ): Promise<ScrapeSession | null> {
    const session = await this.findBySessionId(sessionId)
    if (!session) return null

    return this.update(session.id, {
      status: 'completed',
      completedAt: new Date(),
      pagesScraped,
      jobsFound,
    })
  }

  async markFailed(sessionId: string, error: string): Promise<ScrapeSession | null> {
    const session = await this.findBySessionId(sessionId)
    if (!session) return null

    const currentErrors = session.errors ? JSON.parse(session.errors) : []
    currentErrors.push(error)

    return this.update(session.id, {
      status: 'failed',
      completedAt: new Date(),
      errors: JSON.stringify(currentErrors),
    })
  }
}
