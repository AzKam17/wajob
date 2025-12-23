import { WhatsAppWebhookPayload } from '@microfox/whatsapp-business'
import { BotUserRepository } from '../db/repositories/BotUserRepository'
import { BotMessages } from './bot-messages.service'
import { JobSearchService } from './job-search.service'
import { Logger } from '../utils/logger'

export class WhatsAppMessageService {
  private botMessages = new BotMessages()
  private botUserRepo = new BotUserRepository()
  private jobSearch = new JobSearchService()

  async handleIncomingMessage(payload: WhatsAppWebhookPayload): Promise<void> {
    try {
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

            // Ice breaker messages (configured in setup-ice-breakers.ts)
            const ICE_BREAKER_MESSAGES = [
              'Je cherche un emploi.',
              'Hello, montre moi ce que tu sais faire.'
            ]

            const messageText = message.text.body.trim()
            const isIceBreaker = ICE_BREAKER_MESSAGES.includes(messageText)

            // Check if this is the first message from this user
            const existingUser = await this.botUserRepo.findByPhoneNumber(from)

            // Calculate time thresholds
            const now = Date.now()
            const twoMinutesAgo = new Date(now - 2 * 60 * 1000)
            const tenMinutesAgo = new Date(now - 10 * 60 * 1000)

            const lastMessageTime = existingUser?.lastMessageAt ? new Date(existingUser.lastMessageAt) : null

            // Determine conversation state
            const isNewUser = !existingUser
            const isStaleConversation = lastMessageTime && lastMessageTime < tenMinutesAgo
            const isModeratelyStale = lastMessageTime && lastMessageTime < twoMinutesAgo && lastMessageTime >= tenMinutesAgo

            // Send welcome message if:
            // 1. First time user (no existing user)
            // 2. Ice breaker clicked
            // 3. Last message is older than 10 minutes
            if (isNewUser || isIceBreaker || isStaleConversation) {
              Logger.info('Sending welcome flow', {
                from,
                reason: !existingUser ? 'new_user' : isIceBreaker ? 'ice_breaker' : 'stale_conversation'
              })

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

              // Send typing indicator
              await this.botMessages.sendTypingIndicator(messageId)

              // Send welcome flow (template + follow-up text after 2 seconds)
              await this.botMessages.sendWelcomeFlow(from)

              // Mark message as read
              await this.botMessages.markAsRead(messageId)

              Logger.success('Welcome flow sent successfully', { to: from })
            } else if (isModeratelyStale) {
              // Last message is 2-10 minutes old - ask user to re-enter job title
              Logger.info('Sending re-enter job title prompt', {
                from,
                userId: existingUser.id,
                reason: 'moderately_stale_conversation'
              })

              // Update last message time
              await this.botUserRepo.update(existingUser.id, {
                lastMessageAt: new Date(),
              })

              // Send re-enter prompt
              await this.botMessages.sendReenterJobTitlePrompt(from)

              // Mark message as read
              await this.botMessages.markAsRead(messageId)

              Logger.success('Re-enter prompt sent successfully', { to: from })
            } else {
              // Existing user with recent conversation (< 2 minutes) - process job search
              Logger.info('Message from existing user', {
                from,
                userId: existingUser.id,
                messageText: message.text.body
              })

              // Update last message time
              await this.botUserRepo.update(existingUser.id, {
                lastMessageAt: new Date(),
              })

              const userMessage = message.text.body
              Logger.info('Processing job search', { from, query: userMessage })

              // Search for jobs (max 5 results)
              const jobs = await this.jobSearch.searchJobs(userMessage, from)

              if (jobs.length > 0) {
                // Found exact matches - send them
                await this.botMessages.sendMultipleJobOffers(from, jobs)
              } else {
                // No exact matches - try similar jobs
                const similarJobs = await this.jobSearch.searchSimilarJobs(userMessage, from)

                if (similarJobs.length > 0) {
                  // Found similar jobs - send intro message first
                  await this.botMessages.sendNoExactMatchMessage(from)
                  await this.botMessages.sendMultipleJobOffers(from, similarJobs)
                } else {
                  // No jobs at all
                  await this.botMessages.sendNoJobsFoundMessage(from, userMessage)
                }
              }

              // Mark message as read
              await this.botMessages.markAsRead(messageId)
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
