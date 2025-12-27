import puppeteer from 'puppeteer'
import { puppeteerConfig } from '@config/infra/puppeteer'
import { JobAd, type JobAdData } from '@models/JobAd'

interface ScrapedJob {
  title: string
  url: string
  location: string
  timePosted: string
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

      const jobAds = jobs.map(job => this.mapToJobAd(job))

      return jobAds
    } finally {
      await browser.close()
    }
  }

  private mapToJobAd(job: ScrapedJob): JobAd {
    const jobData: JobAdData = {
      title: job.title,
      location: job.location,
      url: job.url,
      postedDate: new Date(),
      source: 'JobIvoire',
    }

    return new JobAd(jobData)
  }
}
