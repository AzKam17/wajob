import puppeteer from 'puppeteer'
import { puppeteerConfig } from '@config/infra/puppeteer'
import { JobAd, type JobAdData } from '@models/JobAd'

interface ScrapedJob {
  title: string
  url: string
  location: string
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

          if (titleElement) {
            const url = (titleElement as HTMLAnchorElement).href
            const fullUrl = url.startsWith('http')
              ? url
              : `https://www.optioncarriere.ci${url}`

            scrapedJobs.push({
              title: titleElement.textContent?.trim() || '',
              url: fullUrl,
              location: locationElement?.textContent?.trim() || '',
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
      url: job.url,
      postedDate: new Date(),
      source: 'OptionCarriere',
    }

    return new JobAd(jobData)
  }
}
