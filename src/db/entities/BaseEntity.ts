import {
  PrimaryColumn,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
  BeforeInsert,
} from 'typeorm'

export abstract class BaseEntity {
  @PrimaryColumn('varchar', { length: 36 })
  id!: string

  @CreateDateColumn()
  createdAt!: Date

  @UpdateDateColumn()
  updatedAt!: Date

  @DeleteDateColumn()
  deletedAt?: Date

  @BeforeInsert()
  generateId() {
    if (!this.id) {
      this.id = crypto.randomUUID()
    }
  }
}
