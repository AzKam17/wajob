export interface JobAdData {
  title: string
  url: string
  postedDate: Date
  source: string
}

export class JobAd {
  id?: string
  createdAt?: Date
  updatedAt?: Date

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
      id: this.id,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
      title: this.title,
      url: this.url,
      postedDate: this.postedDate,
      source: this.source,
    }
  }
}
