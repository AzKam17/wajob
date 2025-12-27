import { initializeDatabase } from '../db'
import { startScrapeWorker } from './scrape.worker'
import { startWhatsAppMessageWorker } from './whatsapp-message.worker'
import { closeRedisConnection } from '@config/redis'
import { closeScrapeQueue } from '../queues/scrape.queue'
import { closeWhatsAppMessageQueue } from '../queues/whatsapp-message.queue'
import { ScraperSourceRepository } from '../db/repositories/ScraperSourceRepository'
import { ScrapeSchedulerService } from '../services/scrape-scheduler.service'
import { Logger } from '../utils/logger'
import { Cron } from 'croner'

// Initialize database
await initializeDatabase()
Logger.success('Database initialized')

// Start BullMQ workers
const scrapeWorker = startScrapeWorker(
  process.env.REDIS_HOST || 'localhost',
  parseInt(process.env.REDIS_PORT || '6379'),
  process.env.REDIS_PASSWORD
)

const whatsappWorker = startWhatsAppMessageWorker(
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

// Set up periodic scrape checks using cron
// Weekday schedule: Every 20 minutes, Mon-Fri 9am-8pm
const weekdayCron = new Cron(
  process.env.SCRAPE_CHECK_CRON || '*/20 9-19 * * 1-5',
  async () => {
    Logger.info('Running periodic scrape check (weekday)')
    await scheduler.checkAndEnqueueScrapingTasks()
  }
)

// Weekend schedule: 10am & 4pm on Sat-Sun
const weekendCron = new Cron(
  process.env.SCRAPE_CHECK_CRON_WEEKEND || '0 10,16 * * 0,6',
  async () => {
    Logger.info('Running periodic scrape check (weekend)')
    await scheduler.checkAndEnqueueScrapingTasks()
  }
)

Logger.success('Standalone worker started with cron-based scrape checks (Mon-Fri 9am-8pm every 20min, Sat-Sun 10am & 4pm)')

const shutdown = async (signal: string) => {
  Logger.info(`${signal} received, shutting down workers gracefully`)
  weekdayCron.stop()
  weekendCron.stop()
  await scrapeWorker.close()
  await whatsappWorker.close()
  await closeScrapeQueue()
  await closeWhatsAppMessageQueue()
  await closeRedisConnection()
  process.exit(0)
}

process.on('SIGTERM', () => shutdown('SIGTERM'))
process.on('SIGINT', () => shutdown('SIGINT'))
