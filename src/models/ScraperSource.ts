export interface ScraperSourceData {
  name: string
  url: string
  lastScrapedAt?: Date
  lastPageScrapped?: number
  isActive: boolean
  shouldScrapeNext: boolean
  scrapeInterval?: number // in minutes
  maxPages?: number
  totalJobsFound?: number
}

export class ScraperSource {
  name: string
  url: string
  lastScrapedAt?: Date
  lastPageScrapped?: number
  isActive: boolean
  shouldScrapeNext: boolean
  scrapeInterval?: number
  maxPages?: number
  totalJobsFound?: number

  constructor(data: ScraperSourceData) {
    this.name = data.name
    this.url = data.url
    this.lastScrapedAt = data.lastScrapedAt
    this.lastPageScrapped = data.lastPageScrapped
    this.isActive = data.isActive
    this.shouldScrapeNext = data.shouldScrapeNext
    this.scrapeInterval = data.scrapeInterval
    this.maxPages = data.maxPages
    this.totalJobsFound = data.totalJobsFound

    console.log(`ScraperSource created: ${this.name}`)
  }

  updateLastScrape(page: number, jobsFound: number): void {
    this.lastScrapedAt = new Date()
    this.lastPageScrapped = page
    this.totalJobsFound = (this.totalJobsFound || 0) + jobsFound
    this.shouldScrapeNext = false
  }

  shouldScrapeNow(): boolean {
    if (!this.isActive) return false
    if (this.shouldScrapeNext) return true

    if (!this.scrapeInterval || !this.lastScrapedAt) return true

    const now = new Date()
    const timeSinceLastScrape =
      (now.getTime() - this.lastScrapedAt.getTime()) / (1000 * 60)

    return timeSinceLastScrape >= this.scrapeInterval
  }

  toJSON() {
    return {
      name: this.name,
      url: this.url,
      lastScrapedAt: this.lastScrapedAt,
      lastPageScrapped: this.lastPageScrapped,
      isActive: this.isActive,
      shouldScrapeNext: this.shouldScrapeNext,
      scrapeInterval: this.scrapeInterval,
      maxPages: this.maxPages,
      totalJobsFound: this.totalJobsFound,
    }
  }
}
