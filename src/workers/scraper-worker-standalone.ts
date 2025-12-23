import { initializeDatabase } from '../db'
import { startScrapeWorker } from './scrape.worker'
import { closeRedisConnection } from '@config/redis'
import { closeScrapeQueue } from '../queues/scrape.queue'
import { ScraperSourceRepository } from '../db/repositories/ScraperSourceRepository'
import { ScrapeSchedulerService } from '../services/scrape-scheduler.service'
import { Logger } from '../utils/logger'

// Initialize database
await initializeDatabase()
Logger.success('Database initialized')

// Start scrape worker
const scrapeWorker = startScrapeWorker(
  process.env.REDIS_HOST || 'localhost',
  parseInt(process.env.REDIS_PORT || '6379'),
  process.env.REDIS_PASSWORD
)

// Run initial scrape check on startup
const scraperSourceRepo = new ScraperSourceRepository()
const scheduler = new ScrapeSchedulerService(
  scraperSourceRepo,
  process.env.REDIS_HOST || 'localhost',
  parseInt(process.env.REDIS_PORT || '6379'),
  process.env.REDIS_PASSWORD,
  parseInt(process.env.DEFAULT_SCRAPE_INTERVAL_MINUTES || '30'),
  parseInt(process.env.MAX_PAGES_PER_SCRAPE || '3')
)
await scheduler.checkAndEnqueueScrapingTasks()
Logger.success('Initial scrape check completed')

// Set up periodic scrape checks (every 20 minutes)
const checkInterval = setInterval(async () => {
  Logger.info('Running periodic scrape check')
  await scheduler.checkAndEnqueueScrapingTasks()
}, 20 * 60 * 1000) // 20 minutes in milliseconds

Logger.success('Scraper worker started with periodic scrape checks')

const shutdown = async (signal: string) => {
  Logger.info(`${signal} received, shutting down scraper worker gracefully`)
  clearInterval(checkInterval)
  await scrapeWorker.close()
  await closeScrapeQueue()
  await closeRedisConnection()
  process.exit(0)
}

process.on('SIGTERM', () => shutdown('SIGTERM'))
process.on('SIGINT', () => shutdown('SIGINT'))
