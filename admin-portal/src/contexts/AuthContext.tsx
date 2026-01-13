'use client'

import { createContext, useContext, useState, useEffect, ReactNode } from 'react'

interface AuthContextType {
  username: string | null
  password: string | null
  isAuthenticated: boolean
  setCredentials: (username: string, password: string) => void
  clearCredentials: () => void
  getAuthHeader: () => string
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [username, setUsername] = useState<string | null>(null)
  const [password, setPassword] = useState<string | null>(null)
  const [isAuthenticated, setIsAuthenticated] = useState(false)

  // Load credentials from localStorage on mount
  useEffect(() => {
    const storedUsername = localStorage.getItem('admin_username')
    const storedPassword = localStorage.getItem('admin_password')

    if (storedUsername && storedPassword) {
      setUsername(storedUsername)
      setPassword(storedPassword)
      setIsAuthenticated(true)
    }
  }, [])

  const setCredentials = (newUsername: string, newPassword: string) => {
    setUsername(newUsername)
    setPassword(newPassword)
    setIsAuthenticated(true)

    // Store in localStorage
    localStorage.setItem('admin_username', newUsername)
    localStorage.setItem('admin_password', newPassword)
  }

  const clearCredentials = () => {
    setUsername(null)
    setPassword(null)
    setIsAuthenticated(false)

    // Clear from localStorage
    localStorage.removeItem('admin_username')
    localStorage.removeItem('admin_password')
  }

  const getAuthHeader = () => {
    if (!username || !password) return ''

    const credentials = btoa(`${username}:${password}`)
    return `Basic ${credentials}`
  }

  return (
    <AuthContext.Provider
      value={{
        username,
        password,
        isAuthenticated,
        setCredentials,
        clearCredentials,
        getAuthHeader,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
