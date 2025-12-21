import { initializeDatabase } from '../src/db'
import { ScraperSourceRepository } from '../src/db/repositories/ScraperSourceRepository'
import { ScraperSource } from '../src/models/ScraperSource'

await initializeDatabase()

const scraperSourceRepo = new ScraperSourceRepository()

// Define scraper sources
const sources = [
  new ScraperSource({
    name: 'sociumjob',
    url: 'https://sociumjob.com/api/jobs/get-all-jobs',
    isActive: true,
    shouldScrapeNext: false,
    scrapeInterval: 30, // 30 minutes
    maxPages: 3,
    totalJobsFound: 0,
  }),
  new ScraperSource({
    name: 'djamo',
    url: 'https://djamo.breezy.hr',
    isActive: true,
    shouldScrapeNext: false,
    scrapeInterval: 60, // 1 hour
    maxPages: 2,
    totalJobsFound: 0,
  }),
  new ScraperSource({
    name: 'educarriere',
    url: 'https://emploi.educarriere.ci',
    isActive: true,
    shouldScrapeNext: false,
    scrapeInterval: 45, // 45 minutes
    maxPages: 3,
    totalJobsFound: 0,
  }),
  new ScraperSource({
    name: 'optioncarriere',
    url: 'https://www.optioncarriere.ci/emploi',
    isActive: true,
    shouldScrapeNext: false,
    scrapeInterval: 30,
    maxPages: 3,
    totalJobsFound: 0,
  }),
  new ScraperSource({
    name: 'jobivoire',
    url: 'https://jobivoire.ci',
    isActive: true,
    shouldScrapeNext: false,
    scrapeInterval: 30,
    maxPages: 3,
    totalJobsFound: 0,
  }),
  new ScraperSource({
    name: 'projobivoire',
    url: 'https://projobivoire.com',
    isActive: true,
    shouldScrapeNext: false,
    scrapeInterval: 30,
    maxPages: 3,
    totalJobsFound: 0,
  }),
]

console.log('🌱 Seeding scraper sources...\n')

for (const source of sources) {
  // Check if source already exists
  const existing = await scraperSourceRepo.findModelByName(source.name)

  if (existing) {
    console.log(`⏭️  Skipping ${source.name} (already exists)`)
    continue
  }

  const saved = await scraperSourceRepo.saveModel(source)
  console.log(`✅ Created ${saved.name} (ID: ${saved.id})`)
}

console.log('\n✅ Seeding completed!')
process.exit(0)
