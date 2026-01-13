import { WhatsAppWebhookPayload } from '@microfox/whatsapp-business'
import { BotUserRepository } from '../db/repositories/BotUserRepository'
import { BotMessages } from './bot-messages.service'
import { JobSearchService } from './job-search.service'
import { Logger } from '../utils/logger'
import { ConversationHandler } from './conversation-handler.service'
import { ChatHistoryService } from './chat-history.service'
import type { Redis } from 'ioredis'

/**
 * NLP-Based WhatsApp Message Service
 * BETA VERSION - Uses intent classification instead of state machine
 * Simpler, more flexible, easier to extend
 */
export class WhatsAppMessageNLPService {
  private botMessages = new BotMessages()
  private botUserRepo = new BotUserRepository()
  private jobSearch = new JobSearchService()
  private conversationHandler: ConversationHandler

  // Track processed message IDs to prevent duplicate processing
  private processedMessages = new Set<string>()
  private readonly MAX_PROCESSED_CACHE = 1000

  constructor(
    redis: Redis,
    private readonly chatHistory: ChatHistoryService
  ) {
    this.conversationHandler = new ConversationHandler(redis)
  }

  /**
   * Initialize NLP models (call once on startup)
   */
  async initialize(): Promise<void> {
    await this.conversationHandler.initialize()
    Logger.success('NLP-based message service initialized')
  }

  async handleIncomingMessage(payload: WhatsAppWebhookPayload): Promise<void> {
    try {
      Logger.info('[NLP] Webhook received', {
        entriesCount: payload.entry.length,
        changesCount: payload.entry.reduce((acc, e) => acc + e.changes.length, 0),
        messagesCount: payload.entry.reduce((acc, e) =>
          acc + e.changes.reduce((acc2, c) => acc2 + (c.value.messages?.length || 0), 0), 0
        )
      })

      for (const entry of payload.entry) {
        for (const change of entry.changes) {
          const { messages, contacts } = change.value

          if (!messages || messages.length === 0) {
            Logger.debug('[NLP] No messages in webhook payload')
            continue
          }

          for (const message of messages) {
            const from = message.from
            const messageId = message.id
            const contactName = contacts?.[0]?.profile?.name || 'User'

            // Check if we've already processed this message
            if (this.processedMessages.has(messageId)) {
              Logger.warn('[NLP] Duplicate message detected, skipping', { messageId, from })
              continue
            }

            // Add to processed set
            this.processedMessages.add(messageId)

            // Limit cache size
            if (this.processedMessages.size > this.MAX_PROCESSED_CACHE) {
              const firstItem = this.processedMessages.values().next().value
              if (firstItem) {
                this.processedMessages.delete(firstItem)
              }
            }

            Logger.info('[NLP] Processing incoming message', {
              from,
              messageId,
              contactName,
              type: message.type
            })

            // Handle non-text messages
            if (message.type !== 'text') {
              Logger.info('[NLP] Received non-text message, sending unsupported media response', {
                type: message.type,
                from
              })

              await this.botMessages.sendTypingIndicator(messageId)
              await this.botMessages.sendUnsupportedMediaMessage(from, message.type)

              const context = await this.conversationHandler.getContext(from)
              await this.chatHistory.saveIncomingMessage(
                from,
                context.sessionId,
                `[${message.type} message - not supported]`,
                'active'
              )
              await this.chatHistory.saveOutgoingTextMessage(
                from,
                context.sessionId,
                'Unsupported media type response',
                'active'
              )

              continue
            }

            // Send typing indicator
            await this.botMessages.sendTypingIndicator(messageId)

            const messageText = message.text.body.trim()

            // Process message through NLP conversation handler
            const response = await this.conversationHandler.handleMessage(from, messageText)

            Logger.info('[NLP] Conversation response', {
              from,
              intent: response.intent.intent,
              score: response.intent.score,
              shouldSendWelcome: response.shouldSendWelcome,
              shouldSearch: response.shouldSearch,
              shouldPaginate: response.shouldPaginate,
            })

            // Save incoming message to chat history
            await this.chatHistory.saveIncomingMessage(
              from,
              response.context.sessionId,
              messageText,
              'active'
            )

            // Ensure user exists in database
            const existingUser = await this.botUserRepo.findByPhoneNumber(from)
            if (!existingUser) {
              await this.botUserRepo.create({
                phoneNumber: from,
                preferences: {},
                lastMessageAt: new Date(),
              })
            } else {
              await this.botUserRepo.update(existingUser.id, {
                lastMessageAt: new Date(),
              })
            }

            // Route based on intent and flags
            await this.routeMessage(from, messageText, contactName, response, existingUser)
          }
        }
      }
    } catch (error) {
      Logger.error('[NLP] Error handling incoming message', { error })
      throw error
    }
  }

  /**
   * Route message based on conversation response
   * Intent-based routing - much simpler than state machine
   */
  private async routeMessage(
    from: string,
    _messageText: string,
    contactName: string,
    response: any,
    existingUser: any
  ): Promise<void> {
    const { context, intent, shouldSendWelcome, shouldSearch, shouldPaginate, searchQuery, paginationOffset } = response

    // WELCOME FLOW
    if (shouldSendWelcome) {
      Logger.info('[NLP] Sending welcome flow', { from })
      await this.botMessages.sendWelcomeFlow(from, contactName)
      await this.chatHistory.saveOutgoingTemplateMessage(
        from,
        context.sessionId,
        'eska_job_title_prompt',
        'welcomed'
      )
      await this.conversationHandler.markWelcomeSent(from)
      await this.chatHistory.updateConversationMetadata(from, { welcomeSent: true })
      Logger.success('[NLP] Welcome flow sent successfully', { to: from })
    }

    // PAGINATION FLOW (no debounce for pagination)
    if (shouldPaginate && context.lastQuery) {
      Logger.info('[NLP] Processing pagination request', {
        from,
        query: context.lastQuery,
        offset: paginationOffset
      })

      await this.executeJobSearch(from, context.sessionId, context.lastQuery, paginationOffset || 0, existingUser)
      return
    }

    // JOB SEARCH FLOW (with debounce)
    if (shouldSearch && searchQuery) {
      Logger.info('[NLP] Scheduling debounced job search', {
        from,
        query: searchQuery,
        intent: intent.intent
      })

      // Generate and store request ID
      const requestId = await this.conversationHandler.generateAndStoreRequestId(from)

      // Schedule search with debounce
      this.conversationHandler.getDebounceManager().scheduleRequest(
        from,
        searchQuery,
        async (finalRequestId, finalQuery) => {
          Logger.info('[NLP] Executing debounced job search', {
            from,
            query: finalQuery,
            requestId: finalRequestId,
          })

          await this.executeJobSearch(from, context.sessionId, finalQuery, 0, existingUser, finalRequestId)
        }
      )
      return
    }

    // GREETING/ICEBREAKER (already handled by welcome if needed)
    if (intent.intent === 'greeting' || intent.intent === 'icebreaker') {
      // Welcome was already sent if needed, nothing more to do
      if (!shouldSendWelcome) {
        // Just acknowledge if this is not the first message
        Logger.info('[NLP] Greeting/icebreaker acknowledged', { from })
      }
      return
    }

    // HELP
    if (intent.intent === 'help') {
      const helpMessage = "Je suis un bot qui vous aide à trouver des offres d'emploi. 🤖\n\nEnvoyez-moi simplement le titre du poste que vous recherchez! 💼\n\nExemples:\n- Développeur web\n- Comptable\n- Chef de projet"
      await this.botMessages.sendTextMessage(from, helpMessage)
      await this.chatHistory.saveOutgoingTextMessage(from, context.sessionId, helpMessage, 'active')
      return
    }

    // GOODBYE
    if (intent.intent === 'goodbye') {
      const goodbyeMessage = "Au revoir! N'hésitez pas à revenir quand vous voulez. 👋"
      await this.botMessages.sendTextMessage(from, goodbyeMessage)
      await this.chatHistory.saveOutgoingTextMessage(from, context.sessionId, goodbyeMessage, 'active')
      return
    }

    // PAGINATION WITHOUT CONTEXT
    if (intent.intent === 'pagination' && !context.lastQuery) {
      const message = "Veuillez d'abord effectuer une recherche en m'indiquant le poste que vous recherchez! 💼"
      await this.botMessages.sendTextMessage(from, message)
      await this.chatHistory.saveOutgoingTextMessage(from, context.sessionId, message, 'active')
      return
    }

    // UNKNOWN/LOW CONFIDENCE
    Logger.debug('[NLP] Unknown intent or low confidence, no action taken', {
      from,
      intent: intent.intent,
      score: intent.score
    })
  }

  /**
   * Execute job search and send results
   */
  private async executeJobSearch(
    from: string,
    sessionId: string,
    query: string,
    offset: number,
    existingUser: any,
    requestId?: string
  ): Promise<void> {
    // Send processing message to user
    if (offset === 0) {
      // First search
      const searchingMessages = [
        '🔍 Recherche en cours...',
        '⏳ Je cherche pour vous...',
        '🔎 Analyse des offres disponibles...',
        '💼 Recherche des meilleures opportunités...',
      ]
      const randomMessage = searchingMessages[Math.floor(Math.random() * searchingMessages.length)]
      await this.botMessages.sendTextMessage(from, randomMessage)
    } else {
      // Pagination
      const paginationMessages = [
        '🔍 Recherche d\'autres offres...',
        '⏳ Je cherche plus d\'opportunités...',
        '🔎 Chargement d\'autres résultats...',
        '💼 Recherche de nouvelles offres similaires...',
      ]
      const randomMessage = paginationMessages[Math.floor(Math.random() * paginationMessages.length)]
      await this.botMessages.sendTextMessage(from, randomMessage)
    }

    const jobs = await this.jobSearch.searchJobs(query, from, offset)

    Logger.info('[NLP] Jobs retrieved from search', {
      from,
      query,
      offset,
      count: jobs.length,
      requestId,
    })

    // If requestId provided, validate it's still the latest before sending results
    if (requestId) {
      const isLatest = await this.conversationHandler.isLatestRequest(from, requestId)
      if (!isLatest) {
        Logger.info('[NLP] Discarding outdated search results', {
          from,
          query,
          requestId,
          reason: 'newer request exists',
        })
        return // Discard results, newer request exists
      }
    }

    if (jobs.length > 0) {
      await this.sendJobResults(from, sessionId, jobs, query, offset, existingUser)
    } else {
      await this.handleNoJobsFound(from, sessionId, query, offset, existingUser)
    }
  }

  /**
   * Send job results to user
   */
  private async sendJobResults(
    from: string,
    sessionId: string,
    jobs: any[],
    query: string,
    offset: number,
    existingUser: any
  ): Promise<void> {
    await this.botMessages.sendMultipleJobOffers(from, jobs)
    await this.chatHistory.saveOutgoingInteractiveMessage(
      from,
      sessionId,
      'Job offers',
      jobs.map((j) => j.title),
      'active',
      jobs.length
    )

    await this.chatHistory.updateConversationMetadata(from, {
      jobOffersShownCount: jobs.length,
    })

    // Send "see more" prompt after 15 seconds
    setTimeout(() => {
      this.botMessages.sendSeeMorePrompt(from)
    }, 15_000)

    // Store query and offset for pagination
    if (existingUser) {
      await this.botUserRepo.update(existingUser.id, {
        preferences: {
          ...existingUser.preferences,
          lastQuery: query,
          lastOffset: offset,
        },
      })
    }
  }

  /**
   * Handle case when no jobs are found
   */
  private async handleNoJobsFound(
    from: string,
    sessionId: string,
    query: string,
    offset: number,
    existingUser: any
  ): Promise<void> {
    if (offset > 0) {
      // No more results available for pagination
      const noMoreMessage =
        "Il n'y a plus d'offres disponibles pour cette recherche. 😔\n\nVous pouvez effectuer une nouvelle recherche! 🔍"

      await this.botMessages.sendTextMessage(from, noMoreMessage)
      await this.chatHistory.saveOutgoingTextMessage(from, sessionId, noMoreMessage, 'active')
    } else {
      // No exact matches on first page - try similar jobs
      await this.searchSimilarJobs(from, sessionId, query, existingUser)
    }
  }

  /**
   * Search and send similar jobs when no exact matches found
   */
  private async searchSimilarJobs(
    from: string,
    sessionId: string,
    query: string,
    existingUser: any
  ): Promise<void> {
    const similarJobs = await this.jobSearch.searchSimilarJobs(query, from, 0)

    if (similarJobs.length > 0) {
      await this.botMessages.sendNoExactMatchMessage(from)
      await this.botMessages.sendMultipleJobOffers(from, similarJobs)

      await this.chatHistory.saveOutgoingInteractiveMessage(
        from,
        sessionId,
        'Similar job offers',
        similarJobs.map((j) => j.title),
        'active',
        similarJobs.length
      )

      // Send "see more" prompt after 15 seconds
      setTimeout(() => {
        this.botMessages.sendSeeMorePrompt(from)
      }, 15_000)

      // Store query for pagination
      if (existingUser) {
        await this.botUserRepo.update(existingUser.id, {
          preferences: {
            ...existingUser.preferences,
            lastQuery: query,
            lastOffset: 0,
          },
        })
      }
    } else {
      // No jobs at all
      const contactName = existingUser?.preferences?.contactName || 'User'
      await this.botMessages.sendNoJobsFoundMessage(from, query, contactName)
      await this.chatHistory.saveOutgoingTextMessage(
        from,
        sessionId,
        'No jobs found for this search',
        'active'
      )
    }
  }

  async verifyWebhook(mode: string, token: string, _challenge: string): Promise<boolean> {
    const verifyToken = process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN || 'your-verify-token-here'

    if (mode === 'subscribe' && token === verifyToken) {
      Logger.success('[NLP] Webhook verified successfully')
      return true
    }

    Logger.warn('[NLP] Webhook verification failed', { mode, token })
    return false
  }
}
