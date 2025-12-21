import Redis from 'ioredis'
import { Logger } from '../utils/logger'

let redisClient: Redis | null = null

export function getRedisConnection(
  host: string = 'localhost',
  port: number = 6379,
  password?: string
): Redis {
  if (!redisClient) {
    redisClient = new Redis({
      host,
      port,
      password,
      maxRetriesPerRequest: null,
    })

    redisClient.on('connect', () => {
      Logger.success('Redis connected', { host, port })
    })

    redisClient.on('error', (err) => {
      Logger.error('Redis connection error', { error: err.message })
    })
  }

  return redisClient
}

export async function closeRedisConnection(): Promise<void> {
  if (redisClient) {
    await redisClient.quit()
    redisClient = null
    Logger.info('Redis connection closed')
  }
}
