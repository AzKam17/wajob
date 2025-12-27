import { WhatsAppWebhookPayload } from '@microfox/whatsapp-business'
import { BotUserRepository } from '../db/repositories/BotUserRepository'
import { BotMessages } from './bot-messages.service'
import { JobSearchService } from './job-search.service'
import { Logger } from '../utils/logger'
import { ConversationStateService } from './conversation-state.service'
import { ChatHistoryService } from './chat-history.service'

export class WhatsAppMessageService {
  private botMessages = new BotMessages()
  private botUserRepo = new BotUserRepository()
  private jobSearch = new JobSearchService()

  // Track processed message IDs to prevent duplicate processing
  private processedMessages = new Set<string>()
  private readonly MAX_PROCESSED_CACHE = 1000

  constructor(
    private readonly conversationState: ConversationStateService,
    private readonly chatHistory: ChatHistoryService
  ) {}

  async handleIncomingMessage(payload: WhatsAppWebhookPayload): Promise<void> {
    try {
      Logger.info('Webhook received', {
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
            Logger.debug('No messages in webhook payload')
            continue
          }

          for (const message of messages) {
            const from = message.from
            const messageId = message.id
            const contactName = contacts?.[0]?.profile?.name || 'User'

            // Check if we've already processed this message
            if (this.processedMessages.has(messageId)) {
              Logger.warn('Duplicate message detected, skipping', { messageId, from })
              continue
            }

            // Add to processed set
            this.processedMessages.add(messageId)

            // Limit cache size to prevent memory issues
            if (this.processedMessages.size > this.MAX_PROCESSED_CACHE) {
              const firstItem = this.processedMessages.values().next().value
              if (firstItem) {
                this.processedMessages.delete(firstItem)
              }
            }

            Logger.info('Processing incoming message', {
              from,
              messageId,
              contactName,
              type: message.type
            })

            // Skip non-text messages
            if (message.type !== 'text') {
              Logger.debug('Skipping non-text message', { type: message.type })
              continue
            }

            // Send typing indicator (also marks as read automatically)
            await this.botMessages.sendTypingIndicator(messageId)

            const messageText = message.text.body.trim()
            const isSeeMore = messageText.toLowerCase() === 'voir plus'

            // Get session ID for chat history
            const sessionId = await this.conversationState.getSessionId(from)

            // Handle message through XState machine
            const { state, context, shouldSendWelcome } = await this.conversationState.handleMessage(
              from,
              messageText
            )

            Logger.info('Conversation state after message', {
              from,
              state,
              context,
              shouldSendWelcome,
            })

            // Save incoming message to chat history
            await this.chatHistory.saveIncomingMessage(from, sessionId, messageText, state)

            // Check if this is the first message from this user
            const existingUser = await this.botUserRepo.findByPhoneNumber(from)

            // Create user if doesn't exist
            if (!existingUser) {
              await this.botUserRepo.create({
                phoneNumber: from,
                preferences: {},
                lastMessageAt: new Date(),
              })
            } else {
              // Update last message time
              await this.botUserRepo.update(existingUser.id, {
                lastMessageAt: new Date(),
              })
            }

            // Handle state transitions
            if (shouldSendWelcome) {
              Logger.info('Sending welcome flow', { from, state })

              // Send welcome flow (template + follow-up text after 2 seconds)
              await this.botMessages.sendWelcomeFlow(from)

              // Save outgoing messages to chat history
              await this.chatHistory.saveOutgoingTemplateMessage(
                from,
                sessionId,
                'eska_job_title_prompt',
                'welcomed'
              )

              // Mark welcome as sent in state machine
              await this.conversationState.markWelcomeSent(from)

              // Update conversation metadata
              await this.chatHistory.updateConversationMetadata(from, { welcomeSent: true })

              Logger.success('Welcome flow sent successfully', { to: from })
            } else if (state === 'awaitingJobTitle' && !shouldSendWelcome) {
              // User is in awaiting state but we didn't just send welcome
              // This means they sent a message after welcome or in a moderately stale conversation
              const lastMessageTime = existingUser?.lastMessageAt
                ? new Date(existingUser.lastMessageAt)
                : null
              const twoMinutesAgo = new Date(Date.now() - 2 * 60 * 1000)
              const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000)

              const isModeratelyStale =
                lastMessageTime &&
                lastMessageTime < twoMinutesAgo &&
                lastMessageTime >= tenMinutesAgo

              if (isModeratelyStale) {
                Logger.info('Sending re-enter job title prompt', {
                  from,
                  reason: 'moderately_stale_conversation',
                })

                // Send re-enter prompt
                await this.botMessages.sendReenterJobTitlePrompt(from)

                // Save to chat history
                await this.chatHistory.saveOutgoingTextMessage(
                  from,
                  sessionId,
                  'Re-enter job title prompt',
                  state
                )

                Logger.success('Re-enter prompt sent successfully', { to: from })
              }
            } else if (state === 'searchingJobs' || state === 'displayingResults' || state === 'browsing') {
              // Process job search
              Logger.info('Processing job search', {
                from,
                state,
                messageText: message.text.body,
              })

              let userQuery: string
              let offset: number = 0

              if (isSeeMore) {
                // User wants to see more results - use stored query from context
                const lastQuery = context.lastQuery
                const lastOffset = context.lastOffset || 0

                if (!lastQuery) {
                  // No previous query stored - ask them to search first
                  await this.botMessages.sendTextMessage(
                    from,
                    "Veuillez d'abord effectuer une recherche en m'indiquant le poste que vous recherchez! 💼"
                  )

                  // Save to chat history
                  await this.chatHistory.saveOutgoingTextMessage(
                    from,
                    sessionId,
                    "Veuillez d'abord effectuer une recherche...",
                    state
                  )

                  continue
                }

                userQuery = lastQuery
                offset = lastOffset + 3 // Next page

                // Update state machine with new offset
                await this.conversationState.markPaginationRequested(from, offset)

                Logger.info('Loading more results', { from, query: userQuery, offset })
              } else {
                // New search query
                userQuery = message.text.body
                offset = 0
                Logger.info('Processing new job search', { from, query: userQuery })
              }

              // Search for jobs (max 3 results)
              const jobs = await this.jobSearch.searchJobs(userQuery, from, offset)

              Logger.info('Jobs retrieved from search', {
                from,
                query: userQuery,
                offset,
                count: jobs.length,
                jobs: jobs.map((j) => ({ title: j.title, linkId: j.linkId })),
              })

              if (jobs.length > 0) {
                // Found exact matches - send them
                await this.botMessages.sendMultipleJobOffers(from, jobs)

                // Save to chat history
                await this.chatHistory.saveOutgoingInteractiveMessage(
                  from,
                  sessionId,
                  'Job offers',
                  jobs.map((j) => j.title),
                  state,
                  jobs.length
                )

                // Update state machine with search completion
                await this.conversationState.markSearchCompleted(from, userQuery, offset)

                // Update conversation metadata - increment search count and job offers shown
                const conversation = await this.chatHistory.updateConversationMetadata(from, {
                  jobOffersShownCount: jobs.length,
                })

                // Send "see more" prompt after 15 seconds
                setTimeout(() => {
                  this.botMessages.sendSeeMorePrompt(from)
                }, 15_000)

                // Store query and offset for pagination in database (backwards compatibility)
                await this.botUserRepo.update(existingUser.id, {
                  preferences: {
                    ...existingUser.preferences,
                    lastQuery: userQuery,
                    lastOffset: offset,
                  },
                })
              } else {
                if (offset > 0) {
                  // No more results available
                  const noMoreMessage =
                    "Il n'y a plus d'offres disponibles pour cette recherche. 😔\n\nVous pouvez effectuer une nouvelle recherche! 🔍"

                  await this.botMessages.sendTextMessage(from, noMoreMessage)

                  // Save to chat history
                  await this.chatHistory.saveOutgoingTextMessage(from, sessionId, noMoreMessage, state)
                } else {
                  // No exact matches on first page - try similar jobs
                  const similarJobs = await this.jobSearch.searchSimilarJobs(userQuery, from, 0)

                  if (similarJobs.length > 0) {
                    // Found similar jobs - send intro message first
                    await this.botMessages.sendNoExactMatchMessage(from)
                    await this.botMessages.sendMultipleJobOffers(from, similarJobs)

                    // Save to chat history
                    await this.chatHistory.saveOutgoingInteractiveMessage(
                      from,
                      sessionId,
                      'Similar job offers',
                      similarJobs.map((j) => j.title),
                      state,
                      similarJobs.length
                    )

                    // Update state machine
                    await this.conversationState.markSearchCompleted(from, userQuery, 0)

                    // Send "see more" prompt after 15 seconds
                    setTimeout(() => {
                      this.botMessages.sendSeeMorePrompt(from)
                    }, 15_000)

                    // Store query for pagination
                    await this.botUserRepo.update(existingUser.id, {
                      preferences: {
                        ...existingUser.preferences,
                        lastQuery: userQuery,
                        lastOffset: 0,
                      },
                    })
                  } else {
                    // No jobs at all
                    await this.botMessages.sendNoJobsFoundMessage(from, userQuery)

                    // Save to chat history
                    await this.chatHistory.saveOutgoingTextMessage(
                      from,
                      sessionId,
                      `No jobs found for: ${userQuery}`,
                      state
                    )
                  }
                }
              }
            }
          }
        }
      }
    } catch (error) {
      Logger.error('Error handling incoming message', { error })
      throw error
    }
  }

  async verifyWebhook(mode: string, token: string, challenge: string): Promise<boolean> {
    const verifyToken = process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN || 'your-verify-token-here'

    if (mode === 'subscribe' && token === verifyToken) {
      Logger.success('Webhook verified successfully')
      return true
    }

    Logger.warn('Webhook verification failed', { mode, token })
    return false
  }
}
