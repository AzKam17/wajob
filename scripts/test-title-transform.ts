import { TitleTransformer } from '../src/utils/title-transformer'

/**
 * Test script for title transformation
 * Run: bun run scripts/test-title-transform.ts
 */

const testCases = [
  'ARCHITECTE',
  'ASSIStAnte-De-Direction',
  'developpeur',
  'Architecte(Cloud)',
  'DEVELOPPEUR WEB SENIOR',
  'chef-de-projet',
  'Comptable(H/F)',
  'ASSISTANT DE DIRECTION',
  'responsable-ressources-humaines',
]

console.log('Title Transformation Tests:\n')
console.log('Original → Transformed')
console.log('─'.repeat(60))

for (const title of testCases) {
  const transformed = TitleTransformer.transformWithArticles(title)
  console.log(`${title.padEnd(35)} → ${transformed}`)
}

console.log('\n✅ Title transformation tests complete!')
