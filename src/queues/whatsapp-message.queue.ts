import { Queue } from 'bullmq'
import { getRedisConnection } from '@config/redis'
import { Logger } from '../utils/logger'

export interface WhatsAppMessageJobData {
  payload: any
  receivedAt: string
}

let whatsappMessageQueue: Queue<WhatsAppMessageJobData> | null = null

export function getWhatsAppMessageQueue(
  redisHost: string,
  redisPort: number,
  redisPassword?: string
): Queue<WhatsAppMessageJobData> {
  if (!whatsappMessageQueue) {
    const connection = getRedisConnection(redisHost, redisPort, redisPassword)

    whatsappMessageQueue = new Queue<WhatsAppMessageJobData>('whatsapp-messages', {
      connection,
      defaultJobOptions: {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 1000,
        },
        removeOnComplete: {
          count: 1000,
          age: 48 * 3600, // 48 hours
        },
        removeOnFail: {
          count: 1000,
        },
      },
    })

    Logger.success('WhatsApp message queue initialized')
  }

  return whatsappMessageQueue
}

export async function closeWhatsAppMessageQueue(): Promise<void> {
  if (whatsappMessageQueue) {
    await whatsappMessageQueue.close()
    whatsappMessageQueue = null
    Logger.info('WhatsApp message queue closed')
  }
}
