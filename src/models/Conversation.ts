import { z } from 'zod'

export const ConversationSchema = z.object({
  id: z.string(),
  phoneNumber: z.string(),
  sessionId: z.string(),
  startedAt: z.number(),
  endedAt: z.number().optional(),
  lastActivityAt: z.number(),
  messageCount: z.number(),
  status: z.enum(['active', 'completed', 'abandoned']),
  metadata: z
    .object({
      welcomeSent: z.boolean(),
      searchQueriesCount: z.number(),
      jobOffersShownCount: z.number(),
      paginationRequestsCount: z.number(),
      finalState: z.string().optional(),
    })
    .optional(),
})

export type Conversation = z.infer<typeof ConversationSchema>
