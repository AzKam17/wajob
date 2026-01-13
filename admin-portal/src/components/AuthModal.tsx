'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/contexts/AuthContext'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000'

export function AuthModal() {
  const { isAuthenticated, setCredentials } = useAuth()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [isVerifying, setIsVerifying] = useState(false)
  const [showModal, setShowModal] = useState(false)

  useEffect(() => {
    // Simple check: just show modal if not authenticated
    // Don't verify on mount - let the actual API calls handle invalid credentials
    if (!isAuthenticated) {
      setShowModal(true)
    }
  }, [isAuthenticated])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setIsVerifying(true)

    try {
      // Verify credentials with backend
      const credentials = btoa(`${username}:${password}`)

      // Create abort controller for timeout
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 10000) // 10 second timeout

      try {
        // Use a simpler endpoint (conversations) instead of stats
        const response = await fetch(`${API_URL}/admin/conversations?page=1&limit=1`, {
          headers: {
            'Authorization': `Basic ${credentials}`
          },
          signal: controller.signal
        })

        clearTimeout(timeoutId)

        if (!response.ok) {
          setError('Invalid username or password')
          setIsVerifying(false)
          return
        }

        // Credentials are valid, save them
        setCredentials(username, password)
        setShowModal(false)
        setUsername('')
        setPassword('')
        setIsVerifying(false)
      } catch (fetchErr) {
        clearTimeout(timeoutId)
        if ((fetchErr as Error).name === 'AbortError') {
          setError('Connection timeout. Please check your network and try again.')
        } else {
          setError('Failed to verify credentials. Please check your connection.')
        }
        setIsVerifying(false)
      }
    } catch (err) {
      setError('An unexpected error occurred. Please try again.')
      setIsVerifying(false)
    }
  }

  if (!showModal && !isVerifying) {
    return null
  }

  if (isVerifying && !showModal) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg p-8">
          <div className="flex items-center space-x-3">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
            <span className="text-gray-700">Verifying credentials...</span>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-8 max-w-md w-full mx-4">
        <h2 className="text-2xl font-bold mb-4 text-gray-900">Admin Login</h2>
        <p className="text-gray-600 mb-6">
          Please enter your credentials to access the admin portal.
        </p>

        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <label htmlFor="username" className="block text-sm font-medium text-gray-700 mb-2">
              Username
            </label>
            <input
              type="text"
              id="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
              disabled={isVerifying}
            />
          </div>

          <div className="mb-6">
            <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-2">
              Password
            </label>
            <input
              type="password"
              id="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
              disabled={isVerifying}
            />
          </div>

          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md">
              <p className="text-sm text-red-600">{error}</p>
            </div>
          )}

          <button
            type="submit"
            disabled={isVerifying}
            className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isVerifying ? 'Verifying...' : 'Login'}
          </button>
        </form>
      </div>
    </div>
  )
}
