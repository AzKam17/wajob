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
      await Bun.sleep(2000)

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
   * Send multiple job offers in parallel
   * @param phoneNumber - Recipient's phone number
   * @param jobs - Array of job objects with title, company, location, and linkId
   */
  async sendMultipleJobOffers(
    phoneNumber: string,
    jobs: Array<{
      title: string
      company: string
      location: string
      linkId: string
    }>
  ): Promise<void> {
    try {
      Logger.info('Sending multiple job offers', {
        phoneNumber,
        count: jobs.length
      })

      await Promise.all(
        jobs.map((job, i) => {
          Logger.info('Sending job offer', {
            index: i,
            total: jobs.length,
            title: job.title,
            linkId: job.linkId
          })

          return this.sendJobOffer(
            phoneNumber,
            job.title,
            job.company,
            job.location,
            job.linkId
          )
        })
      )

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
   * Send typing indicator (also marks message as read automatically)
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

  /**
   * Send unsupported media type message (random from 10 variants)
   * @param phoneNumber - Recipient's phone number
   * @param mediaType - Type of media that was sent (image, audio, video, etc.)
   */
  async sendUnsupportedMediaMessage(phoneNumber: string, mediaType: string): Promise<void> {
    try {
      const messages = [
        `Désolé, je ne peux pas traiter les ${mediaType === 'image' ? 'images' : 'messages vocaux'} pour le moment 🙈\n\nPour rechercher des offres d'emploi, envoyez-moi simplement le titre du poste en texte! 💼`,

        `Oups! Je ne suis pas encore capable de lire les ${mediaType === 'image' ? 'images' : 'messages vocaux'} 😅\n\nÉcrivez-moi le poste que vous recherchez et je vous aiderai! ✍️`,

        `Je ne peux malheureusement pas analyser les ${mediaType === 'image' ? 'images' : 'vocaux'} 🤖\n\nMais je suis là pour vous aider! Tapez le titre du poste que vous cherchez 📝`,

        `Ah, les ${mediaType === 'image' ? 'images' : 'messages vocaux'}... ce n'est pas mon fort! 🙊\n\nEnvoyez-moi plutôt votre recherche en texte et je trouverai des offres pour vous! 🔍`,

        `Je ne suis pas équipé pour traiter les ${mediaType === 'image' ? 'images' : 'messages audio'} pour l'instant 🛠️\n\nDites-moi en texte le poste qui vous intéresse et c'est parti! 🚀`,

        `Hmm, je préfère les messages texte! 💬\n\nLes ${mediaType === 'image' ? 'images' : 'vocaux'}, ce n'est pas encore dans mes capacités 😊\n\nQuel poste recherchez-vous?`,

        `Mon système ne peut pas lire les ${mediaType === 'image' ? 'images' : 'messages vocaux'} actuellement 🤷\n\nMais écrivez-moi le titre du poste et je vous enverrai les meilleures offres! ⭐`,

        `Oups! Les ${mediaType === 'image' ? 'images' : 'messages audio'} ne sont pas supportés pour le moment 🚫\n\nTapez simplement votre recherche (ex: "Développeur", "Comptable") et je m'occupe du reste! 💪`,

        `Je ne peux pas traiter ce type de message 📵\n\nPour que je puisse vous aider, envoyez-moi un message texte avec le poste recherché!\n\nExemple: "Marketing Manager" 💼`,

        `Les ${mediaType === 'image' ? 'images' : 'messages vocaux'}? Pas encore! 🙈\n\nMais je suis super efficace avec les messages texte! Dites-moi quel emploi vous cherchez 🎯`
      ]

      // Select a random message
      const randomMessage = messages[Math.floor(Math.random() * messages.length)]

      await this.sendTextMessage(phoneNumber, randomMessage)

      Logger.success('Unsupported media message sent', { phoneNumber, mediaType })
    } catch (error) {
      Logger.error('Error sending unsupported media message', { error, phoneNumber })
      throw error
    }
  }
}
