import { getWhatsAppClient } from '../src/config/whatsapp'
import { Logger } from '../src/utils/logger'

/**
 * Script to configure WhatsApp Ice Breakers
 *
 * Ice breakers are quick reply suggestions that appear when a user
 * first opens a chat with your business.
 *
 * Run: bun run scripts/setup-ice-breakers.ts
 */

async function setupIceBreakers() {
  try {
    const whatsapp = getWhatsAppClient()

    Logger.info('Configuring ice breakers...')

    // Check if WHATSAPP_WEBHOOK_URL is set
    if (!process.env.WHATSAPP_WEBHOOK_URL) {
      Logger.error('WHATSAPP_WEBHOOK_URL not set in .env file')
      Logger.info('Please add WHATSAPP_WEBHOOK_URL to your .env file')
      Logger.info('Example: WHATSAPP_WEBHOOK_URL=https://your-domain.com/webhook/whatsapp')
      process.exit(1)
    }

    // Configure two ice breakers with simple phrases
    await whatsapp.configureConversationalComponents({
      enable_welcome_message: true,
      prompts: [
        'Je cherche un emploi.', // Ice breaker 1
        'Hello, montre moi ce que tu sais faire.', // Ice breaker 2
      ],
    })

    Logger.success('Ice breakers configured successfully!')
    Logger.info('Users will now see these quick replies when they first chat with your bot:')
    Logger.info('Rechercher un emploi')
    Logger.info('Voir les offres')

  } catch (error: any) {
    Logger.error('Failed to configure ice breakers', {
      error: error.message,
      details: error.originalError || error
    })
    process.exit(1)
  }
}

// Run the setup
setupIceBreakers()
