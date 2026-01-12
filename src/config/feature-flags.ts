import { Logger } from '../utils/logger'

/**
 * Feature Flags Configuration
 * Centralized management of feature rollouts
 */

export interface FeatureFlags {
  nlpConversation: string[] // Phone numbers enabled for NLP-based conversation
}

// Default feature flags - can be overridden by environment variables
const DEFAULT_FLAGS: FeatureFlags = {
  nlpConversation: [],
}

class FeatureFlagService {
  private flags: FeatureFlags

  constructor() {
    this.flags = this.loadFromEnvironment()
    this.logEnabledFeatures()
  }

  /**
   * Check if NLP conversation is enabled for a phone number
   */
  isNLPConversationEnabled(phoneNumber: string): boolean {
    return this.flags.nlpConversation.includes(phoneNumber)
  }

  /**
   * Add phone number to NLP beta
   */
  enableNLPForUser(phoneNumber: string): void {
    if (!this.flags.nlpConversation.includes(phoneNumber)) {
      this.flags.nlpConversation.push(phoneNumber)
      Logger.info('Enabled NLP conversation', { phoneNumber })
    }
  }

  /**
   * Remove phone number from NLP beta
   */
  disableNLPForUser(phoneNumber: string): void {
    const index = this.flags.nlpConversation.indexOf(phoneNumber)
    if (index > -1) {
      this.flags.nlpConversation.splice(index, 1)
      Logger.info('Disabled NLP conversation', { phoneNumber })
    }
  }

  /**
   * Get all users in NLP beta
   */
  getNLPBetaUsers(): string[] {
    return [...this.flags.nlpConversation]
  }

  /**
   * Get current feature flags (for debugging)
   */
  getFlags(): FeatureFlags {
    return { ...this.flags }
  }

  /**
   * Load feature flags from environment variables
   * Format: NLP_CONVERSATION_USERS="+1234567890,+0987654321"
   */
  private loadFromEnvironment(): FeatureFlags {
    const flags: FeatureFlags = { ...DEFAULT_FLAGS }

    // Load NLP conversation users from env
    const nlpUsers = process.env.NLP_CONVERSATION_USERS
    if (nlpUsers) {
      flags.nlpConversation = nlpUsers
        .split(',')
        .map(phone => phone.trim())
        .filter(phone => phone.length > 0)
    }

    return flags
  }

  private logEnabledFeatures(): void {
    Logger.info('Feature flags loaded', {
      nlpConversationUsers: this.flags.nlpConversation.length,
      users: this.flags.nlpConversation,
    })
  }
}

// Singleton instance
let featureFlagServiceInstance: FeatureFlagService | null = null

export function getFeatureFlagService(): FeatureFlagService {
  if (!featureFlagServiceInstance) {
    featureFlagServiceInstance = new FeatureFlagService()
  }
  return featureFlagServiceInstance
}

// Export for direct access if needed
export const FeatureFlags = {
  isNLPEnabled: (phoneNumber: string) => getFeatureFlagService().isNLPConversationEnabled(phoneNumber),
  enableNLP: (phoneNumber: string) => getFeatureFlagService().enableNLPForUser(phoneNumber),
  disableNLP: (phoneNumber: string) => getFeatureFlagService().disableNLPForUser(phoneNumber),
  getNLPUsers: () => getFeatureFlagService().getNLPBetaUsers(),
}
