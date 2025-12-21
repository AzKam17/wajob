import { Worker, Job } from 'bullmq'
import { getRedisConnection } from '@config/redis'
import { ScrapeJobData } from '../queues/scrape.queue'
import { Logger } from '../utils/logger'

let scrapeWorker: Worker<ScrapeJobData> | null = null

async function processScrapeJob(job: Job<ScrapeJobData>): Promise<void> {
  const { sourceId, sourceName, maxPages } = job.data

  Logger.info('Scraping job started', {
    jobId: job.id,
    sourceId,
    sourceName,
    maxPages,
  })

  // TODO: Implement actual scraping logic here
  await new Promise((resolve) => setTimeout(resolve, 1000))

  Logger.success('Scraping job completed', {
    jobId: job.id,
    sourceName,
    message: `Would scrape ${sourceName} (max ${maxPages} pages)`,
  })
}

export function startScrapeWorker(
  redisHost: string,
  redisPort: number,
  redisPassword?: string
): Worker<ScrapeJobData> {
  if (scrapeWorker) {
    return scrapeWorker
  }

  const connection = getRedisConnection(redisHost, redisPort, redisPassword)

  scrapeWorker = new Worker<ScrapeJobData>(
    'scrape-jobs',
    processScrapeJob,
    {
      connection,
      concurrency: 2,
    }
  )

  scrapeWorker.on('completed', (job) => {
    Logger.success('Worker completed job', {
      jobId: job.id,
      sourceName: job.data.sourceName,
    })
  })

  scrapeWorker.on('failed', (job, err) => {
    Logger.error('Worker job failed', {
      jobId: job?.id,
      sourceName: job?.data.sourceName,
      error: err.message,
    })
  })

  scrapeWorker.on('error', (err) => {
    Logger.error('Worker error', { error: err.message })
  })

  Logger.success('Scrape worker started', { concurrency: 2 })

  return scrapeWorker
}

export async function stopScrapeWorker(): Promise<void> {
  if (scrapeWorker) {
    await scrapeWorker.close()
    scrapeWorker = null
    Logger.info('Scrape worker stopped')
  }
}
