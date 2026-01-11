import puppeteer from 'puppeteer'
import { puppeteerConfig } from '@config/infra/puppeteer'
import { JobAd, type JobAdData } from '@models/JobAd'

interface ScrapedJob {
  title: string
  url: string
  location: string
  company: string
}

interface JobDetails {
  description: string
  pageMetadata: {
    keywords?: string
  }
}
export class OptionCarriereScraper {
  private readonly baseUrl = 'https://www.optioncarriere.ci'

  async scrape(pageNumber: number = 1, location: string = ''): Promise<JobAd[]> {
    const browser = await puppeteer.launch(puppeteerConfig)
    const page = await browser.newPage()

    try {
      const encodedLocation = encodeURIComponent(location)
      const url =
        pageNumber === 1
          ? `${this.baseUrl}/emploi?s=&l=${encodedLocation}`
          : `${this.baseUrl}/emploi?s=&l=${encodedLocation}&p=${pageNumber}`

      await page.goto(url, { waitUntil: 'networkidle0' })

      const jobs = await page.evaluate(() => {
        const jobElements = document.querySelectorAll('article.job')
        const scrapedJobs: ScrapedJob[] = []

        jobElements.forEach(element => {
          const titleElement = element.querySelector('header h2 a')
          const locationElement = element.querySelector('.location li')
          const companyElement = element.querySelector('.company a')

          if (titleElement) {
            const url = (titleElement as HTMLAnchorElement).href
            const fullUrl = url.startsWith('http')
              ? url
              : `https://www.optioncarriere.ci${url}`

            scrapedJobs.push({
              title: titleElement.textContent?.trim() || '',
              url: fullUrl,
              location: locationElement?.textContent?.trim() || '',
              company: companyElement?.textContent?.trim() || '',
            })
          }
        })

        return scrapedJobs
      })

      // Fetch details for each job
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
      const jobArticle = document.querySelector('article#job')
      const description = jobArticle?.textContent?.trim() || ''

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
      company: job.company,
      location: job.location,
      url: job.url,
      postedDate: new Date(),
      source: 'OptionCarriere',
      description: details?.description,
      pageMetadata: details?.pageMetadata,
    }

    return new JobAd(jobData)
  }
}
