import { fetchTitle } from '../src/playwright'

async function main() {
  const title = await fetchTitle('https://example.com')
  console.log('Fetched title:', title)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
