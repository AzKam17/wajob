import { WhatsAppBusinessSDK } from '@microfox/whatsapp-business'

let whatsappClient: WhatsAppBusinessSDK | null = null

export function getWhatsAppClient(): WhatsAppBusinessSDK {
  if (!whatsappClient) {
    whatsappClient = new WhatsAppBusinessSDK({
      phoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID!,
      businessAccountId: process.env.WHATSAPP_BUSINESS_ACCOUNT_ID!,
      accessToken: process.env.WHATSAPP_ACCESS_TOKEN!,
      version: process.env.WHATSAPP_VERSION || 'v23.0',
    })
  }
  return whatsappClient
}
