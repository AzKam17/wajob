export interface JobAdData {
  title: string
  url: string
  postedDate: Date
  source: string
}

export class JobAd {
  title: string
  url: string
  postedDate: Date
  source: string

  constructor(data: JobAdData) {
    this.title = data.title
    this.url = data.url
    this.postedDate = data.postedDate
    this.source = data.source

    console.log(`JobAd created: ${this.title} from ${this.source}`)
  }

  toJSON() {
    return {
      title: this.title,
      url: this.url,
      postedDate: this.postedDate,
      source: this.source,
    }
  }
}
