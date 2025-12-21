import { ScraperSourceRepository } from '@/db/repositories/ScraperSourceRepository'
import { getScrapeQueue } from '../queues/scrape.queue'

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
    console.log('\n⏰ Checking for sources that need scraping...')

    try {
      // Get all active sources
      const activeSources = await this.scraperSourceRepo.findActiveModels()

      if (activeSources.length === 0) {
        console.log('ℹ️  No active scraper sources found')
        return
      }

      console.log(`📋 Found ${activeSources.length} active source(s)`)

      const now = new Date()
      const queue = getScrapeQueue(
        this.redisHost,
        this.redisPort,
        this.redisPassword
      )

      let enqueuedCount = 0

      for (const source of activeSources) {
        const shouldScrape = this.shouldScrapeNow(source, now)

        if (shouldScrape.should) {
          // Enqueue scraping job
          await queue.add(`scrape-${source.name}`, {
            sourceId: source.id!,
            sourceName: source.name,
            maxPages: source.maxPages || this.maxPagesPerScrape,
          })

          enqueuedCount++

          console.log(`
🚀 ENQUEUED: ${source.name}
   Reason: ${shouldScrape.reason}
   Next check: ${this.getNextScrapeTime(source, now).toISOString()}
          `)
        } else {
          console.log(`
⏸️  SKIPPED: ${source.name}
   Reason: ${shouldScrape.reason}
   Next scrape: ${this.getNextScrapeTime(source, now).toISOString()}
          `)
        }
      }

      if (enqueuedCount > 0) {
        console.log(`\n✅ Enqueued ${enqueuedCount} scraping job(s)`)
      } else {
        console.log('\nℹ️  No sources need scraping at this time')
      }
    } catch (error) {
      console.error('❌ Error checking scraping tasks:', error)
      throw error
    }
  }

  private shouldScrapeNow(
    source: any,
    now: Date
  ): { should: boolean; reason: string } {
    // Check if manually flagged to scrape
    if (source.shouldScrapeNext) {
      return { should: true, reason: 'Manually flagged for scraping' }
    }

    // If never scraped before, scrape now
    if (!source.lastScrapedAt) {
      return { should: true, reason: 'Never scraped before' }
    }

    // Check if enough time has passed based on scrape interval
    const intervalMinutes =
      source.scrapeInterval || this.defaultScrapeIntervalMinutes
    const timeSinceLastScrape =
      (now.getTime() - new Date(source.lastScrapedAt).getTime()) / (1000 * 60)

    if (timeSinceLastScrape >= intervalMinutes) {
      return {
        should: true,
        reason: `${Math.floor(timeSinceLastScrape)} minutes elapsed (interval: ${intervalMinutes}m)`,
      }
    }

    const remainingMinutes = Math.ceil(intervalMinutes - timeSinceLastScrape)
    return {
      should: false,
      reason: `Only ${Math.floor(timeSinceLastScrape)} minutes elapsed, need ${intervalMinutes}m (${remainingMinutes}m remaining)`,
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
