export interface JobAdData {
  title: string
  url: string
  postedDate: Date
  source: string
  company?: string
  location?: string
  description?: string
  pageMetadata?: Record<string, any>
  internalExtras?: Record<string, any>
}

export class JobAd {
  id?: string
  createdAt?: Date
  updatedAt?: Date

  title: string
  url: string
  postedDate: Date
  source: string
  company?: string
  location?: string
  description?: string
  pageMetadata?: Record<string, any>
  internalExtras?: Record<string, any>

  constructor(data: JobAdData) {
    this.title = data.title
    this.url = data.url
    this.postedDate = data.postedDate
    this.source = data.source
    this.company = data.company
    this.location = data.location
    this.description = data.description
    this.pageMetadata = data.pageMetadata
    this.internalExtras = { version: '2', ...data.internalExtras }

    console.log(`JobAd created: ${this.title} from ${this.source}`)
  }

  toJSON() {
    return {
      id: this.id,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
      title: this.title,
      company: this.company,
      location: this.location,
      description: this.description,
      url: this.url,
      postedDate: this.postedDate,
      source: this.source,
      pageMetadata: this.pageMetadata,
      internalExtras: this.internalExtras,
    }
  }
}
