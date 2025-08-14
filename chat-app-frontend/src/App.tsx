import React, { useState, useEffect } from 'react'
import {
  BrowserRouter as Router,
  Routes,
  Route,
  useNavigate,
} from 'react-router-dom'

// 各ページコンポーネントのインポート
import LoginPage from './pages/LoginPage'
import ChatPage from './pages/ChatPage'
import ProfilePage from './pages/ProfilePage'

// 共有型定義とコンテキスト関連を新しいファイルからインポート
import { AppContext } from '@/types/app-context'
import type { User } from '@/types/user'

// AppContextを提供するプロバイダーコンポーネント
const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<User | null>(null)
  const navigate = useNavigate()
  const backendUrl =
    import.meta.env.VITE_REACT_APP_BACKEND_URL || 'http://localhost:8000' // .envから読み込み

  // JWTトークンの保存と取得
  const setToken = (token: string | null) => {
    if (token) {
      localStorage.setItem('jwt_token', token)
    } else {
      localStorage.removeItem('jwt_token')
    }
  }

  const getToken = (): string | null => {
    return localStorage.getItem('jwt_token')
  }

  // 認証状態をチェックする関数 (JWTベース)
  const checkAuth = async () => {
    const token = getToken()
    if (!token) {
      setCurrentUser(null)
      navigate('/login')
      return
    }

    try {
      // JWTをAuthorizationヘッダーに含めて認証チェック
      const res = await fetch(`${backendUrl}/api/me`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
      })

      if (res.ok) {
        const user = await res.json()
        setCurrentUser(user)
      } else {
        // トークンが無効または期限切れの場合
        setToken(null) // 無効なトークンを削除
        setCurrentUser(null)
        navigate('/login')
      }
    } catch (error) {
      console.error('認証チェック失敗:', error)
      setToken(null)
      setCurrentUser(null)
      navigate('/login')
    }
  }

  // ログアウト関数 (JWTベース)
  const logout = async () => {
    const token = getToken()
    if (token) {
      try {
        // バックエンドにログアウト通知 (トークン無効化処理が必要な場合)
        await fetch(`${backendUrl}/api/logout`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
        })
      } catch (error) {
        console.error('バックエンドログアウト通知失敗 (無視可能):', error)
      }
    }
    setToken(null) // ローカルストレージからトークンを削除
    setCurrentUser(null)
    navigate('/login') // ログアウト後、ログインページへ
  }

  // コンポーネントマウント時に認証チェックを実行
  useEffect(() => {
    checkAuth()
  }, []) // 初回マウント時のみ

  return (
    <AppContext.Provider
      value={{
        currentUser,
        setCurrentUser,
        checkAuth,
        logout,
        backendUrl,
        setToken,
        getToken,
      }}
    >
      {children}
    </AppContext.Provider>
  )
}

// メインのAppコンポーネント
function App() {
  return (
    <Router>
      <AppProvider>
        <Routes>
          <Route path='/login' element={<LoginPage />} />
          <Route path='/chat' element={<ChatPage />} />
          <Route path='/profile' element={<ProfilePage />} />
          <Route path='*' element={<LoginPage />} />{' '}
          {/* 未定義のパスはログインへリダイレクト */}
        </Routes>
      </AppProvider>
    </Router>
  )
}

export default App
