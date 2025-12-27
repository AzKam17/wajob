import { Entity, Column, Index, OneToMany } from 'typeorm'
import { BaseEntity } from './BaseEntity'

@Entity('conversations')
@Index(['phoneNumber', 'startedAt'])
@Index(['sessionId'])
@Index(['status'])
export class ConversationEntity extends BaseEntity {
  @Column('varchar', { length: 20 })
  phoneNumber!: string

  @Column('varchar', { length: 36 })
  sessionId!: string

  @Column('bigint')
  startedAt!: number

  @Column('bigint', { nullable: true })
  endedAt?: number

  @Column('bigint')
  lastActivityAt!: number

  @Column('int', { default: 0 })
  messageCount!: number

  @Column('varchar', { length: 20, default: 'active' })
  status!: 'active' | 'completed' | 'abandoned'

  @Column('json', { nullable: true })
  metadata?: {
    welcomeSent: boolean
    searchQueriesCount: number
    jobOffersShownCount: number
    paginationRequestsCount: number
    finalState?: string
  }

  @OneToMany('MessageEntity', 'conversation')
  messages?: any[]
}
