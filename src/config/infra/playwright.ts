import type { LaunchOptions } from 'playwright'

export const playwrightConfig: LaunchOptions = {
  headless: true,
  timeout: 10000,
}
