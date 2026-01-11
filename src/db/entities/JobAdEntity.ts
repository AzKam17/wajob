import { Entity, Column } from 'typeorm'
import { BaseEntity } from './BaseEntity'

@Entity('job_ads')
export class JobAdEntity extends BaseEntity {
  @Column()
  title!: string

  @Column({ nullable: true })
  company?: string

  @Column({ nullable: true })
  location?: string

  @Column({ type: 'text', nullable: true })
  description?: string

  @Column({ unique: true })
  url!: string

  @Column('timestamp')
  postedDate!: Date

  @Column()
  source!: string

  @Column({ type: 'jsonb', nullable: true })
  pageMetadata?: {}
}
