/**
 * Debounce Manager for Job Search Requests
 *
 * This utility helps prevent redundant searches when users send multiple
 * queries in quick succession. It implements a "latest wins" strategy
 * where only the most recent request is processed after a brief delay.
 */

export interface DebouncedRequest {
  requestId: string
  phoneNumber: string
  message: string
  timestamp: number
  timeoutId?: NodeJS.Timeout
}

export class DebounceManager {
  private pendingRequests = new Map<string, DebouncedRequest>()
  private readonly debounceMs: number

  constructor(debounceMs: number = 500) {
    this.debounceMs = debounceMs
  }

  /**
   * Schedule a request with debouncing
   * Returns the request ID that will be executed (after debounce)
   */
  scheduleRequest(
    phoneNumber: string,
    message: string,
    callback: (requestId: string, message: string) => Promise<void>,
  ): string {
    // Cancel any existing pending request for this phone number
    this.cancelPendingRequest(phoneNumber)

    // Generate new request ID
    const requestId = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`

    // Schedule the new request
    const timeoutId = setTimeout(async () => {
      // Remove from pending map
      this.pendingRequests.delete(phoneNumber)

      // Execute callback
      try {
        await callback(requestId, message)
      } catch (error) {
        console.error(`Error executing debounced request ${requestId}:`, error)
      }
    }, this.debounceMs)

    // Store pending request
    this.pendingRequests.set(phoneNumber, {
      requestId,
      phoneNumber,
      message,
      timestamp: Date.now(),
      timeoutId,
    })

    return requestId
  }

  /**
   * Cancel pending request for a phone number
   */
  cancelPendingRequest(phoneNumber: string): void {
    const pending = this.pendingRequests.get(phoneNumber)
    if (pending?.timeoutId) {
      clearTimeout(pending.timeoutId)
      this.pendingRequests.delete(phoneNumber)
    }
  }

  /**
   * Get the current pending request ID for a phone number
   */
  getPendingRequestId(phoneNumber: string): string | undefined {
    return this.pendingRequests.get(phoneNumber)?.requestId
  }

  /**
   * Check if a phone number has a pending request
   */
  hasPendingRequest(phoneNumber: string): boolean {
    return this.pendingRequests.has(phoneNumber)
  }

  /**
   * Clear all pending requests
   */
  clearAll(): void {
    for (const [phoneNumber] of this.pendingRequests) {
      this.cancelPendingRequest(phoneNumber)
    }
  }
}

/**
 * Simple request ID validator
 * Checks if a requestId is still the latest one
 */
export class RequestValidator {
  /**
   * Validate if this request is still the latest
   */
  static isLatestRequest(requestId: string, latestRequestId?: string): boolean {
    // If no latest request ID is set, allow the request
    if (!latestRequestId) {
      return true
    }

    // Check if this request matches the latest
    return requestId === latestRequestId
  }

  /**
   * Extract timestamp from request ID
   */
  static getRequestTimestamp(requestId: string): number {
    const timestamp = parseInt(requestId.split('-')[0])
    return isNaN(timestamp) ? 0 : timestamp
  }

  /**
   * Compare two request IDs to determine which is newer
   */
  static isNewer(requestId1: string, requestId2: string): boolean {
    const ts1 = this.getRequestTimestamp(requestId1)
    const ts2 = this.getRequestTimestamp(requestId2)
    return ts1 > ts2
  }
}
