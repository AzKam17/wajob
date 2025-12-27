import { z } from 'zod'

export const ChatMessageSchema = z.object({
  id: z.string(),
  sessionId: z.string(),
  phoneNumber: z.string(),
  timestamp: z.number(),
  direction: z.enum(['incoming', 'outgoing']),
  content: z.object({
    type: z.enum(['text', 'template', 'interactive']),
    text: z.string().optional(),
    templateName: z.string().optional(),
    buttons: z.array(z.any()).optional(),
  }),
  metadata: z
    .object({
      state: z.string().optional(),
      processedAt: z.number().optional(),
      jobOffersCount: z.number().optional(),
    })
    .optional(),
})

export type ChatMessage = z.infer<typeof ChatMessageSchema>

export const ConversationSessionSchema = z.object({
  sessionId: z.string(),
  phoneNumber: z.string(),
  currentState: z.string(),
  context: z.record(z.string(), z.unknown()),
  lastMessageAt: z.number(),
  welcomeSentAt: z.number().optional(),
  createdAt: z.number(),
})

export type ConversationSession = z.infer<typeof ConversationSessionSchema>
