import puppeteer from 'puppeteer'
import { puppeteerConfig } from '@config/infra/puppeteer'
import { JobAd, type JobAdData } from '@models/JobAd'

interface ScrapedJob {
  title: string
  url: string
  location: string
  department: string
}

const COUNTRY_FLAGS: Record<string, string> = {
  CI: '🇨🇮',
  SN: '🇸🇳',
}

export class DjamoScraper {
  private readonly baseUrl = 'https://djamo.breezy.hr'

  async scrape(): Promise<JobAd[]> {
    const browser = await puppeteer.launch(puppeteerConfig)
    const page = await browser.newPage()

    try {
      await page.goto(this.baseUrl, { waitUntil: 'networkidle0' })

      const jobs = await page.evaluate(() => {
        const jobElements = document.querySelectorAll('li.position')
        const scrapedJobs: ScrapedJob[] = []

        jobElements.forEach(element => {
          const link = element.querySelector('a[href^="/p/"]')
          const titleElement = element.querySelector('h2')
          const locationElement = element.querySelector('.location span')
          const departmentElement = element.querySelector('.department span')

          if (link && titleElement && locationElement) {
            scrapedJobs.push({
              title: titleElement.textContent?.trim() || '',
              url: (link as HTMLAnchorElement).href,
              location: locationElement.textContent?.trim() || '',
              department: departmentElement?.textContent?.trim() || '',
            })
          }
        })

        return scrapedJobs
      })

      // Filter only jobs from Abidjan
      const abidjanJobs = jobs.filter(job => job.location.includes('Abidjan'))

      const jobAds = abidjanJobs.map(job => this.mapToJobAd(job))

      return jobAds
    } finally {
      await browser.close()
    }
  }

  private mapToJobAd(job: ScrapedJob): JobAd {
    const countryCode = this.extractCountryCode(job.location)
    const countryFlag = COUNTRY_FLAGS[countryCode] || ''
    const titleWithFlag = countryFlag
      ? `${job.title} - ${countryFlag}`
      : job.title

    const jobData: JobAdData = {
      title: titleWithFlag,
      company: 'Djamo',
      location: job.location,
      url: job.url,
      postedDate: new Date(),
      source: 'Djamo',
    }

    return new JobAd(jobData)
  }

  private extractCountryCode(location: string): string {
    const match = location.match(/,\s*([A-Z]{2})/)
    return match ? match[1] : ''
  }
}
