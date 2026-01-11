import puppeteer from 'puppeteer'
import { puppeteerConfig } from '@config/infra/puppeteer'
import { JobAd, type JobAdData } from '@models/JobAd'

interface ScrapedJob {
  title: string
  url: string
  location: string
  timePosted: string
}

interface JobDetails {
  description: string
  pageMetadata: {
    keywords?: string
  }
}

export class JobIvoireScraper {
  private readonly baseUrl = 'https://www.jobivoire.ci'

  async scrape(pageNumber: number = 1): Promise<JobAd[]> {
    const browser = await puppeteer.launch(puppeteerConfig)
    const page = await browser.newPage()

    try {
      const url = `${this.baseUrl}/jobs?page=${pageNumber}`

      await page.goto(url, { waitUntil: 'networkidle0' })

      const jobs = await page.evaluate(() => {
        const jobCards = document.querySelectorAll('.job-card')
        const scrapedJobs: ScrapedJob[] = []

        jobCards.forEach(card => {
          const linkElement = card.querySelector('a.stretched-link')
          const titleElement = card.querySelector('.job-title')
          const locationElement = card.querySelector('.job-location')
          const timeElement = card.querySelector('.job-time span:last-child')

          if (titleElement && linkElement) {
            scrapedJobs.push({
              title: titleElement.textContent?.trim() || '',
              url: (linkElement as HTMLAnchorElement).href,
              location: locationElement?.textContent?.trim() || '',
              timePosted: timeElement?.textContent?.trim() || '',
            })
          }
        })

        return scrapedJobs
      })

      const jobAds: JobAd[] = []
      for (const job of jobs) {
        const details = await this.scrapeJobDetails(page, job.url)
        jobAds.push(this.mapToJobAd(job, details))
      }

      return jobAds
    } finally {
      await browser.close()
    }
  }

  private async scrapeJobDetails(page: puppeteer.Page, url: string): Promise<JobDetails> {
    await page.goto(url, { waitUntil: 'networkidle0' })

    const details = await page.evaluate(() => {
      const metaDescription = document.querySelector('meta[name="description"]')
      const description = metaDescription?.getAttribute('content') || ''

      const metaKeywords = document.querySelector('meta[name="keywords"]')
      const keywords = metaKeywords?.getAttribute('content') || ''

      return {
        description,
        pageMetadata: {
          keywords,
        },
      }
    })

    return details
  }

  private mapToJobAd(job: ScrapedJob, details?: JobDetails): JobAd {
    const jobData: JobAdData = {
      title: job.title,
      location: job.location,
      url: job.url,
      postedDate: new Date(),
      source: 'JobIvoire',
      description: details?.description,
      pageMetadata: details?.pageMetadata,
    }

    return new JobAd(jobData)
  }
}
