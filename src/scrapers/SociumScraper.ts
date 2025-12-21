import { JobAd, type JobAdData } from '@models/JobAd'

interface SociumJobResult {
  slug: string
  title: string
  createdAt: string
}

interface SociumApiResponse {
  results: SociumJobResult[]
}

export class SociumScraper {
  private readonly baseUrl = 'https://sociumjob.com'
  private readonly apiUrl = `${this.baseUrl}/api/jobs/get-all-jobs`

  async scrape(
    page: number = 1,
    limit: number = 20,
    keyword?: string
  ): Promise<JobAd[]> {
    const requestBody = {
      page,
      limit,
      sortBy: 'publicationDate',
      sortByDirection: 'desc',
      ...(keyword && { keyword }),
    }

    const response = await fetch(this.apiUrl, {
      method: 'POST',
      headers: {
        accept: 'application/json',
        'accept-language': 'fr-FR,fr;q=0.9,en-US;q=0.8,en;q=0.7',
        'content-type': 'application/json',
        origin: 'https://sociumjob.com',
        cookie: 'i18n_redirected=fr',
        'user-agent':
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36',
      },
      body: JSON.stringify(requestBody),
    })

    if (!response.ok) {
      throw new Error(
        `Failed to fetch data from Socium: ${response.statusText}`
      )
    }

    const data: SociumApiResponse = await response.json()
    const jobs = data.results.map(job => this.mapToJobAd(job))

    return jobs
  }

  private mapToJobAd(job: SociumJobResult): JobAd {
    const jobData: JobAdData = {
      title: job.title,
      url: `${this.baseUrl}/jobs/${job.slug}`,
      postedDate: new Date(job.createdAt),
      source: 'Socium',
    }

    return new JobAd(jobData)
  }
}
