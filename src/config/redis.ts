import Redis from 'ioredis'

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
      console.log('Redis connected successfully')
    })

    redisClient.on('error', (err) => {
      console.error('Redis connection error:', err)
    })
  }

  return redisClient
}

export async function closeRedisConnection(): Promise<void> {
  if (redisClient) {
    await redisClient.quit()
    redisClient = null
    console.log('Redis connection closed')
  }
}
