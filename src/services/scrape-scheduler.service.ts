import { ScraperSourceRepository } from '@/db/repositories/ScraperSourceRepository'
import { getScrapeQueue } from '../queues/scrape.queue'
import { Logger } from '../utils/logger'

export class ScrapeSchedulerService {
  constructor(
    private scraperSourceRepo: ScraperSourceRepository,
    private redisHost: string,
    private redisPort: number,
    private redisPassword?: string,
    private defaultScrapeIntervalMinutes: number = 30,
    private maxPagesPerScrape: number = 3
  ) {}

  async checkAndEnqueueScrapingTasks(): Promise<void> {
    Logger.info('Checking for sources that need scraping')

    try {
      const activeSources = await this.scraperSourceRepo.findActiveModels()

      if (activeSources.length === 0) {
        Logger.info('No active scraper sources found')
        return
      }

      Logger.info('Found active sources', {
        count: activeSources.length,
      })

      const now = new Date()
      const queue = getScrapeQueue(
        this.redisHost,
        this.redisPort,
        this.redisPassword
      )

      let enqueuedCount = 0
      const results: any[] = []

      for (const source of activeSources) {
        const shouldScrape = this.shouldScrapeNow(source, now)

        if (shouldScrape.should) {
          await queue.add(`scrape-${source.name}`, {
            sourceId: source.id!,
            sourceName: source.name,
            maxPages: source.maxPages || this.maxPagesPerScrape,
          })

          enqueuedCount++

          Logger.success('Source enqueued for scraping', {
            source: source.name,
            reason: shouldScrape.reason,
            nextCheck: this.getNextScrapeTime(source, now).toISOString(),
          })

          results.push({
            source: source.name,
            action: 'enqueued',
            reason: shouldScrape.reason,
          })
        } else {
          Logger.debug('Source skipped', {
            source: source.name,
            reason: shouldScrape.reason,
            nextScrape: this.getNextScrapeTime(source, now).toISOString(),
          })

          results.push({
            source: source.name,
            action: 'skipped',
            reason: shouldScrape.reason,
          })
        }
      }

      if (enqueuedCount > 0) {
        Logger.success('Scraping tasks enqueued', {
          enqueued: enqueuedCount,
          total: activeSources.length,
        })
      } else {
        Logger.info('No sources need scraping at this time')
      }
    } catch (error) {
      Logger.error('Error checking scraping tasks', { error })
      throw error
    }
  }

  private shouldScrapeNow(
    source: any,
    now: Date
  ): { should: boolean; reason: string } {
    if (source.shouldScrapeNext) {
      return { should: true, reason: 'Manually flagged for scraping' }
    }

    if (!source.lastScrapedAt) {
      return { should: true, reason: 'Never scraped before' }
    }

    const intervalMinutes =
      source.scrapeInterval || this.defaultScrapeIntervalMinutes
    const timeSinceLastScrape =
      (now.getTime() - new Date(source.lastScrapedAt).getTime()) / (1000 * 60)

    if (timeSinceLastScrape >= intervalMinutes) {
      return {
        should: true,
        reason: `${Math.floor(timeSinceLastScrape)}m elapsed (interval: ${intervalMinutes}m)`,
      }
    }

    const remainingMinutes = Math.ceil(intervalMinutes - timeSinceLastScrape)
    return {
      should: false,
      reason: `${Math.floor(timeSinceLastScrape)}m/${intervalMinutes}m (${remainingMinutes}m remaining)`,
    }
  }

  private getNextScrapeTime(source: any, now: Date): Date {
    if (source.shouldScrapeNext) {
      return now
    }

    if (!source.lastScrapedAt) {
      return now
    }

    const intervalMinutes =
      source.scrapeInterval || this.defaultScrapeIntervalMinutes
    const lastScrape = new Date(source.lastScrapedAt)
    return new Date(lastScrape.getTime() + intervalMinutes * 60 * 1000)
  }
}
