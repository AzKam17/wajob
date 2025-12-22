export interface PersonalizedLinkData {
  phoneNumber: string
  jobAdId: string
  jobAdUrl: string
}

export class PersonalizedLink {
  id?: string
  createdAt?: Date
  updatedAt?: Date

  phoneNumber: string
  jobAdId: string
  jobAdUrl: string
  clickCount: number
  isActive: boolean
  metadata: Record<string, any>

  constructor(data: PersonalizedLinkData) {
    this.phoneNumber = data.phoneNumber
    this.jobAdId = data.jobAdId
    this.jobAdUrl = data.jobAdUrl
    this.clickCount = 0
    this.isActive = true
    this.metadata = {}
  }

  toJSON() {
    return {
      id: this.id,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
      phoneNumber: this.phoneNumber,
      jobAdId: this.jobAdId,
      jobAdUrl: this.jobAdUrl,
      clickCount: this.clickCount,
      isActive: this.isActive,
      metadata: this.metadata,
    }
  }
}
