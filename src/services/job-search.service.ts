import { JobAdRepository } from '../db/repositories/JobAdRepository'
import { PersonalizedLinkRepository } from '../db/repositories/PersonalizedLinkRepository'
import { JobAd } from '../models/JobAd'
import { Logger } from '../utils/logger'

export interface JobSearchResult {
  title: string
  company: string
  location: string
  linkId: string
}

/**
 * Job Search Service using PostgreSQL full-text search
 * Always returns max 3 results per page
 */
export class JobSearchService {
  private jobRepo = new JobAdRepository()
  private linkRepo = new PersonalizedLinkRepository()
  private readonly MAX_RESULTS = 3

  /**
   * Search for jobs using PostgreSQL full-text search
   * @param query - Search query from user
   * @param phoneNumber - User's phone number for personalized links
   * @param offset - Pagination offset (default: 0)
   * @returns Array of max 3 job results with personalized links
   */
  async searchJobs(query: string, phoneNumber: string, offset: number = 0): Promise<JobSearchResult[]> {
    try {
      Logger.info('Searching for jobs', { query, phoneNumber, offset })

      // Use PostgreSQL full-text search on title field
      // This uses the ILIKE operator for case-insensitive pattern matching
      const jobs = await this.jobRepo.searchByQuery(query, this.MAX_RESULTS, offset)

      if (jobs.length === 0) {
        Logger.info('No jobs found', { query })
        return []
      }

      // Create personalized links for each job
      const results: JobSearchResult[] = []
      for (const job of jobs) {
        const link = await this.linkRepo.create({
          phoneNumber,
          jobAdId: job.id,
          jobAdUrl: job.url,
          clickCount: 0,
          isActive: true,
          metadata: {
            query,
            timestamp: new Date().toISOString()
          }
        })

        results.push({
          title: job.title,
          company: job.company || 'Non spécifié',
          location: job.location || 'Non spécifié',
          linkId: link.id
        })
      }

      Logger.success('Jobs found and personalized links created', {
        query,
        count: results.length
      })

      return results
    } catch (error) {
      Logger.error('Error searching for jobs', { error, query })
      throw error
    }
  }

  /**
   * Search for similar jobs when exact match not found
   * Uses broader search criteria
   */
  async searchSimilarJobs(query: string, phoneNumber: string, offset: number = 0): Promise<JobSearchResult[]> {
    try {
      Logger.info('Searching for similar jobs', { query, phoneNumber, offset })

      // Extract keywords from query (simple split for now)
      const keywords = query.toLowerCase().split(/\s+/)
      const mainKeyword = keywords[0] // Use first word as main keyword

      const jobs = await this.jobRepo.searchByQuery(mainKeyword, this.MAX_RESULTS, offset)

      if (jobs.length === 0) {
        return []
      }

      // Create personalized links
      const results: JobSearchResult[] = []
      for (const job of jobs) {
        const link = await this.linkRepo.create({
          phoneNumber,
          jobAdId: job.id,
          jobAdUrl: job.url,
          clickCount: 0,
          isActive: true,
          metadata: {
            query,
            similarSearch: true,
            timestamp: new Date().toISOString()
          }
        })

        results.push({
          title: job.title,
          company: job.company || 'Non spécifié',
          location: job.location || 'Non spécifié',
          linkId: link.id
        })
      }

      Logger.success('Similar jobs found', {
        query,
        count: results.length
      })

      return results
    } catch (error) {
      Logger.error('Error searching for similar jobs', { error, query })
      throw error
    }
  }
}
