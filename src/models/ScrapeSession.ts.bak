export enum ScrapeMode {
  MANUAL = 'manual',
  AUTOMATIC = 'automatic',
}

export enum ScrapeStatus {
  PENDING = 'pending',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
  FAILED = 'failed',
}

export interface ScrapeSessionData {
  sourceName: string
  mode: ScrapeMode
  status: ScrapeStatus
  startedAt: Date
  completedAt?: Date
  pagesScraped: number
  jobsFound: number
  errors?: string[]
}

export class ScrapeSession {
  id: string
  sourceName: string
  mode: ScrapeMode
  status: ScrapeStatus
  startedAt: Date
  completedAt?: Date
  pagesScraped: number
  jobsFound: number
  errors: string[]

  constructor(data: ScrapeSessionData) {
    this.id = this.generateId()
    this.sourceName = data.sourceName
    this.mode = data.mode
    this.status = data.status
    this.startedAt = data.startedAt
    this.completedAt = data.completedAt
    this.pagesScraped = data.pagesScraped
    this.jobsFound = data.jobsFound
    this.errors = data.errors || []

    console.log(
      `ScrapeSession created: ${this.sourceName} [${this.mode}] - ${this.id}`
    )
  }

  private generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`
  }

  markInProgress(): void {
    this.status = ScrapeStatus.IN_PROGRESS
  }

  markCompleted(pagesScraped: number, jobsFound: number): void {
    this.status = ScrapeStatus.COMPLETED
    this.completedAt = new Date()
    this.pagesScraped = pagesScraped
    this.jobsFound = jobsFound
  }

  markFailed(error: string): void {
    this.status = ScrapeStatus.FAILED
    this.completedAt = new Date()
    this.errors.push(error)
  }

  addError(error: string): void {
    this.errors.push(error)
  }

  getDuration(): number | null {
    if (!this.completedAt) return null
    return this.completedAt.getTime() - this.startedAt.getTime()
  }

  toJSON() {
    return {
      id: this.id,
      sourceName: this.sourceName,
      mode: this.mode,
      status: this.status,
      startedAt: this.startedAt,
      completedAt: this.completedAt,
      pagesScraped: this.pagesScraped,
      jobsFound: this.jobsFound,
      errors: this.errors,
      duration: this.getDuration(),
    }
  }
}
