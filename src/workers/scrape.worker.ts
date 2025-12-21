import { Worker, Job } from 'bullmq'
import { getRedisConnection } from '@config/redis'
import { ScrapeJobData } from '../queues/scrape.queue'

let scrapeWorker: Worker<ScrapeJobData> | null = null

async function processScrapeJob(job: Job<ScrapeJobData>): Promise<void> {
  const { sourceId, sourceName, maxPages } = job.data

  console.log(`
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🔄 SCRAPING JOB RECEIVED
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Source ID:   ${sourceId}
Source Name: ${sourceName}
Max Pages:   ${maxPages}
Job ID:      ${job.id}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  `)

  // TODO: Implement actual scraping logic here
  // For now, just log that we would scrape
  await new Promise((resolve) => setTimeout(resolve, 1000))

  console.log(`✅ Would scrape ${sourceName} (max ${maxPages} pages)`)
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
      concurrency: 2, // Process 2 scrape jobs concurrently
    }
  )

  scrapeWorker.on('completed', (job) => {
    console.log(`✅ Job ${job.id} completed for ${job.data.sourceName}`)
  })

  scrapeWorker.on('failed', (job, err) => {
    console.error(
      `❌ Job ${job?.id} failed for ${job?.data.sourceName}:`,
      err.message
    )
  })

  scrapeWorker.on('error', (err) => {
    console.error('Worker error:', err)
  })

  console.log('Scrape worker started')

  return scrapeWorker
}

export async function stopScrapeWorker(): Promise<void> {
  if (scrapeWorker) {
    await scrapeWorker.close()
    scrapeWorker = null
    console.log('Scrape worker stopped')
  }
}
