import { Elysia } from 'elysia'

/**
 * Basic Authentication Middleware for Elysia
 * Protects routes with HTTP Basic Auth
 * Credentials are stored in environment variables
 */
export const basicAuth = () => new Elysia()
  .derive(({ request, set }) => {
    const authHeader = request.headers.get('authorization')

    if (!authHeader || !authHeader.startsWith('Basic ')) {
      set.status = 401
      set.headers['WWW-Authenticate'] = 'Basic realm="Admin Area"'
      throw new Error('Authentication required')
    }

    // Extract and decode credentials
    const base64Credentials = authHeader.split(' ')[1]
    const credentials = Buffer.from(base64Credentials, 'base64').toString('utf-8')
    const [username, password] = credentials.split(':')

    // Get credentials from environment
    const validUsername = process.env.ADMIN_USERNAME
    const validPassword = process.env.ADMIN_PASSWORD

    if (!validUsername || !validPassword) {
      console.error('[BasicAuth] ADMIN_USERNAME or ADMIN_PASSWORD not set in .env')
      set.status = 500
      throw new Error('Server configuration error')
    }

    // Verify credentials
    if (username !== validUsername || password !== validPassword) {
      set.status = 401
      set.headers['WWW-Authenticate'] = 'Basic realm="Admin Area"'
      throw new Error('Invalid credentials')
    }

    // Authentication successful
    return {
      authenticated: true,
      username,
    }
  })
