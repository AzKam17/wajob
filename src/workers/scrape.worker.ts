import { Worker, Job } from 'bullmq'
import { getRedisConnection } from '@config/redis'
import { ScrapeJobData } from '../queues/scrape.queue'
import { Logger } from '../utils/logger'
import { JobAdRepository } from '@/db/repositories/JobAdRepository'
import { ScraperSourceRepository } from '@/db/repositories/ScraperSourceRepository'
import { JobAd } from '@/models/JobAd'
import { SociumScraper } from '@/scrapers/SociumScraper'
import { EduCarriereScraper } from '@/scrapers/EduCarriereScraper'
import { JobIvoireScraper } from '@/scrapers/JobIvoireScraper'
import { OptionCarriereScraper } from '@/scrapers/OptionCarriereScraper'
import { ProJobIvoireScraper } from '@/scrapers/ProJobIvoireScraper'
import { DjamoScraper } from '@/scrapers/DjamoScraper'

let scrapeWorker: Worker<ScrapeJobData> | null = null

async function processScrapeJob(job: Job<ScrapeJobData>): Promise<void> {
  const { sourceId, sourceName, maxPages } = job.data

  Logger.info('Scraping job started', {
    jobId: job.id,
    sourceId,
    sourceName,
    maxPages,
  })

  const jobRepo = new JobAdRepository()
  const sourceRepo = new ScraperSourceRepository()

  // pick scraper by sourceName
  const pickScraper = (name: string) => {
    const key = name.toLowerCase()
    if (key.includes('socium')) return new SociumScraper()
    if (key.includes('educarriere') || key.includes('edu')) return new EduCarriereScraper()
    if (key.includes('jobivoire')) return new JobIvoireScraper()
    if (key.includes('optioncarriere') || key.includes('option')) return new OptionCarriereScraper()
    if (key.includes('projobivoire') || key.includes('projob')) return new ProJobIvoireScraper()
    if (key.includes('djamo')) return new DjamoScraper()
    return null
  }

  const scraper: any = pickScraper(sourceName)
  if (!scraper) {
    Logger.error('No scraper found for source', { sourceName })
    return
  }

  let totalSaved = 0
  let page = 1

  try {
    for (page = 1; page <= (maxPages || 1); page++) {
      Logger.info('Scraping page', { sourceName, page })

      // Many scrapers accept page param; some ignore it
      const results: JobAd[] = await scraper.scrape(page)

      if (!results || results.length === 0) {
        Logger.info('No jobs found on page', { sourceName, page })
        break
      }

      for (const jobAd of results) {
        try {
          const saved = await jobRepo.saveModel(jobAd)
          if (saved) {
            totalSaved++
            Logger.success('Job saved', { url: jobAd.url, title: jobAd.title })
          } else {
            Logger.debug('Skipping job (already exists with same version)', { url: jobAd.url })
          }
        } catch (err: any) {
          Logger.error('Failed saving job', { url: jobAd.url, error: err?.message })
        }
      }
    }

    // mark source as scraped, last page is page-1 if loop ended
    const lastPage = Math.max(1, page - 1)
    await sourceRepo.markAsScraped(sourceId, lastPage, totalSaved)

    Logger.success('Scraping job completed', {
      jobId: job.id,
      sourceName,
      pagesScraped: lastPage,
      jobsSaved: totalSaved,
    })
  } catch (error: any) {
    Logger.error('Error during scraping job', { error: error?.message })
    throw error
  }
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
