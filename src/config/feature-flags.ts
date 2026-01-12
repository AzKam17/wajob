import { Logger } from '../utils/logger'

/**
 * Feature Flags Configuration
 * Centralized management of feature rollouts
 */

export interface FeatureFlags {
  nlpConversation: string[] // Phone numbers enabled for NLP-based conversation
  langchainConversation: string[] // Phone numbers enabled for Langchain+Grok conversation
}

// Default feature flags - can be overridden by environment variables
const DEFAULT_FLAGS: FeatureFlags = {
  nlpConversation: [],
  langchainConversation: [],
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
    // Check if enabled globally for everyone
    if (process.env.NLP_ENABLED_FOR_ALL === 'true') {
      return true
    }
    // Otherwise check if user is in the beta list
    return this.flags.nlpConversation.includes(phoneNumber)
  }

  /**
   * Check if Langchain conversation is enabled for a phone number
   */
  isLangchainConversationEnabled(phoneNumber: string): boolean {
    // Check if enabled globally for everyone
    if (process.env.LANGCHAIN_ENABLED_FOR_ALL === 'true') {
      return true
    }
    // Otherwise check if user is in the beta list
    return this.flags.langchainConversation.includes(phoneNumber)
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
   * Add phone number to Langchain beta
   */
  enableLangchainForUser(phoneNumber: string): void {
    if (!this.flags.langchainConversation.includes(phoneNumber)) {
      this.flags.langchainConversation.push(phoneNumber)
      Logger.info('Enabled Langchain conversation', { phoneNumber })
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
   * Remove phone number from Langchain beta
   */
  disableLangchainForUser(phoneNumber: string): void {
    const index = this.flags.langchainConversation.indexOf(phoneNumber)
    if (index > -1) {
      this.flags.langchainConversation.splice(index, 1)
      Logger.info('Disabled Langchain conversation', { phoneNumber })
    }
  }

  /**
   * Get all users in NLP beta
   */
  getNLPBetaUsers(): string[] {
    return [...this.flags.nlpConversation]
  }

  /**
   * Get all users in Langchain beta
   */
  getLangchainBetaUsers(): string[] {
    return [...this.flags.langchainConversation]
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

    // Load Langchain conversation users from env
    const langchainUsers = process.env.LANGCHAIN_CONVERSATION_USERS
    if (langchainUsers) {
      flags.langchainConversation = langchainUsers
        .split(',')
        .map(phone => phone.trim())
        .filter(phone => phone.length > 0)
    }

    return flags
  }

  private logEnabledFeatures(): void {
    const nlpEnabledForAll = process.env.NLP_ENABLED_FOR_ALL === 'true'
    const langchainEnabledForAll = process.env.LANGCHAIN_ENABLED_FOR_ALL === 'true'

    Logger.info('Feature flags loaded', {
      nlpEnabledForAll,
      nlpConversationUsers: this.flags.nlpConversation.length,
      nlpUsers: nlpEnabledForAll ? 'ALL USERS' : this.flags.nlpConversation,
      langchainEnabledForAll,
      langchainConversationUsers: this.flags.langchainConversation.length,
      langchainUsers: langchainEnabledForAll ? 'ALL USERS' : this.flags.langchainConversation,
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
  isLangchainEnabled: (phoneNumber: string) => getFeatureFlagService().isLangchainConversationEnabled(phoneNumber),
  enableLangchain: (phoneNumber: string) => getFeatureFlagService().enableLangchainForUser(phoneNumber),
  disableLangchain: (phoneNumber: string) => getFeatureFlagService().disableLangchainForUser(phoneNumber),
  getLangchainUsers: () => getFeatureFlagService().getLangchainBetaUsers(),
}
