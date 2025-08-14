import React from 'react'
// import { Button } from '@/components/ui/button' // Buttonコンポーネントは必要

// 共有型定義から型をインポート
import type { Message } from '@/types/message'
import type { User } from '@/types/user'

interface MessageListProps {
  messages: Message[]
  currentUser: User
}

const MessageList: React.FC<MessageListProps> = ({ messages, currentUser }) => {
  // タイムスタンプを整形するヘルパー関数
  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp)
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  }

  return (
    <div className='space-y-4'>
      {messages.map((message) => {
        const isCurrentUser = message.user.id === currentUser.id
        const bgColor = isCurrentUser ? 'bg-primary' : 'bg-muted'
        const textColor = isCurrentUser
          ? 'text-primary-foreground'
          : 'text-muted-foreground'
        const alignment = isCurrentUser ? 'justify-end' : 'justify-start'
        const bubbleShape = isCurrentUser
          ? 'rounded-br-none'
          : 'rounded-bl-none'

        return (
          <div key={message.id} className={`flex ${alignment}`}>
            <div
              className={`flex flex-col p-3 rounded-lg shadow-sm ${bgColor} ${textColor} ${bubbleShape} max-w-[70%]`}
            >
              <div className='flex items-baseline mb-1'>
                {/* プロフィール画像表示 (初期フェーズではダミー画像) */}
                <img
                  src={
                    message.user.profileImage ||
                    `https://placehold.co/24x24/b0b0b0/ffffff?text=${message.user.username
                      .charAt(0)
                      .toUpperCase()}`
                  }
                  alt={`${message.user.username}'s profile`}
                  className='w-6 h-6 rounded-full mr-2 object-cover'
                />
                <span
                  className={`font-semibold ${
                    isCurrentUser
                      ? 'text-primary-foreground/90'
                      : 'text-foreground/90'
                  }`}
                >
                  {message.user.username}
                  {message.user.isGuest && ' (ゲスト)'}
                </span>
                <span
                  className={`text-xs ml-2 ${
                    isCurrentUser
                      ? 'text-primary-foreground/70'
                      : 'text-muted-foreground'
                  }`}
                >
                  {formatTimestamp(message.createdAt)}
                </span>
              </div>

              <p className='text-base'>{message.content}</p>

              {/* リアクションボタンとリプライボタンは初期フェーズではコメントアウト */}
            </div>
          </div>
        )
      })}
    </div>
  )
}

export default MessageList
