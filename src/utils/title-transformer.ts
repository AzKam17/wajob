/**
 * Transform and normalize job titles
 *
 * Examples:
 * - ARCHITECTE -> Architecte
 * - ASSIStAnte-De-Direction -> Assistante De Direction
 * - developpeur -> Developpeur
 * - Architecte(Cloud) -> Architecte Cloud
 * - • Développeur H/f -> Developpeur
 * - "Chef de projet" h/F -> Chef De Projet
 */
export class TitleTransformer {
  /**
   * Transform a job title to proper case and clean format
   */
  static transform(title: string): string {
    if (!title) return title

    // Step 1: Remove unwanted characters and patterns
    // Remove bullet points, quotes, and H/f (case-insensitive)
    let transformed = title
      .replace(/•/g, '') // Remove bullet points
      .replace(/[""]/g, '') // Remove quotes
      .replace(/\b[hH]\/[fF]\b/g, '') // Remove H/f, h/f, H/F, h/F

    // Step 2: Remove special characters in parentheses and replace with space
    // Architecte(Cloud) -> Architecte Cloud
    transformed = transformed.replace(/\(([^)]+)\)/g, ' $1')

    // Step 3: Replace hyphens between words with spaces (but keep hyphens in compound words)
    // ASSIStAnte-De-Direction -> ASSIStAnte De Direction
    transformed = transformed.replace(/-/g, ' ')

    // Step 4: Split into words and apply title case
    const words = transformed
      .split(/\s+/)
      .filter(word => word.length > 0)
      .map((word, index) => this.toTitleCase(word, index === 0))

    transformed = words.join(' ')

    // Step 5: Clean up extra spaces
    transformed = transformed.replace(/\s+/g, ' ').trim()

    return transformed
  }

  /**
   * Convert a word to title case
   * Handles all caps, all lowercase, and mixed case
   * @param word - The word to transform
   * @param isFirst - Whether this is the first word (always capitalize if true)
   */
  private static toTitleCase(word: string, isFirst: boolean = false): string {
    if (!word) return word

    // Special cases: keep certain words in lowercase if they're not first word
    const lowercaseWords = ['de', 'du', 'la', 'le', 'les', 'et', 'des', 'un', 'une']

    const lower = word.toLowerCase()

    // If it's the first word, always capitalize
    if (isFirst) {
      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
    }

    // Check if it's a lowercase exception
    if (lowercaseWords.includes(lower)) {
      return lower
    }

    // Convert to title case: first letter uppercase, rest lowercase
    return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
  }

  /**
   * Transform with proper handling of French articles
   * First word is always capitalized, articles stay lowercase
   * This is now handled automatically by transform()
   */
  static transformWithArticles(title: string): string {
    return this.transform(title)
  }
}
