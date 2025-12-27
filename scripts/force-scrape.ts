import { initializeDatabase } from '../src/db'
import { ScraperSourceRepository } from '../src/db/repositories/ScraperSourceRepository'
import { getScrapeQueue, closeScrapeQueue } from '../src/queues/scrape.queue'

await initializeDatabase()

const scraperSourceRepo = new ScraperSourceRepository()

// Get Redis config from environment
const redisHost = process.env.REDIS_HOST || 'localhost'
const redisPort = parseInt(process.env.REDIS_PORT || '6379')
const redisPassword = process.env.REDIS_PASSWORD
const maxPages = parseInt(process.env.MAX_PAGES_PER_SCRAPE || '3')

console.log('🚀 Triggering immediate scraping for all active sources...\n')

try {
  const activeSources = await scraperSourceRepo.findActiveModels()

  if (activeSources.length === 0) {
    console.log('ℹ️  No active scraper sources found')
    process.exit(0)
  }

  console.log(`📊 Found ${activeSources.length} active sources\n`)

  const queue = getScrapeQueue(redisHost, redisPort, redisPassword)

  for (const source of activeSources) {
    await queue.add(`scrape-${source.name}`, {
      sourceId: source.id!,
      sourceName: source.name,
      maxPages: source.maxPages || maxPages,
    })
    console.log(`✅ ${source.name} - job enqueued for immediate scraping`)
  }

  console.log(`\n✅ Successfully enqueued ${activeSources.length} scraping jobs!`)
  console.log('ℹ️  Jobs will be processed immediately by the scraper worker')

  await closeScrapeQueue()
} catch (error) {
  console.error('❌ Error forcing scrape:', error)
  process.exit(1)
}

process.exit(0)
