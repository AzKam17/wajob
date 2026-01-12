import { Worker, Job } from 'bullmq'
import { getRedisConnection } from '@config/redis'
import { WhatsAppMessageJobData } from '../queues/whatsapp-message.queue'
import { Logger } from '../utils/logger'
import { WhatsAppMessageService } from '../services/whatsapp-message.service'
import { WhatsAppMessageNLPService } from '../services/whatsapp-message-nlp.service'
import { ConversationStateService } from '../services/conversation-state.service'
import { ChatHistoryService } from '../services/chat-history.service'
import { FeatureFlags } from '../config/feature-flags'

let whatsappMessageWorker: Worker<WhatsAppMessageJobData> | null = null
let conversationStateService: ConversationStateService | null = null
let chatHistoryService: ChatHistoryService | null = null
let whatsappNLPService: WhatsAppMessageNLPService | null = null

async function processWhatsAppMessage(job: Job<WhatsAppMessageJobData>): Promise<void> {
  const { payload, receivedAt } = job.data

  // Extract phone number from payload to check feature flags
  const phoneNumber = payload.entry[0]?.changes[0]?.value?.messages?.[0]?.from

  Logger.info('Processing WhatsApp message', {
    jobId: job.id,
    receivedAt,
    phoneNumber,
  })

  // Create services if they don't exist (singleton pattern)
  if (!conversationStateService || !chatHistoryService) {
    const redis = getRedisConnection(
      process.env.REDIS_HOST || 'localhost',
      parseInt(process.env.REDIS_PORT || '6379'),
      process.env.REDIS_PASSWORD
    )
    conversationStateService = new ConversationStateService(redis)
    chatHistoryService = new ChatHistoryService(redis)
  }

  try {
    // Check if NLP is enabled for this user
    if (phoneNumber && FeatureFlags.isNLPEnabled(phoneNumber)) {
      Logger.info('[FeatureFlag] Using NLP-based conversation handler', { phoneNumber })

      // Initialize NLP service if needed
      if (!whatsappNLPService) {
        const redis = getRedisConnection(
          process.env.REDIS_HOST || 'localhost',
          parseInt(process.env.REDIS_PORT || '6379'),
          process.env.REDIS_PASSWORD
        )
        whatsappNLPService = new WhatsAppMessageNLPService(redis, chatHistoryService)
        await whatsappNLPService.initialize()
      }

      await whatsappNLPService.handleIncomingMessage(payload)
    } else {
      Logger.info('[FeatureFlag] Using XState-based conversation handler', { phoneNumber })

      const whatsappService = new WhatsAppMessageService(conversationStateService, chatHistoryService)
      await whatsappService.handleIncomingMessage(payload)
    }

    Logger.success('WhatsApp message processed', {
      jobId: job.id,
      phoneNumber,
    })
  } catch (error: any) {
    Logger.error('Error processing WhatsApp message', {
      jobId: job.id,
      phoneNumber,
      error: error?.message,
      stack: error?.stack,
    })
    throw error
  }
}

export function startWhatsAppMessageWorker(
  redisHost: string,
  redisPort: number,
  redisPassword?: string
): Worker<WhatsAppMessageJobData> {
  if (whatsappMessageWorker) {
    return whatsappMessageWorker
  }

  const connection = getRedisConnection(redisHost, redisPort, redisPassword)

  whatsappMessageWorker = new Worker<WhatsAppMessageJobData>(
    'whatsapp-messages',
    processWhatsAppMessage,
    {
      connection,
      concurrency: 5, // Process up to 5 messages concurrently
    }
  )

  whatsappMessageWorker.on('completed', (job) => {
    Logger.success('WhatsApp message worker completed job', {
      jobId: job.id,
    })
  })

  whatsappMessageWorker.on('failed', (job, err) => {
    Logger.error('WhatsApp message worker job failed', {
      jobId: job?.id,
      error: err.message,
    })
  })

  whatsappMessageWorker.on('error', (err) => {
    Logger.error('WhatsApp message worker error', { error: err.message })
  })

  Logger.success('WhatsApp message worker started', { concurrency: 5 })

  return whatsappMessageWorker
}

export async function stopWhatsAppMessageWorker(): Promise<void> {
  if (whatsappMessageWorker) {
    await whatsappMessageWorker.close()
    whatsappMessageWorker = null
    Logger.info('WhatsApp message worker stopped')
  }
}
