import puppeteer from 'puppeteer'
import { puppeteerConfig } from '@config/infra/puppeteer'
import { JobAd, type JobAdData } from '@models/JobAd'
import { JobAdRepository } from '../db/repositories/JobAdRepository'
import { Logger } from '@/utils/logger'

interface ScrapedJob {
  title: string
  url: string
  code: string
  dateEdition: string
  dateLimite: string
  location: string
  company: string
  description?: string
  pageMetadata?: {
    keywords?: string
    listItems?: string[]
    [key: string]: any
  }
}

export class EduCarriereScraper {
  private readonly baseUrl = 'https://emploi.educarriere.ci'
  private readonly jobAdRepository = new JobAdRepository()

  async scrape(pageNumber: number = 1): Promise<JobAd[]> {
    const browser = await puppeteer.launch(puppeteerConfig)
    const page = await browser.newPage()

    try {
      const url =
        pageNumber === 1
          ? `${this.baseUrl}/emploi-accueil`
          : `${this.baseUrl}/emploi/page/emploi/${pageNumber}`

      await page.goto(url, { waitUntil: 'networkidle0' })

      const jobUrls = await page.evaluate(() => {
        const jobElements = document.querySelectorAll('.rt-post.post-md.style-8')
        const urls: string[] = []

        jobElements.forEach(element => {
          const titleElement = element.querySelector('.post-title a')
          if (titleElement) {
            urls.push((titleElement as HTMLAnchorElement).href)
          }
        })

        return urls
      })

      // Get existing URLs from database to avoid re-scraping
      const existingJobs = await this.jobAdRepository.findBySource('EduCarriere')
      const existingUrls = new Set(existingJobs.map(job => job.url))

      // Filter out already scraped URLs
      const newJobUrls = jobUrls.filter(url => !existingUrls.has(url))

      Logger.info(`Found ${jobUrls.length} total jobs, ${newJobUrls.length} new jobs to scrape`)

      const jobs: ScrapedJob[] = []

      // Visit each job detail page to extract additional information
      for (const jobUrl of newJobUrls) {
        try {
          await page.goto(jobUrl, { waitUntil: 'networkidle0' })

          const jobDetails = await page.evaluate(() => {
            // Extract title from h2.title
            const titleElement = document.querySelector('h2.title')
            const title = titleElement?.textContent?.trim() || ''

            // Extract company from meta tag
            const ogTitleMeta = document.querySelector('meta[property="og:title"]')
            const ogTitle = ogTitleMeta?.getAttribute('content') || ''
            let company = ''
            if (ogTitle.includes(' recrute ')) {
              const parts = ogTitle.split(' recrute ')
              company = parts[0].trim()
            }

            // Extract description from og:description meta tag
            const ogDescriptionMeta = document.querySelector('meta[property="og:description"]')
            const description = ogDescriptionMeta?.getAttribute('content') || ''

            // Extract keywords from meta tag
            const keywordsMeta = document.querySelector('meta[name="Keywords"]')
            const keywords = keywordsMeta?.getAttribute('content') || ''

            // Extract location and dates from list
            const listItems = document.querySelectorAll('li.list-group-item')
            let location = ''
            let dateEdition = ''
            let dateLimite = ''
            const listItemsContent: string[] = []

            listItems.forEach(item => {
              const text = item.textContent || ''
              listItemsContent.push(text.trim())

              if (text.includes('Lieu:')) {
                location = text.replace('Lieu:', '').trim()
              } else if (text.includes('Date de publication:')) {
                const dateSpan = item.querySelector('span')
                dateEdition = dateSpan?.textContent?.trim() || ''
              } else if (text.includes('Date limite:')) {
                const dateSpan = item.querySelector('span')
                dateLimite = dateSpan?.textContent?.trim() || ''
              }
            })

            return {
              title,
              company,
              location,
              dateEdition,
              dateLimite,
              description,
              pageMetadata: {
                keywords,
                listItems: listItemsContent,
              },
            }
          })

          jobs.push({
            title: jobDetails.title,
            url: jobUrl,
            code: '',
            dateEdition: jobDetails.dateEdition,
            dateLimite: jobDetails.dateLimite,
            location: jobDetails.location,
            company: jobDetails.company,
            description: jobDetails.description,
            pageMetadata: jobDetails.pageMetadata,
          })
        } catch (error) {
          Logger.error(`Error scraping job detail page ${jobUrl}:`, error)
        }
      }

      const jobAds = jobs.map(job => this.mapToJobAd(job))

      return jobAds
    } finally {
      await browser.close()
    }
  }

  private mapToJobAd(job: ScrapedJob): JobAd {
    const postedDate = this.parseDate(job.dateEdition)

    const jobData: JobAdData = {
      title: job.title,
      company: job.company,
      location: job.location,
      url: job.url,
      postedDate: postedDate || new Date(),
      source: 'EduCarriere',
      description: job.description,
      pageMetadata: job.pageMetadata,
    }

    return new JobAd(jobData)
  }

  private parseDate(dateStr: string): Date | null {
    if (!dateStr) return null

    // Format: DD/MM/YYYY
    const parts = dateStr.split('/')
    if (parts.length !== 3) return null

    const day = parseInt(parts[0], 10)
    const month = parseInt(parts[1], 10) - 1 // Months are 0-indexed
    const year = parseInt(parts[2], 10)

    return new Date(year, month, day)
  }
}
