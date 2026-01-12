import { ChatOpenAI } from '@langchain/openai'
import { HumanMessage, AIMessage, BaseMessage } from '@langchain/core/messages'
import { PromptTemplate } from '@langchain/core/prompts'
import { StructuredOutputParser } from '@langchain/core/output_parsers'
import { z } from 'zod'
import { Logger } from '../utils/logger'
import type { Redis } from 'ioredis'

// Zod schema for structured output
export const ConversationActionSchema = z.object({
  action: z.enum(['welcome', 'search', 'paginate', 'help', 'goodbye', 'unknown']),
  query: z.string().optional(),
  offset: z.number().optional(),
  confidence: z.number().min(0).max(1),
})

export type ConversationAction = z.infer<typeof ConversationActionSchema>

/**
 * Langchain Service using Grok (xAI) LLM
 * Advanced conversation handling with context awareness
 */
export class LangchainService {
  private llm: ChatOpenAI
  private redis: Redis
  private parser
  private prompt
  private readonly CHAT_HISTORY_PREFIX = 'langchain:history:'
  private readonly MAX_HISTORY_MESSAGES = 10

  constructor(redis: Redis) {
    this.redis = redis

    const apiKey = process.env.GROK_API_KEY
    if (!apiKey) {
      throw new Error('GROK_API_KEY environment variable is required')
    }

    // Initialize Grok LLM (OpenAI-compatible API)
    this.llm = new ChatOpenAI({
      modelName: 'grok-beta',
      temperature: 0, // CRITICAL for extraction - déterministe
      openAIApiKey: apiKey,
      configuration: {
        baseURL: 'https://api.x.ai/v1',
      },
    })

    // Initialize structured output parser
    this.parser = StructuredOutputParser.fromZodSchema(ConversationActionSchema)

    // Create prompt template with format instructions
    this.prompt = new PromptTemplate({
      template: this.buildPromptTemplate(),
      inputVariables: ['input', 'history'],
      partialVariables: {
        format_instructions: this.parser.getFormatInstructions(),
      },
    })

    Logger.success('[Langchain] Service initialized with Grok and structured output')
  }

  /**
   * Analyze user message and determine action
   */
  async analyzeMessage(phoneNumber: string, message: string): Promise<ConversationAction> {
    try {
      // Get conversation history
      const history = await this.getHistory(phoneNumber)

      // Format history for prompt
      const historyText = this.formatHistoryForPrompt(history)

      Logger.debug('[Langchain] Sending message to Grok', {
        phoneNumber,
        historyLength: history.length,
        message,
      })

      // Create chain: prompt -> llm -> parser
      const chain = this.prompt.pipe(this.llm).pipe(this.parser)

      // Invoke chain with input
      const action = await chain.invoke({
        input: message,
        history: historyText,
      })

      Logger.debug('[Langchain] Action extracted', {
        phoneNumber,
        action: action.action,
        confidence: action.confidence,
        query: action.query,
      })

      // Save message to history
      await this.addToHistory(phoneNumber, new HumanMessage(message))
      await this.addToHistory(phoneNumber, new AIMessage(JSON.stringify(action)))

      return action
    } catch (error) {
      Logger.error('[Langchain] Error analyzing message', { error, phoneNumber, message })
      // Fallback to basic analysis
      return this.fallbackAnalysis(message)
    }
  }

  /**
   * Build prompt template for the LLM
   */
  private buildPromptTemplate(): string {
    return `Tu es un assistant IA spécialisé dans l'analyse de messages pour un bot de recherche d'emploi WhatsApp en Côte d'Ivoire.

CONTEXTE DE LA CONVERSATION:
{history}

MESSAGE UTILISATEUR:
"{input}"

TÂCHE:
Extrait UNIQUEMENT l'action et les paramètres depuis le message utilisateur.
Si une information n'est pas présente, ne l'invente pas.

ACTIONS POSSIBLES:
- "welcome": Nouveau utilisateur ou salutation (bonjour, salut, hello, bonsoir, coucou)
- "search": Recherche d'emploi - extrait le titre de poste recherché
- "paginate": Demande de plus de résultats (plus, suivant, suite, voir plus, encore, autres)
- "help": Demande d'aide (aide, help, comment ça marche, que faire)
- "goodbye": Au revoir (au revoir, bye, à bientôt, merci au revoir)
- "unknown": Message non compris ou hors sujet

RÈGLES D'EXTRACTION:
1. Si salutation → action="welcome", confidence=0.95
2. Si titre de poste → action="search", query="titre exact", confidence=0.8-0.95
3. Si pagination → action="paginate", offset=5, confidence=0.9
4. Si demande aide → action="help", confidence=0.95
5. Si au revoir → action="goodbye", confidence=0.95
6. Si incertain → action="unknown", confidence=0.3-0.6

EXEMPLES:
"Bonjour" → {{"action": "welcome", "confidence": 0.95}}
"développeur web" → {{"action": "search", "query": "développeur web", "confidence": 0.9}}
"je cherche un comptable" → {{"action": "search", "query": "comptable", "confidence": 0.85}}
"plus" → {{"action": "paginate", "offset": 5, "confidence": 0.9}}
"aide" → {{"action": "help", "confidence": 0.95}}

{format_instructions}

IMPORTANT: Extrait UNIQUEMENT les informations présentes dans le message. Ne déduis rien.`
  }

  /**
   * Format conversation history for prompt
   */
  private formatHistoryForPrompt(history: BaseMessage[]): string {
    if (history.length === 0) {
      return 'Aucun historique - c\'est le premier message.'
    }

    return history
      .map((msg) => {
        const role = msg._getType() === 'human' ? 'User' : 'Assistant'
        return `${role}: ${msg.content}`
      })
      .join('\n')
  }

  /**
   * Fallback analysis when LLM fails
   */
  private fallbackAnalysis(message: string): ConversationAction {
    const lowerMessage = message.toLowerCase().trim()

    // Greeting detection
    if (/^(bonjour|salut|hello|bonsoir|coucou|hey)/.test(lowerMessage)) {
      return { action: 'welcome', confidence: 0.8 }
    }

    // Pagination detection
    if (/^(plus|suivant|suite|voir plus|encore|autres|next|more)/.test(lowerMessage)) {
      return { action: 'paginate', offset: 5, confidence: 0.8 }
    }

    // Help detection
    if (/aide|help|comment/.test(lowerMessage)) {
      return { action: 'help', confidence: 0.8 }
    }

    // Goodbye detection
    if (/au revoir|bye|à bientôt|adieu/.test(lowerMessage)) {
      return { action: 'goodbye', confidence: 0.8 }
    }

    // Job search detection (anything else is likely a job search)
    if (message.length > 2) {
      return { action: 'search', query: message.trim(), confidence: 0.6 }
    }

    return { action: 'unknown', confidence: 0.3 }
  }

  /**
   * Get conversation history from Redis
   */
  private async getHistory(phoneNumber: string): Promise<BaseMessage[]> {
    const key = this.getHistoryKey(phoneNumber)
    const data = await this.redis.get(key)

    if (!data) {
      return []
    }

    try {
      const parsed = JSON.parse(data)
      return parsed.map((msg: any) => {
        if (msg.type === 'human') {
          return new HumanMessage(msg.content)
        } else {
          return new AIMessage(msg.content)
        }
      })
    } catch (error) {
      Logger.error('[Langchain] Error parsing history', { error, phoneNumber })
      return []
    }
  }

  /**
   * Add message to history
   */
  private async addToHistory(phoneNumber: string, message: BaseMessage): Promise<void> {
    const key = this.getHistoryKey(phoneNumber)
    const history = await this.getHistory(phoneNumber)

    // Add new message
    history.push(message)

    // Keep only last N messages
    const trimmed = history.slice(-this.MAX_HISTORY_MESSAGES)

    // Serialize and save
    const serialized = trimmed.map(msg => ({
      type: msg._getType(),
      content: msg.content.toString(),
    }))

    await this.redis.setex(key, 86400, JSON.stringify(serialized)) // 24h TTL
  }

  /**
   * Clear conversation history
   */
  async clearHistory(phoneNumber: string): Promise<void> {
    const key = this.getHistoryKey(phoneNumber)
    await this.redis.del(key)
    Logger.info('[Langchain] History cleared', { phoneNumber })
  }

  /**
   * Get Redis key for history
   */
  private getHistoryKey(phoneNumber: string): string {
    return `${this.CHAT_HISTORY_PREFIX}${phoneNumber}`
  }
}
