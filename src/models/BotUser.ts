export interface BotUserData {
  phoneNumber: string
  preferences?: Record<string, any>
}

export class BotUser {
  id?: string
  createdAt?: Date
  updatedAt?: Date
  lastMessageAt?: Date

  phoneNumber: string
  preferences: Record<string, any>

  constructor(data: BotUserData) {
    this.phoneNumber = data.phoneNumber
    this.preferences = data.preferences || {}
  }

  toJSON() {
    return {
      id: this.id,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
      lastMessageAt: this.lastMessageAt,
      phoneNumber: this.phoneNumber,
      preferences: this.preferences,
    }
  }
}
