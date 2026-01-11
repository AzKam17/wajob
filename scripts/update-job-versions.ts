import { AppDataSource } from '../src/db/data-source'
import { JobAdEntity } from '../src/db/entities/JobAdEntity'
import puppeteer, { type Page } from 'puppeteer'
import { puppeteerConfig } from '../src/config/infra/puppeteer'
import cliProgress from 'cli-progress'

interface JobDetails {
  description: string
  pageMetadata?: Record<string, any>
}

async function scrapeJobDetails(page: Page, url: string, source: string): Promise<JobDetails> {
  try {
    await page.goto(url, { waitUntil: 'networkidle0', timeout: 30000 })

    const details = await page.evaluate((src) => {
      if (src === 'Socium') {
        const metaDesc = document.querySelector('meta[name="description"]')
        return {
          description: metaDesc?.getAttribute('content') || '',
          pageMetadata: {}
        }
      }

      if (src === 'JobIvoire') {
        const metaDescription = document.querySelector('meta[name="description"]')
        const metaKeywords = document.querySelector('meta[name="keywords"]')
        return {
          description: metaDescription?.getAttribute('content') || '',
          pageMetadata: {
            keywords: metaKeywords?.getAttribute('content') || ''
          }
        }
      }

      if (src === 'Djamo') {
        const metaDescription = document.querySelector('meta[name="description"]')
        return {
          description: metaDescription?.getAttribute('content') || '',
          pageMetadata: {}
        }
      }

      if (src === 'OptionCarriere') {
        const jobArticle = document.querySelector('article#job')
        const metaKeywords = document.querySelector('meta[name="keywords"]')
        return {
          description: jobArticle?.textContent?.trim() || '',
          pageMetadata: {
            keywords: metaKeywords?.getAttribute('content') || ''
          }
        }
      }

      if (src === 'EduCarriere') {
        const ogDescriptionMeta = document.querySelector('meta[property="og:description"]')
        const keywordsMeta = document.querySelector('meta[name="Keywords"]')
        const listItems = document.querySelectorAll('li.list-group-item')
        const listItemsContent: string[] = []

        listItems.forEach(item => {
          const text = item.textContent || ''
          listItemsContent.push(text.trim())
        })

        return {
          description: ogDescriptionMeta?.getAttribute('content') || '',
          pageMetadata: {
            keywords: keywordsMeta?.getAttribute('content') || '',
            listItems: listItemsContent
          }
        }
      }

      if (src === 'ProJobIvoire') {
        const metaDescription = document.querySelector('meta[name="description"]')
        const metaKeywords = document.querySelector('meta[name="keywords"]')
        return {
          description: metaDescription?.getAttribute('content') || '',
          pageMetadata: {
            keywords: metaKeywords?.getAttribute('content') || ''
          }
        }
      }

      return {
        description: '',
        pageMetadata: {}
      }
    }, source)

    return details
  } catch (error: any) {
    console.error(`Failed to scrape ${url}: ${error.message}`)
    return {
      description: '',
      pageMetadata: {}
    }
  }
}

function stripHtml(text: string | undefined): string | undefined {
  if (!text) return text
  return text
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

async function main() {
  console.log('🚀 Starting job version update script...\n')

  // Initialize database
  await AppDataSource.initialize()
  console.log('✅ Database connected\n')

  const repository = AppDataSource.getRepository(JobAdEntity)

  // Find all jobs with missing or old versions
  const jobsToUpdate = await repository
    .createQueryBuilder('job')
    .where('job.deletedAt IS NULL')
    .andWhere(
      `(job.internalExtras IS NULL OR job.internalExtras->>'version' IS NULL OR job.internalExtras->>'version' != '2')`
    )
    .orderBy('job.source', 'ASC')
    .addOrderBy('job.createdAt', 'DESC')
    .getMany()

  console.log(`📊 Found ${jobsToUpdate.length} jobs to update\n`)

  if (jobsToUpdate.length === 0) {
    console.log('✅ All jobs are already up to date!')
    await AppDataSource.destroy()
    return
  }

  // Launch browser
  const browser = await puppeteer.launch(puppeteerConfig)
  const page = await browser.newPage()

  let updated = 0
  let failed = 0
  let skipped = 0

  // Create progress bar
  const progressBar = new cliProgress.SingleBar({
    format: 'Progress |{bar}| {percentage}% | {value}/{total} | Updated: {updated} | Skipped: {skipped} | Failed: {failed}',
    barCompleteChar: '\u2588',
    barIncompleteChar: '\u2591',
    hideCursor: true
  })

  progressBar.start(jobsToUpdate.length, 0, {
    updated: 0,
    skipped: 0,
    failed: 0
  })

  for (let i = 0; i < jobsToUpdate.length; i++) {
    const job = jobsToUpdate[i]

    try {
      // Scrape details from the job page
      const details = await scrapeJobDetails(page, job.url, job.source)

      if (!details.description && Object.keys(details.pageMetadata || {}).length === 0) {
        skipped++
        progressBar.update(i + 1, { updated, skipped, failed })
        continue
      }

      // Update the job
      job.description = stripHtml(details.description) || job.description
      job.pageMetadata = details.pageMetadata
      job.internalExtras = { version: '2' }

      await repository.save(job)

      updated++
      progressBar.update(i + 1, { updated, skipped, failed })

      // Add a small delay to avoid overwhelming the servers
      await new Promise(resolve => setTimeout(resolve, 1000))
    } catch (error: any) {
      failed++
      progressBar.update(i + 1, { updated, skipped, failed })
    }
  }

  progressBar.stop()

  await browser.close()
  await AppDataSource.destroy()

  console.log('\n📈 Update Summary:')
  console.log(`  ✅ Updated: ${updated}`)
  console.log(`  ⚠️  Skipped: ${skipped}`)
  console.log(`  ❌ Failed: ${failed}`)
  console.log(`  📊 Total: ${jobsToUpdate.length}`)
}

main().catch(error => {
  console.error('Fatal error:', error)
  process.exit(1)
})
