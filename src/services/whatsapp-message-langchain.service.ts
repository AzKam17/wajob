import { WhatsAppWebhookPayload } from '@microfox/whatsapp-business'
import { BotUserRepository } from '../db/repositories/BotUserRepository'
import { BotMessages } from './bot-messages.service'
import { JobSearchService } from './job-search.service'
import { Logger } from '../utils/logger'
import { LangchainService, ConversationAction } from './langchain.service'
import { ChatHistoryService } from './chat-history.service'
import type { Redis } from 'ioredis'

interface ConversationContext {
  sessionId: string
  welcomeSent: boolean
  lastQuery?: string
  lastOffset?: number
}

/**
 * Langchain+Grok WhatsApp Message Service
 * Uses LLM for intelligent conversation handling
 */
export class WhatsAppMessageLangchainService {
  private botMessages = new BotMessages()
  private botUserRepo = new BotUserRepository()
  private jobSearch = new JobSearchService()
  private langchain: LangchainService
  private contextCache = new Map<string, ConversationContext>()

  // Track processed message IDs to prevent duplicate processing
  private processedMessages = new Set<string>()
  private readonly MAX_PROCESSED_CACHE = 1000

  constructor(
    redis: Redis,
    private readonly chatHistory: ChatHistoryService
  ) {
    this.langchain = new LangchainService(redis)
  }

  async handleIncomingMessage(payload: WhatsAppWebhookPayload): Promise<void> {
    try {
      Logger.info('[Langchain] Webhook received', {
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
            Logger.debug('[Langchain] No messages in webhook payload')
            continue
          }

          for (const message of messages) {
            const from = message.from
            const messageId = message.id
            const contactName = contacts?.[0]?.profile?.name || 'User'

            // Check if we've already processed this message
            if (this.processedMessages.has(messageId)) {
              Logger.warn('[Langchain] Duplicate message detected, skipping', { messageId, from })
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

            Logger.info('[Langchain] Processing incoming message', {
              from,
              messageId,
              contactName,
              type: message.type
            })

            // Handle non-text messages
            if (message.type !== 'text') {
              Logger.info('[Langchain] Received non-text message, sending unsupported media response', {
                type: message.type,
                from
              })

              await this.botMessages.sendTypingIndicator(messageId)
              await this.botMessages.sendUnsupportedMediaMessage(from, message.type)

              const context = this.getOrCreateContext(from)
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

            // Analyze message using Langchain+Grok
            const action = await this.langchain.analyzeMessage(from, messageText)

            Logger.info('[Langchain] Action determined', {
              from,
              action: action.action,
              confidence: action.confidence,
              query: action.query,
            })

            // Get context
            const context = this.getOrCreateContext(from)

            // Save incoming message to chat history
            await this.chatHistory.saveIncomingMessage(
              from,
              context.sessionId,
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

            // Route based on action
            await this.routeMessage(from, contactName, action, context, existingUser)
          }
        }
      }
    } catch (error) {
      Logger.error('[Langchain] Error handling incoming message', { error })
      throw error
    }
  }

  /**
   * Route message based on Langchain action
   */
  private async routeMessage(
    from: string,
    contactName: string,
    action: ConversationAction,
    context: ConversationContext,
    existingUser: any
  ): Promise<void> {
    // WELCOME FLOW
    if (action.action === 'welcome' && !context.welcomeSent) {
      Logger.info('[Langchain] Sending welcome flow', { from })
      await this.botMessages.sendWelcomeFlow(from, contactName)
      await this.chatHistory.saveOutgoingTemplateMessage(
        from,
        context.sessionId,
        'eska_job_title_prompt',
        'welcomed'
      )
      context.welcomeSent = true
      await this.chatHistory.updateConversationMetadata(from, { welcomeSent: true })
      Logger.success('[Langchain] Welcome flow sent successfully', { to: from })
      return
    }

    // JOB SEARCH FLOW
    if (action.action === 'search' && action.query) {
      Logger.info('[Langchain] Processing job search', {
        from,
        query: action.query,
      })

      await this.executeJobSearch(from, context.sessionId, action.query, 0, existingUser)
      context.lastQuery = action.query
      context.lastOffset = 0
      return
    }

    // PAGINATION FLOW
    if (action.action === 'paginate' && context.lastQuery) {
      const offset = context.lastOffset || 0
      const newOffset = offset + (action.offset || 5)

      Logger.info('[Langchain] Processing pagination request', {
        from,
        query: context.lastQuery,
        offset: newOffset
      })

      await this.executeJobSearch(from, context.sessionId, context.lastQuery, newOffset, existingUser)
      context.lastOffset = newOffset
      return
    }

    // PAGINATION WITHOUT CONTEXT
    if (action.action === 'paginate' && !context.lastQuery) {
      const message = "Veuillez d'abord effectuer une recherche en m'indiquant le poste que vous recherchez! 💼"
      await this.botMessages.sendTextMessage(from, message)
      await this.chatHistory.saveOutgoingTextMessage(from, context.sessionId, message, 'active')
      return
    }

    // HELP
    if (action.action === 'help') {
      const helpMessage = "Je suis un bot qui vous aide à trouver des offres d'emploi. 🤖\n\nEnvoyez-moi simplement le titre du poste que vous recherchez! 💼\n\nExemples:\n- Développeur web\n- Comptable\n- Chef de projet"
      await this.botMessages.sendTextMessage(from, helpMessage)
      await this.chatHistory.saveOutgoingTextMessage(from, context.sessionId, helpMessage, 'active')
      return
    }

    // GOODBYE
    if (action.action === 'goodbye') {
      const goodbyeMessage = "Au revoir! N'hésitez pas à revenir quand vous voulez. 👋"
      await this.botMessages.sendTextMessage(from, goodbyeMessage)
      await this.chatHistory.saveOutgoingTextMessage(from, context.sessionId, goodbyeMessage, 'active')
      return
    }

    // UNKNOWN - Ask for clarification
    if (action.confidence < 0.6) {
      const clarificationMessage = "Désolé, je n'ai pas bien compris. 😅\n\nPouvez-vous m'indiquer le titre du poste que vous recherchez?\n\nOu tapez 'aide' pour plus d'informations."
      await this.botMessages.sendTextMessage(from, clarificationMessage)
      await this.chatHistory.saveOutgoingTextMessage(from, context.sessionId, clarificationMessage, 'active')
      return
    }

    Logger.debug('[Langchain] No action taken', {
      from,
      action: action.action,
      confidence: action.confidence
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
    existingUser: any
  ): Promise<void> {
    const jobs = await this.jobSearch.searchJobs(query, from, offset)

    Logger.info('[Langchain] Jobs retrieved from search', {
      from,
      query,
      offset,
      count: jobs.length,
    })

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
        `No jobs found for: ${query}`,
        'active'
      )
    }
  }

  /**
   * Get or create conversation context
   */
  private getOrCreateContext(phoneNumber: string): ConversationContext {
    if (!this.contextCache.has(phoneNumber)) {
      this.contextCache.set(phoneNumber, {
        sessionId: `langchain-${Date.now()}-${phoneNumber}`,
        welcomeSent: false,
      })
    }
    return this.contextCache.get(phoneNumber)!
  }

  async verifyWebhook(mode: string, token: string, _challenge: string): Promise<boolean> {
    const verifyToken = process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN || 'your-verify-token-here'

    if (mode === 'subscribe' && token === verifyToken) {
      Logger.success('[Langchain] Webhook verified successfully')
      return true
    }

    Logger.warn('[Langchain] Webhook verification failed', { mode, token })
    return false
  }
}
