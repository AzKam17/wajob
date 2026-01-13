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
    // Check if credentials are valid on mount
    const verifyCredentials = async () => {
      if (!isAuthenticated) {
        setShowModal(true)
        return
      }

      // Try to verify with a test API call
      setIsVerifying(true)
      try {
        const storedUsername = localStorage.getItem('admin_username')
        const storedPassword = localStorage.getItem('admin_password')

        if (!storedUsername || !storedPassword) {
          setShowModal(true)
          return
        }

        const credentials = btoa(`${storedUsername}:${storedPassword}`)
        const response = await fetch(`${API_URL}/admin/stats`, {
          headers: {
            'Authorization': `Basic ${credentials}`
          }
        })

        if (!response.ok) {
          setShowModal(true)
        }
      } catch (err) {
        setShowModal(true)
      } finally {
        setIsVerifying(false)
      }
    }

    verifyCredentials()
  }, [isAuthenticated])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setIsVerifying(true)

    try {
      // Verify credentials with backend
      const credentials = btoa(`${username}:${password}`)
      const response = await fetch(`${API_URL}/admin/stats`, {
        headers: {
          'Authorization': `Basic ${credentials}`
        }
      })

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
    } catch (err) {
      setError('Failed to verify credentials. Please check your connection.')
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
