import { NlpManager } from 'node-nlp'
import { Logger } from '../utils/logger'

export interface IntentClassification {
  intent: string
  score: number
  entities: any[]
}

/**
 * NLP Service for intent classification
 * Uses node-nlp with French language support
 */
export class NLPService {
  private manager: NlpManager
  private isInitialized = false

  constructor() {
    this.manager = new NlpManager({ languages: ['fr'], forceNER: true })
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) {
      return
    }

    Logger.info('[NLP] Initializing NLP manager...')

    // GREETING INTENT
    this.manager.addDocument('fr', 'bonjour', 'greeting')
    this.manager.addDocument('fr', 'salut', 'greeting')
    this.manager.addDocument('fr', 'hello', 'greeting')
    this.manager.addDocument('fr', 'bonsoir', 'greeting')
    this.manager.addDocument('fr', 'coucou', 'greeting')
    this.manager.addDocument('fr', 'hey', 'greeting')

    // ICEBREAKER INTENT (first contact, introduction)
    this.manager.addDocument('fr', 'je cherche un emploi', 'icebreaker')
    this.manager.addDocument('fr', 'je cherche du travail', 'icebreaker')
    this.manager.addDocument('fr', 'je veux un job', 'icebreaker')
    this.manager.addDocument('fr', 'besoin de travail', 'icebreaker')
    this.manager.addDocument('fr', 'recherche emploi', 'icebreaker')

    // PAGINATION INTENT
    this.manager.addDocument('fr', 'plus', 'pagination')
    this.manager.addDocument('fr', 'voir plus', 'pagination')
    this.manager.addDocument('fr', 'suite', 'pagination')
    this.manager.addDocument('fr', 'suivant', 'pagination')
    this.manager.addDocument('fr', 'encore', 'pagination')
    this.manager.addDocument('fr', 'd\'autres offres', 'pagination')
    this.manager.addDocument('fr', 'autres offres', 'pagination')
    this.manager.addDocument('fr', 'autres', 'pagination')
    this.manager.addDocument('fr', 'next', 'pagination')
    this.manager.addDocument('fr', 'more', 'pagination')

    // HELP INTENT
    this.manager.addDocument('fr', 'aide', 'help')
    this.manager.addDocument('fr', 'help', 'help')
    this.manager.addDocument('fr', 'comment ça marche', 'help')
    this.manager.addDocument('fr', 'comment utiliser', 'help')
    this.manager.addDocument('fr', 'que faire', 'help')
    this.manager.addDocument('fr', 'comment faire', 'help')

    // GOODBYE INTENT
    this.manager.addDocument('fr', 'au revoir', 'goodbye')
    this.manager.addDocument('fr', 'bye', 'goodbye')
    this.manager.addDocument('fr', 'à bientôt', 'goodbye')
    this.manager.addDocument('fr', 'merci au revoir', 'goodbye')
    this.manager.addDocument('fr', 'adieu', 'goodbye')

    // JOB SEARCH INTENT (default - anything else is likely a job search)
    this.manager.addDocument('fr', 'développeur', 'job.search')
    this.manager.addDocument('fr', 'comptable', 'job.search')
    this.manager.addDocument('fr', 'chef de projet', 'job.search')
    this.manager.addDocument('fr', 'ingénieur', 'job.search')
    this.manager.addDocument('fr', 'secrétaire', 'job.search')
    this.manager.addDocument('fr', 'commercial', 'job.search')
    this.manager.addDocument('fr', 'vendeur', 'job.search')
    this.manager.addDocument('fr', 'chauffeur', 'job.search')
    this.manager.addDocument('fr', 'technicien', 'job.search')
    this.manager.addDocument('fr', 'assistant', 'job.search')
    this.manager.addDocument('fr', 'manager', 'job.search')
    this.manager.addDocument('fr', 'directeur', 'job.search')
    this.manager.addDocument('fr', 'graphiste', 'job.search')
    this.manager.addDocument('fr', 'designer', 'job.search')
    this.manager.addDocument('fr', 'marketing', 'job.search')
    this.manager.addDocument('fr', 'ressources humaines', 'job.search')
    this.manager.addDocument('fr', 'rh', 'job.search')
    this.manager.addDocument('fr', 'finance', 'job.search')
    this.manager.addDocument('fr', 'banque', 'job.search')
    this.manager.addDocument('fr', 'enseignant', 'job.search')
    this.manager.addDocument('fr', 'professeur', 'job.search')
    this.manager.addDocument('fr', 'infirmier', 'job.search')
    this.manager.addDocument('fr', 'médecin', 'job.search')
    this.manager.addDocument('fr', 'docteur', 'job.search')

    // Train the model
    await this.manager.train()
    this.isInitialized = true

    Logger.success('[NLP] NLP manager initialized and trained')
  }

  async classify(message: string): Promise<IntentClassification> {
    if (!this.isInitialized) {
      await this.initialize()
    }

    const result = await this.manager.process('fr', message)

    return {
      intent: result.intent || 'none',
      score: result.score || 0,
      entities: result.entities || [],
    }
  }
}
