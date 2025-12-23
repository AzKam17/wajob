import { initializeDatabase } from '../db'
import { startWhatsAppMessageWorker } from './whatsapp-message.worker'
import { closeRedisConnection } from '@config/redis'
import { closeWhatsAppMessageQueue } from '../queues/whatsapp-message.queue'
import { Logger } from '../utils/logger'

// Initialize database
await initializeDatabase()
Logger.success('Database initialized')

// Start WhatsApp message worker
const whatsappWorker = startWhatsAppMessageWorker(
  process.env.REDIS_HOST || 'localhost',
  parseInt(process.env.REDIS_PORT || '6379'),
  process.env.REDIS_PASSWORD
)

Logger.success('WhatsApp worker started and ready to process messages')

const shutdown = async (signal: string) => {
  Logger.info(`${signal} received, shutting down WhatsApp worker gracefully`)
  await whatsappWorker.close()
  await closeWhatsAppMessageQueue()
  await closeRedisConnection()
  process.exit(0)
}

process.on('SIGTERM', () => shutdown('SIGTERM'))
process.on('SIGINT', () => shutdown('SIGINT'))
