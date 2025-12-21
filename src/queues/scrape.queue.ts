import { Queue } from 'bullmq'
import { getRedisConnection } from '@config/redis'

export interface ScrapeJobData {
  sourceId: string
  sourceName: string
  maxPages: number
}

let scrapeQueue: Queue<ScrapeJobData> | null = null

export function getScrapeQueue(
  redisHost: string,
  redisPort: number,
  redisPassword?: string
): Queue<ScrapeJobData> {
  if (!scrapeQueue) {
    const connection = getRedisConnection(redisHost, redisPort, redisPassword)

    scrapeQueue = new Queue<ScrapeJobData>('scrape-jobs', {
      connection,
      defaultJobOptions: {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 2000,
        },
        removeOnComplete: {
          count: 100,
          age: 24 * 3600, // 24 hours
        },
        removeOnFail: {
          count: 500,
        },
      },
    })

    console.log('Scrape queue initialized')
  }

  return scrapeQueue
}

export async function closeScrapeQueue(): Promise<void> {
  if (scrapeQueue) {
    await scrapeQueue.close()
    scrapeQueue = null
    console.log('Scrape queue closed')
  }
}
