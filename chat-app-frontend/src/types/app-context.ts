import React, { createContext, useContext } from 'react'
import type { User } from './user' // User型を ./user からインポート

// グローバルコンテキストの型定義
export interface AppContextType {
  currentUser: User | null
  setCurrentUser: React.Dispatch<React.SetStateAction<User | null>>
  checkAuth: () => Promise<void>
  logout: () => Promise<void>
  backendUrl: string // バックエンドURLをコンテキストで提供
  setToken: (token: string | null) => void
  getToken: () => string | null
}

// グローバルコンテキストの作成
export const AppContext = createContext<AppContextType | undefined>(undefined)

// コンテキストを使用するためのカスタムフック
export const useAppContext = () => {
  const context = useContext(AppContext)
  if (!context) {
    throw new Error('useAppContext は AppProvider の内部で使用してください。')
  }
  return context
}
