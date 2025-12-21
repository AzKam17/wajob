import { Entity, Column, ManyToOne, JoinColumn } from 'typeorm'
import { BaseEntity } from './BaseEntity'
import { ScraperSourceEntity } from './ScraperSourceEntity'

@Entity('scrape_sessions')
export class ScrapeSessionEntity extends BaseEntity {
  @Column({ unique: true })
  sessionId!: string

  @Column()
  sourceId!: string

  @ManyToOne(() => ScraperSourceEntity)
  @JoinColumn({ name: 'sourceId' })
  source!: ScraperSourceEntity

  @Column()
  sourceName!: string

  @Column()
  mode!: 'manual' | 'automatic'

  @Column()
  status!: 'pending' | 'in_progress' | 'completed' | 'failed'

  @Column('datetime')
  startedAt!: Date

  @Column('datetime', { nullable: true })
  completedAt?: Date

  @Column({ default: 0 })
  pagesScraped!: number

  @Column({ default: 0 })
  jobsFound!: number

  @Column('simple-json', { nullable: true })
  errors?: string[]
}
