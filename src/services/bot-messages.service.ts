import { getWhatsAppClient } from '@config/whatsapp'
import { Logger } from '../utils/logger'

/**
 * BotMessages class handles all WhatsApp bot message sending
 * This centralizes all bot messaging logic and templates
 */
export class BotMessages {
  private whatsapp = getWhatsAppClient()

  /**
   * Send welcome flow: Template + follow-up text after 2 seconds
   * @param phoneNumber - Recipient's phone number
   */
  async sendWelcomeFlow(phoneNumber: string): Promise<void> {
    try {
      Logger.info('Sending welcome flow', { phoneNumber })

      // Step 1: Send the template message (required for opening conversation)
      await this.whatsapp.sendTemplateMessage(
        phoneNumber,
        'eska_job_title_prompt',
        'fr',
        [], // No parameters
        { recipientType: 'individual' }
      )

      Logger.success('Welcome template sent', { phoneNumber })

      // Step 2: Wait 2 seconds before sending follow-up
      await this.delay(2000)

      // Step 3: Send follow-up text message
      const followUpMessage = 'Dites-moi simplement le titre du poste que vous recherchez (ex : Développeur web, Comptable, Community Manager), et je vous enverrai des offres récentes correspondant à votre recherche 📍💼'

      await this.whatsapp.sendTextMessage(
        phoneNumber,
        followUpMessage,
        {
          recipientType: 'individual',
          previewUrl: false
        }
      )

      Logger.success('Welcome flow completed', { phoneNumber })
    } catch (error) {
      Logger.error('Error sending welcome flow', { error, phoneNumber })
      throw error
    }
  }

  /**
   * Send "no exact match found" message with similar opportunities intro
   * @param phoneNumber - Recipient's phone number
   */
  async sendNoExactMatchMessage(phoneNumber: string): Promise<void> {
    try {
      Logger.info('Sending no exact match message', { phoneNumber })

      const message = `Aucune offre exacte trouvée pour votre recherche 🔍

Mais voici quelques opportunités similaires qui pourraient vous intéresser 👇`

      await this.whatsapp.sendTextMessage(
        phoneNumber,
        message,
        {
          recipientType: 'individual',
          previewUrl: false
        }
      )

      Logger.success('No exact match message sent', { phoneNumber })
    } catch (error) {
      Logger.error('Error sending no exact match message', { error, phoneNumber })
      throw error
    }
  }

  /**
   * Send a single job offer using template
   * @param phoneNumber - Recipient's phone number
   * @param jobTitle - Job title ({{1}})
   * @param company - Company name ({{2}})
   * @param location - Location ({{3}})
   * @param linkId - Personalized link ID for tracking (will be appended to base URL)
   */
  async sendJobOffer(
    phoneNumber: string,
    jobTitle: string,
    company: string,
    location: string,
    linkId: string
  ): Promise<void> {
    try {
      Logger.info('Sending job offer', {
        phoneNumber,
        jobTitle,
        company,
        location,
        linkId
      })

      // Template: eska_job_offer_single
      // Body parameters:
      // {{1}} - Job title
      // {{2}} - Company
      // {{3}} - Location
      // Button parameter:
      // {{1}} - Link ID (appended to APP_URL from WhatsApp template config)

      await this.whatsapp.sendTemplateMessage(
        phoneNumber,
        'eska_job_offer_single',
        'fr',
        [
          {
            type: 'BODY' as any,
            parameters: [
              {
                type: 'text',
                text: jobTitle
              },
              {
                type: 'text',
                text: company
              },
              {
                type: 'text',
                text: location
              }
            ]
          },
          {
            type: 'BUTTON' as any,
            sub_type: 'url',
            index: 0,
            parameters: [
              {
                type: 'text',
                text: linkId // This will be appended to the base URL configured in WhatsApp template
              }
            ]
          }
        ] as any,
        { recipientType: 'individual' }
      )

      Logger.success('Job offer sent', { phoneNumber, jobTitle })
    } catch (error) {
      Logger.error('Error sending job offer', { error, phoneNumber, jobTitle })
      throw error
    }
  }

  /**
   * Send multiple job offers in sequence with typing indicators
   * @param phoneNumber - Recipient's phone number
   * @param jobs - Array of job objects with title, company, location, and linkId
   * @param delayBetween - Delay in milliseconds between each job (default: 1500ms)
   * @param messageId - Message ID for typing indicator
   */
  async sendMultipleJobOffers(
    phoneNumber: string,
    jobs: Array<{
      title: string
      company: string
      location: string
      linkId: string
    }>,
    delayBetween: number = 1500,
    messageId?: string
  ): Promise<void> {
    try {
      Logger.info('Sending multiple job offers', {
        phoneNumber,
        count: jobs.length
      })

      for (let i = 0; i < jobs.length; i++) {
        const job = jobs[i]

        await this.sendJobOffer(
          phoneNumber,
          job.title,
          job.company,
          job.location,
          job.linkId
        )

        // Add delay between messages (except after the last one)
        if (i < jobs.length - 1) {
          await this.delay(delayBetween)
        }
      }

      Logger.success('All job offers sent', {
        phoneNumber,
        count: jobs.length
      })
    } catch (error) {
      Logger.error('Error sending multiple job offers', { error, phoneNumber })
      throw error
    }
  }

  /**
   * Send typing indicator
   * @param messageId - Message ID to show typing for
   */
  async sendTypingIndicator(messageId: string): Promise<void> {
    try {
      await this.whatsapp.sendTypingIndicator({
        messageId,
        type: 'text'
      })
    } catch (error) {
      Logger.error('Error sending typing indicator', { error })
      // Don't throw - typing indicator failure shouldn't block message flow
    }
  }

  /**
   * Show typing indicator for a phone number
   * @param phoneNumber - Recipient's phone number
   * @param duration - Duration in milliseconds (default: 1000ms)
   */
  async showTyping(messageId: string): Promise<void> {
    try {
      // Send typing on status (this is a visual indicator in WhatsApp)
      await this.whatsapp.sendTypingIndicator({
        messageId,
        type: 'text'
      })
    } catch (error) {
      Logger.debug('Typing indicator not supported or failed', { error })
      // Fallback to just a delay if typing indicator fails
    }
  }

  /**
   * Mark message as read
   * @param messageId - Message ID to mark as read
   */
  async markAsRead(messageId: string): Promise<void> {
    try {
      await this.whatsapp.markMessageAsRead(messageId)
    } catch (error) {
      Logger.error('Error marking message as read', { error })
      // Don't throw - read receipt failure shouldn't block message flow
    }
  }

  /**
   * Send a generic text message
   * @param phoneNumber - Recipient's phone number
   * @param message - Message text
   * @param previewUrl - Whether to show URL preview (default: false)
   */
  async sendTextMessage(
    phoneNumber: string,
    message: string,
    previewUrl: boolean = false
  ): Promise<void> {
    try {
      await this.whatsapp.sendTextMessage(
        phoneNumber,
        message,
        {
          recipientType: 'individual',
          previewUrl
        }
      )

      Logger.success('Text message sent', { phoneNumber })
    } catch (error) {
      Logger.error('Error sending text message', { error, phoneNumber })
      throw error
    }
  }

  /**
   * Send "no jobs found" message (when there are truly no results)
   * @param phoneNumber - Recipient's phone number
   * @param searchTerm - What the user searched for
   */
  async sendNoJobsFoundMessage(
    phoneNumber: string,
    searchTerm: string
  ): Promise<void> {
    try {
      const message = `Désolé, je n'ai trouvé aucune offre pour "${searchTerm}" pour le moment 😔

Essayez avec:
• Un terme plus général (ex: "Marketing" au lieu de "Marketing Digital Senior")
• Des variantes du titre (ex: "Développeur" au lieu de "Dev")
• D'autres mots-clés liés à votre domaine

Vous pouvez aussi me dire simplement votre secteur d'activité et je vous montrerai ce qui est disponible! 💡`

      await this.sendTextMessage(phoneNumber, message)

      Logger.success('No jobs found message sent', { phoneNumber, searchTerm })
    } catch (error) {
      Logger.error('Error sending no jobs found message', { error, phoneNumber })
      throw error
    }
  }

  /**
   * Send "re-enter job title" prompt for stale conversations (2-10 minutes)
   * @param phoneNumber - Recipient's phone number
   */
  async sendReenterJobTitlePrompt(phoneNumber: string): Promise<void> {
    try {
      const message = `Bonjour! 👋

Pour rechercher des offres d'emploi, veuillez me dire directement le titre du poste que vous recherchez.

Par exemple: "Développeur", "Comptable", "Marketing Manager", etc. 💼`

      await this.sendTextMessage(phoneNumber, message)

      Logger.success('Re-enter job title prompt sent', { phoneNumber })
    } catch (error) {
      Logger.error('Error sending re-enter job title prompt', { error, phoneNumber })
      throw error
    }
  }

  /**
   * Send "see more" prompt after showing initial job results
   * @param phoneNumber - Recipient's phone number
   */
  async sendSeeMorePrompt(phoneNumber: string): Promise<void> {
    try {
      const message = `Souhaitez-vous voir plus d'offres? 🔍

Envoyez *Voir plus* pour afficher d'autres opportunités! 📋`

      await this.sendTextMessage(phoneNumber, message)

      Logger.success('See more prompt sent', { phoneNumber })
    } catch (error) {
      Logger.error('Error sending see more prompt', { error, phoneNumber })
      throw error
    }
  }
}
