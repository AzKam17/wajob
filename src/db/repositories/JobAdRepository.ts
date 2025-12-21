import { BaseRepository } from './BaseRepository'
import { jobAds, type JobAd, type NewJobAd } from '../schema/jobAds'
import { eq } from 'drizzle-orm'

export class JobAdRepository extends BaseRepository<JobAd, NewJobAd> {
  constructor() {
    super(jobAds)
  }

  async findByUrl(url: string): Promise<JobAd | null> {
    return this.findOneBy(eq(jobAds.url, url))
  }

  async findBySource(source: string): Promise<JobAd[]> {
    return this.findBy(eq(jobAds.source, source))
  }

  async findRecent(limit: number = 10): Promise<JobAd[]> {
    const result = await this.findAll()
    return result
      .sort(
        (a, b) =>
          new Date(b.postedDate).getTime() - new Date(a.postedDate).getTime()
      )
      .slice(0, limit)
  }
}
