import { Elysia } from 'elysia'
import { cron } from '@elysiajs/cron'
import { env } from '@yolk-oss/elysia-env'
import { envSchema } from '@config/env.schema'
import { initializeDatabase } from './db'
import { ScraperSourceRepository } from './db/repositories/ScraperSourceRepository'
import { PersonalizedLinkRepository } from './db/repositories/PersonalizedLinkRepository'
import { BotUserRepository } from './db/repositories/BotUserRepository'
import { ScrapeSchedulerService } from './services/scrape-scheduler.service'
import { startScrapeWorker, stopScrapeWorker } from './workers/scrape.worker'
import { closeRedisConnection } from '@config/redis'
import { closeScrapeQueue } from './queues/scrape.queue'
import { Logger } from './utils/logger'

// Initialize database
await initializeDatabase()
Logger.success('Database initialized')

const app = new Elysia()
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
      pattern: '*/5 * * * *', // Every 5 minutes
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
  .post('/api/users', async ({ body, set }) => {
    const botUserRepo = new BotUserRepository()

    const { phoneNumber, preferences } = body as { phoneNumber: string; preferences?: Record<string, any> }

    if (!phoneNumber) {
      set.status = 400
      return { error: 'Phone number is required' }
    }

    const existingUser = await botUserRepo.findByPhoneNumber(phoneNumber)
    if (existingUser) {
      set.status = 409
      return { error: 'User already exists', user: existingUser }
    }

    const user = await botUserRepo.create({
      phoneNumber,
      preferences: preferences || {},
    })

    set.status = 201
    return { user }
  })
  .post('/api/links', async ({ body, set }) => {
    const linkRepo = new PersonalizedLinkRepository()

    const { phoneNumber, jobAdId, jobAdUrl } = body as { phoneNumber: string; jobAdId: string; jobAdUrl: string }

    if (!phoneNumber || !jobAdId || !jobAdUrl) {
      set.status = 400
      return { error: 'phoneNumber, jobAdId, and jobAdUrl are required' }
    }

    const link = await linkRepo.create({
      phoneNumber,
      jobAdId,
      jobAdUrl,
      clickCount: 0,
      isActive: true,
      metadata: {},
    })

    set.status = 201
    return {
      link,
      url: `${process.env.BASE_URL || 'http://localhost:3000'}/${link.id}`
    }
  })
  .get('/:id', async ({ params: { id }, request, set }) => {
    const linkRepo = new PersonalizedLinkRepository()

    const link = await linkRepo.findById(id)

    if (!link) {
      set.status = 404
      return { error: 'Link not found' }
    }

    if (!link.isActive) {
      set.status = 410
      return { error: 'Link is no longer active' }
    }

    const metadata = {
      timestamp: new Date().toISOString(),
      userAgent: request.headers.get('user-agent') || '',
      referer: request.headers.get('referer') || '',
      ip: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || '',
      acceptLanguage: request.headers.get('accept-language') || '',
    }

    await linkRepo.incrementClickCount(id, metadata)

    set.status = 302
    set.headers['Location'] = link.jobAdUrl
    set.headers['Cache-Control'] = 'no-store, no-cache, must-revalidate, proxy-revalidate'
    set.headers['Pragma'] = 'no-cache'
    set.headers['Expires'] = '0'
    return
  })
  .listen(parseInt(process.env.PORT || '3000'))

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
