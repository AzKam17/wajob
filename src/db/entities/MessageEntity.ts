import { Entity, Column, Index, ManyToOne, JoinColumn } from 'typeorm'
import { BaseEntity } from './BaseEntity'

@Entity('messages')
@Index(['conversationId', 'timestamp'])
@Index(['phoneNumber', 'timestamp'])
@Index(['sessionId'])
export class MessageEntity extends BaseEntity {
  @Column('varchar', { length: 36 })
  conversationId!: string

  @Column('varchar', { length: 36 })
  sessionId!: string

  @Column('varchar', { length: 20 })
  phoneNumber!: string

  @Column('bigint')
  @Index()
  timestamp!: number

  @Column('varchar', { length: 10 })
  direction!: 'incoming' | 'outgoing'

  @Column('json')
  content!: {
    type: 'text' | 'template' | 'interactive'
    text?: string
    templateName?: string
    buttons?: any[]
  }

  @Column('json', { nullable: true })
  metadata?: {
    state?: string
    processedAt?: number
    jobOffersCount?: number
  }

  @ManyToOne('ConversationEntity', 'messages')
  @JoinColumn({ name: 'conversationId' })
  conversation?: any
}
