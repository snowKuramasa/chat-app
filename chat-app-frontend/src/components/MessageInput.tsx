import React, { useState, type KeyboardEvent } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Send } from 'lucide-react' // アイコンのインポート

interface MessageInputProps {
  onSendMessage: (content: string) => void
}

const MessageInput: React.FC<MessageInputProps> = ({ onSendMessage }) => {
  const [messageContent, setMessageContent] = useState('')

  const handleSubmit = () => {
    if (messageContent.trim()) {
      onSendMessage(messageContent)
      setMessageContent('') // 送信後、入力フィールドをクリア
    }
  }

  const handleKeyPress = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      // Shift+Enterで改行、Enterで送信
      e.preventDefault() // デフォルトのEnter動作（改行）を防ぐ
      handleSubmit()
    }
  }

  return (
    <div className='p-4 bg-card border-t border-border rounded-b-lg'>
      <div className='flex items-center space-x-3'>
        <Input
          type='text'
          className='flex-1'
          placeholder='メッセージを入力...'
          value={messageContent}
          onChange={(e) => setMessageContent(e.target.value)}
          onKeyPress={handleKeyPress}
        />
        <Button
          onClick={handleSubmit}
          disabled={!messageContent.trim()} // 空の場合は送信ボタンを無効化
        >
          <Send className='h-5 w-5' />
          <span className='ml-2'>送信</span>
        </Button>
      </div>
    </div>
  )
}

export default MessageInput
