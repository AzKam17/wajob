import { Elysia } from 'elysia'
import { cron } from '@elysiajs/cron'
import { elylog } from '@eajr/elylog'
import { env } from '@yolk-oss/elysia-env'
import { envSchema } from '@config/env.schema'
import { initializeDatabase } from './db'
import { ScraperSourceRepository } from './db/repositories/ScraperSourceRepository'
import { ScrapeSchedulerService } from './services/scrape-scheduler.service'
import { startScrapeWorker, stopScrapeWorker } from './workers/scrape.worker'
import { closeRedisConnection } from '@config/redis'
import { closeScrapeQueue } from './queues/scrape.queue'
import { Logger } from './utils/logger'

// Initialize database
await initializeDatabase()
Logger.success('Database initialized')

const app = new Elysia()
  .use(elylog())
  .use(env(envSchema))
  .decorate('scraperSourceRepo', new ScraperSourceRepository())
  .onStart(async () => {
    Logger.info('Starting application')

    // Start BullMQ worker
    startScrapeWorker(
      process.env.REDIS_HOST || 'localhost',
      parseInt(process.env.REDIS_PORT || '6379'),
      process.env.REDIS_PASSWORD
    )

    Logger.success('Application started successfully')
  })
  .use(
    cron({
      name: 'scrape-checker',
      pattern: '* */2 * * * *', // Every 2 minutes
      async run() {
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
      },
    })
  )
  .get('/', () => {
    return {
      status: 'running',
      message: 'WA Jobs Scraper API',
      endpoints: {
        health: '/health',
      },
    }
  })
  .get('/health', () => {
    return {
      status: 'healthy',
      timestamp: new Date().toISOString(),
    }
  })
  .listen(parseInt(process.env.PORT || '3000'))

// Graceful shutdown
const shutdown = async (signal: string) => {
  Logger.info(`${signal} received, shutting down gracefully`)
  await stopScrapeWorker()
  await closeScrapeQueue()
  await closeRedisConnection()
  process.exit(0)
}

process.on('SIGTERM', () => shutdown('SIGTERM'))
process.on('SIGINT', () => shutdown('SIGINT'))

Logger.success('Server running', {
  host: app.server?.hostname,
  port: app.server?.port,
})
