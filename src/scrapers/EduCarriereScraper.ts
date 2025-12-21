import puppeteer from 'puppeteer'
import { puppeteerConfig } from '@config/infra/puppeteer'
import { JobAd, type JobAdData } from '@models/JobAd'

interface ScrapedJob {
  title: string
  url: string
  code: string
  dateEdition: string
  dateLimite: string
}

export class EduCarriereScraper {
  private readonly baseUrl = 'https://emploi.educarriere.ci'

  async scrape(pageNumber: number = 1): Promise<JobAd[]> {
    const browser = await puppeteer.launch(puppeteerConfig)
    const page = await browser.newPage()

    try {
      const url =
        pageNumber === 1
          ? `${this.baseUrl}/emploi-accueil`
          : `${this.baseUrl}/emploi/page/emploi/${pageNumber}`

      await page.goto(url, { waitUntil: 'networkidle0' })

      const jobs = await page.evaluate(() => {
        const jobElements = document.querySelectorAll('.rt-post.post-md.style-8')
        const scrapedJobs: ScrapedJob[] = []

        jobElements.forEach(element => {
          const titleElement = element.querySelector('.post-title a')
          const metaItems = element.querySelectorAll('.rt-meta ul li')

          let code = ''
          let dateEdition = ''
          let dateLimite = ''

          metaItems.forEach(item => {
            const text = item.textContent || ''
            if (text.includes('Code:')) {
              const codeSpan = item.querySelector('span')
              code = codeSpan?.textContent?.trim() || ''
            } else if (text.includes("Date d'édition:")) {
              const dateSpan = item.querySelector('span')
              dateEdition = dateSpan?.textContent?.trim() || ''
            } else if (text.includes('Date limite:')) {
              const dateSpan = item.querySelector('span')
              dateLimite = dateSpan?.textContent?.trim() || ''
            }
          })

          if (titleElement) {
            scrapedJobs.push({
              title: titleElement.textContent?.trim() || '',
              url: (titleElement as HTMLAnchorElement).href,
              code,
              dateEdition,
              dateLimite,
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
    const postedDate = this.parseDate(job.dateEdition)

    const jobData: JobAdData = {
      title: job.title,
      url: job.url,
      postedDate: postedDate || new Date(),
      source: 'EduCarriere',
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
