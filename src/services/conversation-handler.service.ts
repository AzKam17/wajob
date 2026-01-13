import { NLPService, IntentClassification } from './nlp.service'
import { ConversationContextService, ConversationContext } from './conversation-context.service'
import type { Redis } from 'ioredis'
import { Logger } from '../utils/logger'
import { DebounceManager, RequestValidator } from '@/utils/debounce'

export interface ConversationResponse {
  context: ConversationContext
  intent: IntentClassification
  shouldSendWelcome: boolean
  shouldSearch: boolean
  shouldPaginate: boolean
  searchQuery?: string
  paginationOffset?: number
}

/**
 * Conversation Handler - Intent-based routing without state machine
 * Routes messages based on NLP intent classification
 */
export class ConversationHandler {
  private nlp: NLPService
  private contextService: ConversationContextService
  private debounceManager: DebounceManager
  private readonly DEBOUNCE_MS = 500

  constructor(redis: Redis) {
    this.nlp = new NLPService()
    this.contextService = new ConversationContextService(redis)
    this.debounceManager = new DebounceManager(this.DEBOUNCE_MS)
  }

  async initialize(): Promise<void> {
    await this.nlp.initialize()
    Logger.success('Conversation handler initialized')
  }

  async handleMessage(phoneNumber: string, message: string): Promise<ConversationResponse> {
    // Get or create context
    const context = await this.contextService.getOrCreate(phoneNumber)

    // Update message count
    await this.contextService.incrementMessageCount(phoneNumber)

    // Classify intent
    const intent = await this.nlp.classify(message)

    Logger.debug('[ConversationHandler] Intent classified', {
      phoneNumber,
      message,
      intent: intent.intent,
      score: intent.score,
    })

    // Determine routing flags
    const shouldSendWelcome = this.shouldSendWelcome(context, intent)
    const shouldPaginate = this.shouldPaginate(intent, context)
    const shouldSearch = this.shouldSearch(intent)

    // Extract search query if intent is job.search
    const searchQuery = shouldSearch ? this.extractSearchQuery(message, intent) : undefined

    // Extract pagination offset if intent is pagination
    const paginationOffset = shouldPaginate ? this.extractPaginationOffset(intent, context) : undefined

    return {
      context,
      intent,
      shouldSendWelcome,
      shouldSearch,
      shouldPaginate,
      searchQuery,
      paginationOffset,
    }
  }

  /**
   * Should send welcome message?
   * - First message from user (no welcomeSentAt)
   * - Intent is greeting or icebreaker
   */
  private shouldSendWelcome(context: ConversationContext, intent: IntentClassification): boolean {
    if (context.welcomeSentAt) {
      return false
    }

    return (
      intent.intent === 'greeting' ||
      intent.intent === 'icebreaker' ||
      context.messageCount === 1
    )
  }

  /**
   * Should perform job search?
   * - Intent is job.search
   * - Score is above threshold
   */
  private shouldSearch(intent: IntentClassification): boolean {
    return intent.intent === 'job.search' && intent.score > 0.7
  }

  /**
   * Should paginate?
   * - Intent is pagination
   * - User has previous query in context
   */
  private shouldPaginate(intent: IntentClassification, context: ConversationContext): boolean {
    return intent.intent === 'pagination' && !!context.lastQuery
  }

  /**
   * Extract search query from message
   * For now, just use the original message as the query
   */
  private extractSearchQuery(message: string, _intent: IntentClassification): string {
    // If NLP extracted entities, we could use them here
    // For now, just return the trimmed message
    return message.trim()
  }

  /**
   * Extract pagination offset
   * Default to next page (lastOffset + 5)
   */
  private extractPaginationOffset(_intent: IntentClassification, context: ConversationContext): number {
    const currentOffset = context.lastOffset || 0
    return currentOffset + 5
  }

  /**
   * Mark welcome as sent for a user
   */
  async markWelcomeSent(phoneNumber: string): Promise<void> {
    await this.contextService.markWelcomeSent(phoneNumber)
  }

  /**
   * Update last query in context
   */
  async updateLastQuery(phoneNumber: string, query: string, offset: number): Promise<void> {
    await this.contextService.updateLastQuery(phoneNumber, query, offset)
  }

  /**
   * Get current context for a user
   */
  async getContext(phoneNumber: string): Promise<ConversationContext> {
    return this.contextService.getOrCreate(phoneNumber)
  }

  /**
   * Clear context for a user (useful for testing)
   */
  async clearContext(phoneNumber: string): Promise<void> {
    await this.contextService.clearContext(phoneNumber)
  }

  /**
   * Generate a new request ID and store it in context
   */
  async generateAndStoreRequestId(phoneNumber: string): Promise<string> {
    const requestId = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
    await this.contextService.updateLatestRequestId(phoneNumber, requestId)
    return requestId
  }

  /**
   * Check if a request ID is still the latest one
   */
  async isLatestRequest(phoneNumber: string, requestId: string): Promise<boolean> {
    const context = await this.contextService.getOrCreate(phoneNumber)
    return RequestValidator.isLatestRequest(requestId, context.latestRequestId)
  }

  /**
   * Get the debounce manager
   */
  getDebounceManager(): DebounceManager {
    return this.debounceManager
  }
}
