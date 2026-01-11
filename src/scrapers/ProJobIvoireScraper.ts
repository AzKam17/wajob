import { JobAd, type JobAdData } from '@models/JobAd'

interface ProJobIvoireJob {
  title: string
  url: string
  company: string
  location: string
  postedDate: string
  closingDate?: string
}

// TODO: Unable to find in db jobs ads to review and also add description and metadata
export class ProJobIvoireScraper {
  private readonly apiUrl = 'https://projobivoire.com/wp-admin/admin-ajax.php'

  async scrape(page: number = 1): Promise<JobAd[]> {
    const formData = new URLSearchParams({
      action: 'noo_nextelementor',
      max_page: '460',
      current_page: page.toString(),
      show_view_more: 'yes',
      show: 'recent',
      order: 'desc',
      orderby: 'date',
      posts_per_page: '100',
      page: (page - 1).toString(),
    })

    const response = await fetch(this.apiUrl, {
      method: 'POST',
      headers: {
        accept: '*/*',
        'accept-language': 'fr-FR,fr;q=0.9,en-US;q=0.8,en;q=0.7',
        'content-type': 'application/x-www-form-urlencoded; charset=UTF-8',
        origin: 'https://projobivoire.com',
        referer: 'https://projobivoire.com/',
        'user-agent':
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36',
        'x-requested-with': 'XMLHttpRequest',
      },
      body: formData.toString(),
    })

    if (!response.ok) {
      throw new Error(
        `Failed to fetch data from ProJobIvoire: ${response.statusText}`
      )
    }

    const html = await response.text()
    const jobs = this.parseHtml(html)

    return jobs.map(job => this.mapToJobAd(job))
  }

  private parseHtml(html: string): ProJobIvoireJob[] {
    const jobs: ProJobIvoireJob[] = []

    // Match each article block
    const articleRegex =
      /<article[^>]*>[\s\S]*?<a[^>]*href="([^"]*)"[^>]*title="[^"]*&quot;([^&]*)&quot;"[\s\S]*?<em>([^<]*)<\/em>[\s\S]*?<span class="job-company"[^>]*>[\s\S]*?<span>([^<]*)<\/span>[\s\S]*?<span class="job-date__posted"[^>]*>\s*([^<\s][^<]*)<\/span>[\s\S]*?(?:<span class="job-date__closing"[^>]*>\s*-\s*([^<\s][^<]*)<\/span>)?[\s\S]*?<\/article>/g

    let match
    while ((match = articleRegex.exec(html)) !== null) {
      jobs.push({
        url: match[1],
        title: match[2].trim(),
        location: match[3].trim(),
        company: match[4].trim(),
        postedDate: match[5].trim(),
        closingDate: match[6]?.trim(),
      })
    }

    return jobs
  }

  private mapToJobAd(job: ProJobIvoireJob): JobAd {
    const jobData: JobAdData = {
      title: job.title,
      company: job.company,
      location: job.location,
      url: job.url,
      postedDate: this.parseDate(job.postedDate) || new Date(),
      source: 'ProJobIvoire',
    }

    return new JobAd(jobData)
  }

  private parseDate(dateStr: string): Date | null {
    if (!dateStr) return null

    // Parse French date format like "19 décembre 2025"
    const monthMap: Record<string, number> = {
      janvier: 0,
      février: 1,
      mars: 2,
      avril: 3,
      mai: 4,
      juin: 5,
      juillet: 6,
      août: 7,
      septembre: 8,
      octobre: 9,
      novembre: 10,
      décembre: 11,
    }

    const parts = dateStr.trim().split(' ')
    if (parts.length !== 3) return null

    const day = parseInt(parts[0], 10)
    const month = monthMap[parts[1].toLowerCase()]
    const year = parseInt(parts[2], 10)

    if (isNaN(day) || month === undefined || isNaN(year)) return null

    return new Date(year, month, day)
  }
}
