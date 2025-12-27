import { Elysia } from 'elysia'
import { env } from '@yolk-oss/elysia-env'
import { envSchema } from '@config/env.schema'
import { initializeDatabase } from './db'
import { ScraperSourceRepository } from './db/repositories/ScraperSourceRepository'
import { PersonalizedLinkRepository } from './db/repositories/PersonalizedLinkRepository'
import { BotUserRepository } from './db/repositories/BotUserRepository'
import { WhatsAppMessageService } from './services/whatsapp-message.service'
import { ConversationStateService } from './services/conversation-state.service'
import { ChatHistoryService } from './services/chat-history.service'
import { ScrapeSchedulerService } from './services/scrape-scheduler.service'
import { getWhatsAppMessageQueue, closeWhatsAppMessageQueue } from './queues/whatsapp-message.queue'
import { getRedisConnection } from '@config/redis'
import { Logger } from './utils/logger'

// Initialize database
await initializeDatabase()
Logger.success('Database initialized')

// Initialize Redis connection for services
const redis = getRedisConnection(
  process.env.REDIS_HOST || 'localhost',
  parseInt(process.env.REDIS_PORT || '6379'),
  process.env.REDIS_PASSWORD
)

// Initialize conversation services
const conversationStateService = new ConversationStateService(redis)
const chatHistoryService = new ChatHistoryService(redis)
Logger.success('Conversation services initialized')

// Initialize WhatsApp message queue
const whatsappQueue = getWhatsAppMessageQueue(
  process.env.REDIS_HOST || 'localhost',
  parseInt(process.env.REDIS_PORT || '6379'),
  process.env.REDIS_PASSWORD
)

const app = new Elysia()
  .use(env(envSchema))
  .decorate('scraperSourceRepo', new ScraperSourceRepository())
  .onStart(async () => {
    Logger.info('Starting application')
    Logger.success('Application started successfully')
  })
  .get('/', () => {
    return {
      status: 'running',
      message: 'WA Jobs Scraper API',
      endpoints: {
      },
    }
  })
  .get('/health', () => {
    return {
      status: 'healthy',
      timestamp: new Date().toISOString(),
    }
  })
  .get('/webhook/test', () => {
    Logger.info('Webhook test endpoint called')
    return {
      status: 'ok',
      message: 'Webhook endpoint is reachable',
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
      url: `${process.env.APP_URL || 'http://localhost:3000'}/${link.id}`
    }
  })
  .get('/webhook/whatsapp', async ({ query, set }) => {
    const whatsappService = new WhatsAppMessageService(conversationStateService, chatHistoryService)
    const mode = query['hub.mode']
    const token = query['hub.verify_token']
    const challenge = query['hub.challenge']

    if (!mode || !token) {
      set.status = 400
      return { error: 'Missing required query parameters' }
    }

    const verified = await whatsappService.verifyWebhook(mode, token, challenge)

    if (verified) {
      set.status = 200
      return challenge
    }

    set.status = 403
    return { error: 'Verification failed' }
  })
  .post('/webhook/whatsapp', async ({ body, set }) => {
    try {
      Logger.info('Received WhatsApp webhook - enqueueing message', { body })

      // Enqueue the message for processing instead of processing synchronously
      await whatsappQueue.add('process-message', {
        payload: body,
        receivedAt: new Date().toISOString(),
      })

      Logger.success('WhatsApp message enqueued successfully')

      set.status = 200
      return { success: true }
    } catch (error) {
      Logger.error('Error enqueueing WhatsApp message', { error })
      set.status = 500
      return { error: 'Internal server error' }
    }
  })
  .post('/api/scrape/trigger', async ({ set }) => {
    try {
      Logger.info('Manual scrape trigger requested')

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

      Logger.success('Scraping tasks triggered successfully')

      set.status = 200
      return {
        success: true,
        message: 'Scraping tasks enqueued. Check scraper worker logs for progress.',
        timestamp: new Date().toISOString(),
      }
    } catch (error) {
      Logger.error('Error triggering scrape', { error })
      set.status = 500
      return { error: 'Failed to trigger scraping tasks' }
    }
  })
  .get('/api/conversations/:phoneNumber', async ({ params, query, set }) => {
    try {
      const { phoneNumber } = params
      const limit = parseInt((query.limit as string) || '20')
      const offset = parseInt((query.offset as string) || '0')

      const conversations = await chatHistoryService.getUserConversations(phoneNumber, limit, offset)

      return {
        phoneNumber,
        conversations,
        limit,
        offset,
      }
    } catch (error) {
      Logger.error('Error fetching conversations', { error })
      set.status = 500
      return { error: 'Failed to fetch conversations' }
    }
  })
  .get('/api/conversations/:phoneNumber/:conversationId', async ({ params, set }) => {
    try {
      const { conversationId } = params

      const conversation = await chatHistoryService.getConversationFromDatabase(conversationId)

      if (!conversation) {
        set.status = 404
        return { error: 'Conversation not found' }
      }

      return conversation
    } catch (error) {
      Logger.error('Error fetching conversation', { error })
      set.status = 500
      return { error: 'Failed to fetch conversation' }
    }
  })
  .get('/api/conversations/:phoneNumber/stats', async ({ params, set }) => {
    try {
      const { phoneNumber } = params

      const stats = await chatHistoryService.getConversationStats(phoneNumber)

      return {
        phoneNumber,
        stats,
      }
    } catch (error) {
      Logger.error('Error fetching conversation stats', { error })
      set.status = 500
      return { error: 'Failed to fetch conversation stats' }
    }
  })
  .get('/api/messages/:phoneNumber', async ({ params, query, set }) => {
    try {
      const { phoneNumber } = params
      const limit = parseInt((query.limit as string) || '50')

      const messages = await chatHistoryService.getHistoryFromDatabase(phoneNumber, limit)

      return {
        phoneNumber,
        messages,
        count: messages.length,
      }
    } catch (error) {
      Logger.error('Error fetching messages', { error })
      set.status = 500
      return { error: 'Failed to fetch messages' }
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
  await closeWhatsAppMessageQueue()
  process.exit(0)
}

process.on('SIGTERM', () => shutdown('SIGTERM'))
process.on('SIGINT', () => shutdown('SIGINT'))

Logger.success('Server running', {
  host: app.server?.hostname,
  port: app.server?.port,
})
