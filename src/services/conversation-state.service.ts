import type { Redis } from 'ioredis'
import { createActor } from 'xstate'
import {
  conversationMachine,
  type ConversationContext,
} from '@/machines/conversationMachine'
import { ConversationSession, ConversationSessionSchema } from '@/models/ChatMessage'
import { randomUUID } from 'crypto'

export class ConversationStateService {
  private readonly SESSION_PREFIX = 'conversation:session:'
  private readonly ACTIVE_TOKEN_PREFIX = 'conversation:active:'
  private readonly SESSION_TTL = 20 * 60 // 20 minutes in seconds
  private readonly ACTIVE_TOKEN_TTL = 20 * 60 // 20 minutes in seconds

  // In-memory cache of active actors (for performance)
  private actors = new Map<string, ReturnType<typeof createActor<typeof conversationMachine>>>()

  constructor(private readonly redis: Redis) {}

  async loadOrCreateSession(phoneNumber: string): Promise<ConversationSession> {
    const key = this.getSessionKey(phoneNumber)

    // Check if conversation is active (token exists)
    const isActive = await this.isConversationActive(phoneNumber)

    const sessionData = await this.redis.hgetall(key)

    // If session exists and conversation is active
    if (sessionData && sessionData.sessionId && isActive) {
      try {
        const session = ConversationSessionSchema.parse({
          sessionId: sessionData.sessionId,
          phoneNumber: sessionData.phoneNumber,
          currentState: sessionData.currentState,
          context: JSON.parse(sessionData.context || '{}'),
          lastMessageAt: parseInt(sessionData.lastMessageAt),
          welcomeSentAt: sessionData.welcomeSentAt ? parseInt(sessionData.welcomeSentAt) : undefined,
          createdAt: parseInt(sessionData.createdAt),
        })

        return session
      } catch (error) {
        console.error('Failed to parse session, creating new one:', error)
      }
    }

    // Token doesn't exist or session invalid → create new session
    return this.createNewSession(phoneNumber)
  }

  /**
   * Check if conversation is active (token exists in Redis)
   */
  private async isConversationActive(phoneNumber: string): Promise<boolean> {
    const tokenKey = this.getActiveTokenKey(phoneNumber)
    const token = await this.redis.get(tokenKey)
    return token === '1'
  }

  /**
   * Mark conversation as active by setting token with 20-minute TTL
   */
  private async markConversationActive(phoneNumber: string): Promise<void> {
    const tokenKey = this.getActiveTokenKey(phoneNumber)
    await this.redis.set(tokenKey, '1', 'EX', this.ACTIVE_TOKEN_TTL)
  }

  async handleMessage(phoneNumber: string, message: string): Promise<{
    state: string
    context: ConversationContext
    shouldSendWelcome: boolean
  }> {
    // Reset the active token on each message (20-minute TTL)
    await this.markConversationActive(phoneNumber)

    const session = await this.loadOrCreateSession(phoneNumber)

    // Get or create actor
    let actor = this.actors.get(phoneNumber)

    if (!actor) {
      actor = createActor(conversationMachine, {
        input: session.context,
      })
      actor.start()
      this.actors.set(phoneNumber, actor)
    }

    const previousState = actor.getSnapshot().value as string

    // Send USER_MESSAGE event
    actor.send({
      type: 'USER_MESSAGE',
      message,
      timestamp: Date.now(),
    })

    const snapshot = actor.getSnapshot()
    const newState = snapshot.value as string
    const context = snapshot.context

    // Determine if we should send welcome message
    const shouldSendWelcome = previousState === 'idle' && newState === 'welcomed'

    // Persist the new state
    await this.persistSession(phoneNumber, session.sessionId, newState, context)

    return {
      state: newState,
      context,
      shouldSendWelcome,
    }
  }

  async markWelcomeSent(phoneNumber: string): Promise<void> {
    const actor = this.actors.get(phoneNumber)

    if (!actor) {
      console.warn('No actor found for phone number:', phoneNumber)
      return
    }

    actor.send({
      type: 'WELCOME_SENT',
      timestamp: Date.now(),
    })

    const snapshot = actor.getSnapshot()
    const session = await this.loadOrCreateSession(phoneNumber)

    await this.persistSession(
      phoneNumber,
      session.sessionId,
      snapshot.value as string,
      snapshot.context
    )
  }

  async markSearchCompleted(phoneNumber: string, query: string, offset: number): Promise<void> {
    const actor = this.actors.get(phoneNumber)

    if (!actor) {
      console.warn('No actor found for phone number:', phoneNumber)
      return
    }

    actor.send({
      type: 'SEARCH_COMPLETED',
      query,
      offset,
    })

    const snapshot = actor.getSnapshot()
    const session = await this.loadOrCreateSession(phoneNumber)

    await this.persistSession(
      phoneNumber,
      session.sessionId,
      snapshot.value as string,
      snapshot.context
    )
  }

  async markPaginationRequested(phoneNumber: string, offset: number): Promise<void> {
    const actor = this.actors.get(phoneNumber)

    if (!actor) {
      console.warn('No actor found for phone number:', phoneNumber)
      return
    }

    actor.send({
      type: 'PAGINATION_REQUESTED',
      offset,
    })

    const snapshot = actor.getSnapshot()
    const session = await this.loadOrCreateSession(phoneNumber)

    await this.persistSession(
      phoneNumber,
      session.sessionId,
      snapshot.value as string,
      snapshot.context
    )
  }

  async getCurrentState(phoneNumber: string): Promise<string> {
    const session = await this.loadOrCreateSession(phoneNumber)
    return session.currentState
  }

  async getSessionId(phoneNumber: string): Promise<string> {
    const session = await this.loadOrCreateSession(phoneNumber)
    return session.sessionId
  }

  async getContext(phoneNumber: string): Promise<ConversationContext> {
    const session = await this.loadOrCreateSession(phoneNumber)
    return session.context
  }

  async clearSession(phoneNumber: string): Promise<void> {
    const key = this.getSessionKey(phoneNumber)
    await this.redis.del(key)
    this.actors.delete(phoneNumber)
  }

  private async createNewSession(phoneNumber: string): Promise<ConversationSession> {
    const sessionId = randomUUID()
    const now = Date.now()

    const session: ConversationSession = {
      sessionId,
      phoneNumber,
      currentState: 'idle',
      context: {
        phoneNumber,
        sessionId,
        lastMessageAt: now,
      },
      lastMessageAt: now,
      createdAt: now,
    }

    await this.persistSession(phoneNumber, sessionId, session.currentState, session.context)

    return session
  }

  private async persistSession(
    phoneNumber: string,
    sessionId: string,
    currentState: string,
    context: ConversationContext
  ): Promise<void> {
    const key = this.getSessionKey(phoneNumber)

    const sessionData = {
      sessionId,
      phoneNumber,
      currentState,
      context: JSON.stringify(context),
      lastMessageAt: Date.now().toString(),
      welcomeSentAt: context.welcomeSentAt?.toString() || '',
      createdAt: context.lastMessageAt.toString(),
    }

    // Use pipeline for atomic operations
    const pipeline = this.redis.pipeline()
    pipeline.hset(key, sessionData)
    pipeline.expire(key, this.SESSION_TTL)
    await pipeline.exec()
  }

  private getSessionKey(phoneNumber: string): string {
    return `${this.SESSION_PREFIX}${phoneNumber}`
  }

  private getActiveTokenKey(phoneNumber: string): string {
    return `${this.ACTIVE_TOKEN_PREFIX}${phoneNumber}`
  }

  // Cleanup method to remove inactive actors (call periodically)
  cleanupInactiveActors(): void {
    const twentyMinutesAgo = Date.now() - 20 * 60 * 1000

    for (const [phoneNumber, actor] of this.actors.entries()) {
      const context = actor.getSnapshot().context
      if (context.lastMessageAt < twentyMinutesAgo) {
        actor.stop()
        this.actors.delete(phoneNumber)
      }
    }
  }
}
