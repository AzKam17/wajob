import type { LaunchOptions } from 'puppeteer'

export const puppeteerConfig: LaunchOptions = {
  headless: true,
  timeout: 10000,
  args: ['--no-sandbox', '--disable-setuid-sandbox'],
}
