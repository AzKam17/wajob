import { Entity, Column } from 'typeorm'
import { BaseEntity } from './BaseEntity'

@Entity('bot_users')
export class BotUserEntity extends BaseEntity {
  @Column({ unique: true })
  phoneNumber!: string

  @Column('datetime', { nullable: true })
  lastMessageAt?: Date

  @Column('simple-json')
  preferences!: Record<string, any>
}
