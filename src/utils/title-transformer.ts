/**
 * Transform and normalize job titles
 *
 * Examples:
 * - ARCHITECTE -> Architecte
 * - ASSIStAnte-De-Direction -> Assistante De Direction
 * - developpeur -> Developpeur
 * - Architecte(Cloud) -> Architecte Cloud
 */
export class TitleTransformer {
  /**
   * Transform a job title to proper case and clean format
   */
  static transform(title: string): string {
    if (!title) return title

    // Step 1: Remove special characters in parentheses and replace with space
    // Architecte(Cloud) -> Architecte Cloud
    let transformed = title.replace(/\(([^)]+)\)/g, ' $1')

    // Step 2: Replace hyphens between words with spaces (but keep hyphens in compound words)
    // ASSIStAnte-De-Direction -> ASSIStAnte De Direction
    transformed = transformed.replace(/-/g, ' ')

    // Step 3: Split into words and apply title case
    transformed = transformed
      .split(/\s+/)
      .filter(word => word.length > 0)
      .map(word => this.toTitleCase(word))
      .join(' ')

    // Step 4: Clean up extra spaces
    transformed = transformed.replace(/\s+/g, ' ').trim()

    return transformed
  }

  /**
   * Convert a word to title case
   * Handles all caps, all lowercase, and mixed case
   */
  private static toTitleCase(word: string): string {
    if (!word) return word

    // Special cases: keep certain words in lowercase if they're not first word
    const lowercaseWords = ['de', 'du', 'la', 'le', 'les', 'et', 'des', 'un', 'une']

    const lower = word.toLowerCase()

    // Check if it's a lowercase exception (will be handled by caller for positioning)
    if (lowercaseWords.includes(lower)) {
      return lower
    }

    // Convert to title case: first letter uppercase, rest lowercase
    return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
  }

  /**
   * Transform with proper handling of French articles
   * First word is always capitalized, articles stay lowercase
   */
  static transformWithArticles(title: string): string {
    const transformed = this.transform(title)
    const words = transformed.split(' ')

    if (words.length === 0) return transformed

    // Always capitalize first word
    words[0] = words[0].charAt(0).toUpperCase() + words[0].slice(1).toLowerCase()

    return words.join(' ')
  }
}
