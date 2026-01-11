import { Elysia, t } from 'elysia'
import { JobAdRepository } from '../db/repositories/JobAdRepository'
import { BotUserRepository } from '../db/repositories/BotUserRepository'
import { MessageRepository } from '../db/repositories/MessageRepository'
import { ConversationRepository } from '../db/repositories/ConversationRepository'
import { PersonalizedLinkRepository } from '../db/repositories/PersonalizedLinkRepository'
import { cors } from '@elysiajs/cors'

// Valid sort columns for each entity
const jobSortColumns = ['title', 'company', 'location', 'source', 'postedDate', 'createdAt', 'updatedAt']
const userSortColumns = ['phoneNumber', 'lastMessageAt', 'createdAt', 'updatedAt']
const conversationSortColumns = ['phoneNumber', 'messageCount', 'status', 'startedAt', 'lastActivityAt', 'createdAt']

export const adminRoutes = new Elysia({ prefix: '/admin' })
  .use(cors())
  .get('/jobs', async ({ query }) => {
    const jobRepo = new JobAdRepository()
    const page = parseInt(query.page || '1')
    const limit = parseInt(query.limit || '20')
    const search = query.search || ''
    const sortBy = query.sortBy || 'postedDate'
    const sortOrder = (query.sortOrder?.toUpperCase() === 'ASC' ? 'ASC' : 'DESC') as 'ASC' | 'DESC'

    // Validate sort column
    const validSortBy = jobSortColumns.includes(sortBy) ? sortBy : 'postedDate'

    const { jobs, total } = await jobRepo.findAllPaginated(page, limit, search || undefined, validSortBy, sortOrder)

    return {
      data: jobs,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    }
  }, {
    query: t.Object({
      page: t.Optional(t.String()),
      limit: t.Optional(t.String()),
      search: t.Optional(t.String()),
      sortBy: t.Optional(t.String()),
      sortOrder: t.Optional(t.String()),
    }),
  })
  .get('/bot-users', async ({ query }) => {
    const userRepo = new BotUserRepository()
    const page = parseInt(query.page || '1')
    const limit = parseInt(query.limit || '20')
    const search = query.search || ''
    const sortBy = query.sortBy || 'createdAt'
    const sortOrder = (query.sortOrder?.toUpperCase() === 'ASC' ? 'ASC' : 'DESC') as 'ASC' | 'DESC'

    // Validate sort column
    const validSortBy = userSortColumns.includes(sortBy) ? sortBy : 'createdAt'

    const { users, total } = await userRepo.findAllPaginated(page, limit, search || undefined, validSortBy, sortOrder)

    return {
      data: users,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    }
  }, {
    query: t.Object({
      page: t.Optional(t.String()),
      limit: t.Optional(t.String()),
      search: t.Optional(t.String()),
      sortBy: t.Optional(t.String()),
      sortOrder: t.Optional(t.String()),
    }),
  })
  .get('/bot-users/:phoneNumber/stats', async ({ params }) => {
    const messageRepo = new MessageRepository()
    const { phoneNumber } = params

    const totalMessages = await messageRepo.countIncomingByPhoneNumber(phoneNumber)
    const firstMessage = await messageRepo.getFirstIncomingMessage(phoneNumber)

    return {
      totalMessages,
      firstMessage: firstMessage ? {
        content: firstMessage.content,
        timestamp: firstMessage.timestamp,
      } : null,
    }
  }, {
    params: t.Object({
      phoneNumber: t.String(),
    }),
  })
  .get('/conversations', async ({ query }) => {
    const conversationRepo = new ConversationRepository()
    const page = parseInt(query.page || '1')
    const limit = parseInt(query.limit || '20')
    const search = query.search || ''
    const sortBy = query.sortBy || 'lastActivityAt'
    const sortOrder = (query.sortOrder?.toUpperCase() === 'ASC' ? 'ASC' : 'DESC') as 'ASC' | 'DESC'

    // Validate sort column
    const validSortBy = conversationSortColumns.includes(sortBy) ? sortBy : 'lastActivityAt'

    const { conversations, total } = await conversationRepo.findAllPaginated(page, limit, search || undefined, validSortBy, sortOrder)

    return {
      data: conversations,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    }
  }, {
    query: t.Object({
      page: t.Optional(t.String()),
      limit: t.Optional(t.String()),
      search: t.Optional(t.String()),
      sortBy: t.Optional(t.String()),
      sortOrder: t.Optional(t.String()),
    }),
  })
  .get('/conversations/:id/messages', async ({ params }) => {
    const conversationRepo = new ConversationRepository()
    const messageRepo = new MessageRepository()
    const linkRepo = new PersonalizedLinkRepository()
    const { id } = params

    const conversation = await conversationRepo.findById(id)
    if (!conversation) {
      return { error: 'Conversation not found' }
    }

    const messages = await messageRepo.findByConversationId(id, 500, 0)
    const links = await linkRepo.findByPhoneNumber(conversation.phoneNumber)

    return {
      conversation,
      messages,
      links,
    }
  }, {
    params: t.Object({
      id: t.String(),
    }),
  })
  .get('/stats', async ({ query }) => {
    const messageRepo = new MessageRepository()
    const userRepo = new BotUserRepository()
    const linkRepo = new PersonalizedLinkRepository()

    const startTime = parseInt(query.startTime || '0')
    const endTime = parseInt(query.endTime || Date.now().toString())

    // Get all stats in parallel with fallbacks
    const [messagesPerBucket, newUsersPerBucket, returningUsersPerBucket, clicksPerBucket, deviceBreakdown] = await Promise.all([
      messageRepo.getMessagesPerTimeBucket(startTime, endTime).catch(() => []),
      userRepo.getNewUsersPerTimeBucket(startTime, endTime).catch(() => []),
      userRepo.getReturningUsersPerTimeBucket(startTime, endTime).catch(() => []),
      linkRepo.getClicksPerTimeBucket(startTime, endTime).catch(() => []),
      linkRepo.getDeviceBreakdown(startTime, endTime).catch(() => []),
    ])

    return {
      messagesPerBucket,
      newUsersPerBucket,
      returningUsersPerBucket,
      clicksPerBucket,
      deviceBreakdown,
      timeRange: { startTime, endTime },
    }
  }, {
    query: t.Object({
      startTime: t.Optional(t.String()),
      endTime: t.Optional(t.String()),
    }),
  })
