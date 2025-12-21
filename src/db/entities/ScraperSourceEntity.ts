import { Entity, Column } from 'typeorm'
import { BaseEntity } from './BaseEntity'

@Entity('scraper_sources')
export class ScraperSourceEntity extends BaseEntity {
  @Column({ unique: true })
  name!: string

  @Column()
  url!: string

  @Column('datetime', { nullable: true })
  lastScrapedAt?: Date

  @Column({ nullable: true })
  lastPageScrapped?: number

  @Column({ default: true })
  isActive!: boolean

  @Column({ default: false })
  shouldScrapeNext!: boolean

  @Column({ nullable: true })
  scrapeInterval?: number

  @Column({ nullable: true })
  maxPages?: number

  @Column({ default: 0 })
  totalJobsFound!: number
}
