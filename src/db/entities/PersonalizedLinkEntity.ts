import { Entity, Column } from 'typeorm'
import { BaseEntity } from './BaseEntity'

@Entity('personalized_links')
export class PersonalizedLinkEntity extends BaseEntity {
  @Column()
  phoneNumber!: string

  @Column()
  jobAdId!: string

  @Column()
  jobAdUrl!: string

  @Column('int', { default: 0 })
  clickCount!: number

  @Column('boolean', { default: true })
  isActive!: boolean

  @Column('simple-json')
  metadata!: Record<string, any>
}
