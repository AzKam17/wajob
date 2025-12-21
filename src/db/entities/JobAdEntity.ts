import { Entity, Column } from 'typeorm'
import { BaseEntity } from './BaseEntity'

@Entity('job_ads')
export class JobAdEntity extends BaseEntity {
  @Column()
  title!: string

  @Column({ unique: true })
  url!: string

  @Column('datetime')
  postedDate!: Date

  @Column()
  source!: string
}
