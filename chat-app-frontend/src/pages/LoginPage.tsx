import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAppContext } from '@/types/app-context' // AppContextをインポート
import { Button } from '@/components/ui/button' // shadcn/ui の Button をインポート
import { Input } from '@/components/ui/input' // shadcn/ui の Input をインポート

const LoginPage: React.FC = () => {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('') // パスワードフィールドを追加
  const navigate = useNavigate()
  const { setCurrentUser, backendUrl, setToken } = useAppContext() // コンテキストから関数とURLを取得
  const [errorMessage, setErrorMessage] = useState('')

  const handleLogin = async (isGuest: boolean) => {
    setErrorMessage('') // エラーメッセージをリセット
    if (!username.trim()) {
      setErrorMessage('ユーザー名を入力してください。')
      return
    }
    if (!isGuest && !password.trim()) {
      setErrorMessage('通常ログインにはパスワードが必要です。')
      return
    }

    try {
      const res = await fetch(`${backendUrl}/api/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username,
          password: isGuest ? undefined : password,
          isGuest,
        }), // ゲストの場合はパスワードを送らない
      })

      if (res.ok) {
        const data = await res.json()
        setCurrentUser(data.user) // ログイン成功ユーザーをセット
        setToken(data.token) // JWTトークンを保存
        navigate('/chat') // チャットページへ遷移
      } else {
        const errorData = await res.json()
        setErrorMessage(`ログイン失敗: ${errorData.message}`)
      }
    } catch (error) {
      console.error('ログインリクエスト失敗:', error)
      setErrorMessage('サーバーに接続できませんでした。')
    }
  }

  return (
    <div className='flex items-center justify-center min-h-screen'>
      <div className='bg-card p-8 rounded-lg shadow-lg w-full max-w-sm'>
        <h2 className='text-2xl font-bold mb-6 text-center text-foreground'>
          ログイン
        </h2>
        {errorMessage && (
          <p className='text-destructive text-center mb-4'>{errorMessage}</p>
        )}
        <Input
          type='text'
          placeholder='ユーザー名'
          className='mb-4'
          value={username}
          onChange={(e) => setUsername(e.target.value)}
        />
        <Input
          type='password' // typeをpasswordに
          placeholder='パスワード (通常ログイン時のみ)'
          className='mb-4'
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          disabled={username.trim() === '' && !username} // ユーザー名がないと入力不可にする (UX)
        />
        <Button
          onClick={() => handleLogin(false)}
          className='w-full mb-3'
          disabled={!username.trim() || !password.trim()} // 通常ログインのdisabled条件
        >
          通常ログイン
        </Button>
        <Button
          onClick={() => handleLogin(true)}
          className='w-full'
          disabled={!username.trim()} // ゲストログインのdisabled条件
        >
          ゲストログイン
        </Button>
      </div>
    </div>
  )
}

export default LoginPage
