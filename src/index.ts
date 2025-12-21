import { Elysia } from 'elysia'
import { cron } from '@elysiajs/cron'
import { env } from '@yolk-oss/elysia-env'
import { envSchema } from '@config/env.schema'
import { initializeDatabase } from './db'
import { ScraperSourceRepository } from './db/repositories/ScraperSourceRepository'
import { ScrapeSchedulerService } from './services/scrape-scheduler.service'
import { startScrapeWorker } from './workers/scrape.worker'
import { closeRedisConnection } from '@config/redis'
import { closeScrapeQueue } from './queues/scrape.queue'

// Initialize database
await initializeDatabase()

const app = new Elysia()
  .use(env(envSchema))
  .decorate('scraperSourceRepo', new ScraperSourceRepository())
  .onStart(async (context) => {
    console.log('🚀 Starting application...')

    const envVars = context.env as any

    // Start BullMQ worker
    startScrapeWorker(
      envVars.REDIS_HOST,
      parseInt(envVars.REDIS_PORT),
      envVars.REDIS_PASSWORD
    )

    console.log('✅ Application started successfully')
  })
  .use(
    cron({
      name: 'scrape-checker',
      pattern: '*/5 * * * *', // Every 5 minutes
      async run() {
        const envVars = process.env
        const scraperSourceRepo = new ScraperSourceRepository()

        const scheduler = new ScrapeSchedulerService(
          scraperSourceRepo,
          envVars.REDIS_HOST || 'localhost',
          parseInt(envVars.REDIS_PORT || '6379'),
          envVars.REDIS_PASSWORD,
          parseInt(envVars.DEFAULT_SCRAPE_INTERVAL_MINUTES || '30'),
          parseInt(envVars.MAX_PAGES_PER_SCRAPE || '3')
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
process.on('SIGTERM', async () => {
  console.log('SIGTERM received, shutting down gracefully...')
  await closeScrapeQueue()
  await closeRedisConnection()
  process.exit(0)
})

process.on('SIGINT', async () => {
  console.log('SIGINT received, shutting down gracefully...')
  await closeScrapeQueue()
  await closeRedisConnection()
  process.exit(0)
})

console.log(
  `🦊 Elysia is running at ${app.server?.hostname}:${app.server?.port}`
)
