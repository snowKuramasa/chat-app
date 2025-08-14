import React, { useState, useEffect, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { io, Socket } from 'socket.io-client'
import { useAppContext } from '@/types/app-context'
import ChatSidebar from '@/components/ChatSidebar'
import MessageInput from '@/components/MessageInput'
import MessageList from '@/components/MessageList'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Menu, Users, Plus } from 'lucide-react' // ハンバーガーメニューアイコンとユーザーアイコンをインポート

import type { User } from '@/types/user'
import type { Room } from '@/types/room'
import type { Message } from '@/types/message'

const ChatPage: React.FC = () => {
  const { currentUser, logout, checkAuth, backendUrl, getToken } =
    useAppContext()
  const navigate = useNavigate()
  const [socket, setSocket] = useState<Socket | null>(null)
  const socketRef = useRef<Socket | null>(null) // Socket instance managed by ref
  const [isSocketConnected, setIsSocketConnected] = useState(false) // New state to manage socket connection status
  const [rooms, setRooms] = useState<Room[]>([])
  const [currentRoom, setCurrentRoom] = useState<Room | null>(null)
  const currentRoomRef = useRef<Room | null>(null) // Ref to hold the latest currentRoom value
  const [messagesByRoom, setMessagesByRoom] = useState<
    Record<string, Message[]>
  >({})
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const [isSidebarOpen, setIsSidebarOpen] = useState(true) // State to control sidebar visibility (true by default for desktop)
  const [showCreatePrivateChatDialog, setShowCreatePrivateChatDialog] =
    useState(false)
  const [newPrivateChatName, setNewPrivateChatName] = useState('')
  const [availableUsers, setAvailableUsers] = useState<User[]>([]) // DM/Private Chat招待用ユーザーリスト
  const [selectedUsersForChat, setSelectedUsersForChat] = useState<string[]>([]) // 選択されたユーザーID
  const [dialogError, setDialogError] = useState('') // ダイアログ内のエラーメッセージ
  const [showInviteMembersDialog, setShowInviteMembersDialog] = useState(false) // メンバー招待ダイアログ
  const [invitedMembers, setInvitedMembers] = useState<string[]>([]) // 招待するメンバーのIDリスト

  // currentRoom が変更されるたびに ref を更新
  useEffect(() => {
    currentRoomRef.current = currentRoom
  }, [currentRoom])

  // 初期ロード時またはウィンドウサイズ変更時にサイドバーの初期状態を設定
  useEffect(() => {
    const handleResize = () => {
      // 768px (Tailwindのmdブレークポイント) 以上ならサイドバーを開く、それ以下なら閉じる
      setIsSidebarOpen(window.innerWidth >= 768)
    }

    window.addEventListener('resize', handleResize)
    handleResize() // コンポーネントマウント時にも実行

    return () => window.removeEventListener('resize', handleResize)
  }, [])

  // メッセージリストを一番下までスクロールする関数
  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [])

  // 特定のルームのメッセージをREST API経由でフェッチする関数
  const fetchMessagesForRoom = useCallback(
    async (roomId: string) => {
      console.log(
        `[fetchMessagesForRoom] Fetching messages for roomId: ${roomId}`
      )
      const token = getToken()
      if (!token) {
        logout()
        return
      }

      try {
        const res = await fetch(`${backendUrl}/api/rooms/${roomId}/messages`, {
          headers: { Authorization: `Bearer ${token}` },
        })
        if (res.ok) {
          const messages: Message[] = await res.json()
          console.log(
            `[fetchMessagesForRoom] Fetched ${messages.length} messages for room ${roomId}.`
          )
          setMessagesByRoom((prevMessages) => ({
            ...prevMessages,
            [roomId]: messages,
          }))
          scrollToBottom()
        } else {
          const errorData = await res.json()
          console.error(
            `ルーム ${roomId} のメッセージ取得失敗:`,
            res.status,
            errorData.message
          )
          // alert(`メッセージ取得失敗: ${errorData.message}`); // alertはカスタムダイアログに置き換え
        }
      } catch (error) {
        console.error(`ルーム ${roomId} のメッセージ取得リクエスト失敗:`, error)
        // alert('メッセージの取得に失敗しました。'); // alertはカスタムダイアログに置き換え
      }
    },
    [backendUrl, getToken, logout, scrollToBottom]
  )

  // Define fetchRooms using useCallback (executed after Socket.IO connection)
  const fetchRooms = useCallback(async () => {
    const activeSocket = socketRef.current // Get socket instance from ref
    console.log(
      `[fetchRooms] Starting fetchRooms. Socket Connected: ${activeSocket?.connected}`
    )
    const token = getToken()
    if (!token) {
      logout()
      return
    }
    // Ensure activeSocket exists and is connected
    if (!activeSocket || !activeSocket.connected) {
      console.error(
        '[fetchRooms] activeSocket is not connected. Skipping room fetch and join_room emit.'
      )
      return
    }

    try {
      const res = await fetch(`${backendUrl}/api/rooms`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (res.ok) {
        const data = await res.json()
        console.log('APIから取得したルーム一覧データ (fetchRooms):', data)
        setRooms(data)

        // Execute only if currentRoom is not yet set (initial load or re-login)
        if (!currentRoomRef.current && data.length > 0) {
          // ★ Refer to currentRoomRef.current ★
          const generalRoom = data.find(
            (room: Room) =>
              room.name === 'General' && !room.isDM && !room.isMemo
          )
          const initialRoomToSet = generalRoom || data[0] // Prioritize General, otherwise first room

          setCurrentRoom(initialRoomToSet) // Update state

          // Fetch messages once room is determined
          fetchMessagesForRoom(initialRoomToSet.id) // Fetch messages via REST API

          // Socket.IO's join_room is necessary for real-time broadcasting
          console.log(
            `[fetchRooms] Emitting 'join_room' for initial room ${initialRoomToSet.name} (${initialRoomToSet.id}). Socket state: Connected=${activeSocket.connected}`
          )
          activeSocket.emit('join_room', initialRoomToSet.id)
          console.log(`[fetchRooms] 'join_room' emitted.`)
        }
      } else {
        console.error('ルーム一覧の取得に失敗しました:', res.status)
        // alert('ルーム一覧の取得に失敗しました。'); // alertはカスタムダイアログに置き換え
      }
    } catch (error) {
      console.error('ルーム一覧取得リクエスト失敗:', error)
      // alert('ルーム一覧の取得に失敗しました。'); // alertはカスタムダイアログに置き換え
    }
  }, [
    backendUrl,
    getToken,
    logout,
    scrollToBottom,
    currentUser,
    fetchMessagesForRoom,
  ])

  // --- Socket.IO connection and event listener setup ---
  // This useEffect only handles socket creation, event listeners, and cleanup.
  // Dependencies are minimized to prevent unnecessary reconnections.
  useEffect(() => {
    console.log('[Socket useEffect] Running Socket setup effect.')

    if (!currentUser) {
      console.log(
        '[Socket useEffect] currentUser is null. Skipping Socket setup.'
      )
      checkAuth()
      return
    }

    const token = getToken()
    if (!token) {
      console.error('[Socket useEffect] JWTトークンが見つかりません。')
      logout()
      return
    }

    const newSocket = io(backendUrl, {
      auth: {
        token: token,
      },
    })

    setSocket(newSocket)
    socketRef.current = newSocket // Update ref as well

    newSocket.on('connect', () => {
      console.log(
        'Socket.IOに接続しました:',
        newSocket.id,
        'Connection status:',
        newSocket.connected
      )
      setIsSocketConnected(true) // Update state on successful connection

      // Fetch room list immediately after connection is established
      console.log(
        `[Connect Handler] Socket connected. Calling fetchRooms. Socket connected status: ${newSocket.connected}`
      )
      fetchRooms() // Call fetchRooms with no arguments
    })

    newSocket.on('new_message', (message: Message) => {
      console.log('新しいメッセージを受信:', message)
      console.log(`[new_message Listener] Message Room ID: ${message.roomId}`)
      console.log(
        `[new_message Listener] Current Room ID (via ref): ${currentRoomRef.current?.id}`
      ) // ★ Get from ref ★
      const isForCurrentRoom = message.roomId === currentRoomRef.current?.id // ★ Get from ref ★
      console.log(
        `[new_message Listener] Is for current room (via ref)? ${isForCurrentRoom}`
      )

      setMessagesByRoom((prevMessages) => {
        const updatedMessages = {
          ...prevMessages,
          [message.roomId]: [...(prevMessages[message.roomId] || []), message],
        }
        console.log(
          `[new_message Listener] messagesByRoom updated for room ${
            message.roomId
          }. New count: ${updatedMessages[message.roomId]?.length}`
        )
        return updatedMessages
      })

      if (isForCurrentRoom) {
        scrollToBottom()
        console.log(
          `[new_message Listener] Scrolling to bottom for current room.`
        )
      } else {
        console.log(
          `[new_message Listener] Message not for current room, not scrolling.`
        )
      }
    })

    newSocket.on('memo_room_info', (room: Room) => {
      console.log('メモルーム情報を受信:', room)
      setRooms((prevRooms) => {
        if (prevRooms.some((r) => r.id === room.id)) {
          return prevRooms.map((r) => (r.id === room.id ? room : r))
        }
        return [...prevRooms, room]
      })
      setCurrentRoom(room)
      console.log(
        `[memo_room_info] Emitting 'join_room' for memo room ${room.name} (${room.id}). Socket connected: ${socketRef.current?.connected}`
      )
      if (socketRef.current?.connected) {
        socketRef.current.emit('join_room', room.id) // Use socket from ref (for real-time broadcasting)
      } else {
        console.warn(
          `[memo_room_info] Socket not connected when trying to join memo room ${room.name}.`
        )
      }
      fetchMessagesForRoom(room.id) // Fetch messages via REST API for memo room as well
    })

    newSocket.on('error', (error: { message: string }) => {
      console.error('Socketエラー:', error)
      // alert(`Socketエラー: ${error.message}`); // alertはカスタムダイアログに置き換え
      if (error.message.includes('Authentication error')) {
        logout()
      }
    })

    newSocket.on('disconnect', (reason) => {
      console.log('Socket.IOから切断されました:', reason)
      setIsSocketConnected(false) // Update state on disconnect
    })

    // Cleanup function
    return () => {
      console.log('[Socket useEffect] Cleaning up socket connection.')
      newSocket.disconnect()
    }
    // Dependencies: currentUser, backendUrl, checkAuth, getToken, logout, scrollToBottom, fetchRooms, fetchMessagesForRoom
    // currentRoom, messagesByRoom are removed from here and accessed via ref within new_message listener
  }, [
    currentUser,
    backendUrl,
    checkAuth,
    getToken,
    logout,
    scrollToBottom,
    fetchRooms,
    fetchMessagesForRoom,
  ])

  // 公開チャットルームへの参加ハンドラ
  const handleJoinPublicRoom = useCallback(
    async (roomId: string) => {
      const token = getToken()
      if (!token) {
        logout()
        return
      }
      if (currentUser?.isGuest) {
        // ゲストユーザーは参加不可
        // alert('ゲストユーザーはルームに参加できません。'); // alertはカスタムダイアログに置き換え
        return
      }

      try {
        const res = await fetch(`${backendUrl}/api/rooms/${roomId}/members`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ userIds: [currentUser?.id] }), // 自分自身を追加
        })
        if (res.ok) {
          // alert('ルームに参加しました！'); // alertはカスタムダイアログに置き換え
          fetchRooms() // ルームリストを更新
          // 参加したルームに自動的に切り替える
          const joinedRoom = rooms.find((r) => r.id === roomId)
          if (joinedRoom) {
            handleSelectRoom(joinedRoom)
          }
        } else {
          const errorData = await res.json()
          // alert(`ルーム参加失敗: ${errorData.message}`); // alertはカスタムダイアログに置き換え
        }
      } catch (error) {
        console.error('ルーム参加リクエスト失敗:', error)
        // alert('ルームの参加に失敗しました。'); // alertはカスタムダイアログに置き換え
      }
    },
    [backendUrl, getToken, logout, currentUser, fetchRooms, rooms]
  )

  const handleSelectRoom = useCallback(
    (room: Room) => {
      const activeSocket = socketRef.current
      // Do nothing if already in the same room
      if (room.id === currentRoom?.id) {
        console.log(
          `[handleSelectRoom] Already in room ${room.name}. Scrolling to bottom.`
        )
        scrollToBottom() // Scroll to bottom if in existing room
        return
      }

      if (activeSocket && isSocketConnected) {
        // Ensure socket is valid and connected
        setCurrentRoom(room)
        // Fetch messages via REST API
        fetchMessagesForRoom(room.id) // Fetch messages via REST API

        console.log(
          `[handleSelectRoom] Emitting 'join_room' for room ${room.name} (${room.id}). Socket connected: ${activeSocket.connected}`
        )
        activeSocket.emit('join_room', room.id) // Ensure socket is connected (for real-time broadcasting)
        // On mobile, close sidebar after selecting a room
        if (window.innerWidth < 768) {
          // Assuming md breakpoint is 768px (default Tailwind)
          setIsSidebarOpen(false)
        }
      } else {
        console.warn(
          `[handleSelectRoom] Socket not connected or active (${
            isSocketConnected ? 'connected' : 'not connected'
          }) when trying to select room ${room.name}.`
        )
      }
    },
    [currentRoom, scrollToBottom, isSocketConnected, fetchMessagesForRoom]
  )

  const handleSendMessage = useCallback(
    (content: string) => {
      const activeSocket = socketRef.current
      if (
        activeSocket &&
        currentRoom &&
        currentUser &&
        content.trim() !== '' &&
        isSocketConnected
      ) {
        // Check if socket is connected
        console.log(
          `[handleSendMessage] Emitting 'send_message' to room ${currentRoom.name} (${currentRoom.id}).`
        )
        activeSocket.emit('send_message', {
          roomId: currentRoom.id,
          content: content,
        })
      } else if (!isSocketConnected) {
        console.warn(
          `[handleSendMessage] Socket not connected when trying to send message.`
        )
      } else {
        console.warn(
          `[handleSendMessage] Message conditions not met. currentRoom: ${!!currentRoom}, currentUser: ${!!currentUser}, content: ${
            content.trim() !== ''
          }, isSocketConnected: ${isSocketConnected}`
        )
      }
    },
    [currentRoom, currentUser, isSocketConnected]
  )

  const handleCreateOrJoinMemoRoom = useCallback(() => {
    const activeSocket = socketRef.current
    if (activeSocket && currentUser && isSocketConnected) {
      // Check if socket is connected
      console.log(
        `[handleCreateOrJoinMemoRoom] Emitting 'create_or_join_memo_room'.`
      )
      activeSocket.emit('create_or_join_memo_room')
      // On mobile, close sidebar after creating/joining memo room
      if (window.innerWidth < 768) {
        setIsSidebarOpen(false)
      }
    } else if (!isSocketConnected) {
      console.warn(
        `[handleCreateOrJoinMemoRoom] Socket not connected when trying to create/join memo room.`
      )
    }
  }, [currentUser, isSocketConnected])

  // プライベートチャット作成ダイアログの開閉
  const handleOpenCreatePrivateChatDialog = useCallback(async () => {
    setDialogError('')
    setNewPrivateChatName('')
    setSelectedUsersForChat([])
    try {
      const token = getToken()
      if (!token) {
        logout()
        return
      }
      const res = await fetch(`${backendUrl}/api/users`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (res.ok) {
        const users = await res.json()
        setAvailableUsers(users)
        setShowCreatePrivateChatDialog(true)
      } else {
        const errorData = await res.json()
        setDialogError(`ユーザーリストの取得失敗: ${errorData.message}`)
      }
    } catch (error) {
      console.error('ユーザーリスト取得リクエスト失敗:', error)
      setDialogError('ユーザーリストの取得に失敗しました。')
    }
  }, [backendUrl, getToken, logout])

  const handleCloseCreatePrivateChatDialog = () => {
    setShowCreatePrivateChatDialog(false)
    setDialogError('')
  }

  const handleToggleUserSelection = (userId: string) => {
    setSelectedUsersForChat((prev) =>
      prev.includes(userId)
        ? prev.filter((id) => id !== userId)
        : [...prev, userId]
    )
  }

  // 新しいプライベートチャットを作成するハンドラ
  const handleCreatePrivateChat = useCallback(async () => {
    if (!newPrivateChatName.trim()) {
      setDialogError('プライベートチャット名を入力してください。')
      return
    }
    if (selectedUsersForChat.length === 0) {
      setDialogError('少なくとも1人のユーザーを選択してください。')
      return
    }
    if (currentUser?.isGuest) {
      setDialogError('ゲストユーザーはプライベートチャットを作成できません。')
      return
    }

    setDialogError('')
    try {
      const token = getToken()
      if (!token) {
        logout()
        return
      }

      const res = await fetch(`${backendUrl}/api/rooms/private`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: newPrivateChatName,
          participantIds: selectedUsersForChat,
        }),
      })

      if (res.ok) {
        // alert('プライベートチャットを作成しました！'); // alertはカスタムダイアログに置き換え
        fetchRooms() // ルームリストを更新
        handleCloseCreatePrivateChatDialog()
      } else {
        const errorData = await res.json()
        setDialogError(`作成失敗: ${errorData.message}`)
      }
    } catch (error) {
      console.error('プライベートチャット作成エラー:', error)
      setDialogError('プライベートチャットの作成に失敗しました。')
    }
  }, [
    newPrivateChatName,
    selectedUsersForChat,
    backendUrl,
    getToken,
    logout,
    fetchRooms,
    currentUser,
  ])

  // メンバー招待ダイアログの開閉
  const handleOpenInviteMembersDialog = useCallback(async () => {
    if (!currentRoom || !currentRoom.isDM || currentRoom.isMemo) {
      // alert('このルームにはメンバーを招待できません。'); // alertはカスタムダイアログに置き換え
      setDialogError('このルームにはメンバーを招待できません。') // エラーメッセージをダイアログ内に表示
      return
    }
    setDialogError('')
    setInvitedMembers([])
    try {
      const token = getToken()
      if (!token) {
        logout()
        return
      }
      const res = await fetch(`${backendUrl}/api/users`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (res.ok) {
        const allUsers = await res.json()
        // 現在のルームにいないユーザーのみをフィルタリング
        const currentMemberIds = new Set(
          currentRoom.users?.map((u) => u.id) || []
        )
        const nonMembers = allUsers.filter(
          (user: User) =>
            !currentMemberIds.has(user.id) && user.id !== currentUser?.id
        )
        setAvailableUsers(nonMembers)
        setShowInviteMembersDialog(true)
      } else {
        const errorData = await res.json()
        setDialogError(`ユーザーリストの取得失敗: ${errorData.message}`)
      }
    } catch (error) {
      console.error('ユーザーリスト取得リクエスト失敗:', error)
      setDialogError('ユーザーリストの取得に失敗しました。')
    }
  }, [backendUrl, getToken, logout, currentRoom, currentUser])

  const handleCloseInviteMembersDialog = () => {
    setShowInviteMembersDialog(false)
    setDialogError('')
  }

  const handleToggleInviteUserSelection = (userId: string) => {
    setInvitedMembers((prev) =>
      prev.includes(userId)
        ? prev.filter((id) => id !== userId)
        : [...prev, userId]
    )
  }

  // メンバーを招待するハンドラ
  const handleInviteMembers = useCallback(async () => {
    if (!currentRoom) return
    if (invitedMembers.length === 0) {
      setDialogError('招待するユーザーを選択してください。')
      return
    }
    if (currentUser?.isGuest) {
      setDialogError('ゲストユーザーはメンバーを招待できません。')
      return
    }

    setDialogError('')
    try {
      const token = getToken()
      if (!token) {
        logout()
        return
      }

      const res = await fetch(
        `${backendUrl}/api/rooms/${currentRoom.id}/members`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ userIds: invitedMembers }),
        }
      )

      if (res.ok) {
        // alert('メンバーを招待しました！'); // alertはカスタムダイアログに置き換え
        fetchRooms() // ルームリストを更新 (サイドバーに新しい参加者が表示されるよう)
        // 必要に応じて、現在のルームのメッセージも再フェッチ
        fetchMessagesForRoom(currentRoom.id)
        handleCloseInviteMembersDialog()
      } else {
        const errorData = await res.json()
        setDialogError(`招待失敗: ${errorData.message}`)
      }
    } catch (error) {
      console.error('メンバー招待エラー:', error)
      setDialogError('メンバーの招待に失敗しました。')
    }
  }, [
    currentRoom,
    invitedMembers,
    backendUrl,
    getToken,
    logout,
    fetchRooms,
    fetchMessagesForRoom,
    currentUser,
  ])

  if (!currentUser) {
    return (
      <div className='flex items-center justify-center min-h-screen bg-background text-lg font-medium '>
        認証中...
      </div>
    )
  }

  const currentMessages = messagesByRoom[currentRoom?.id || ''] || []

  return (
    <div className='flex h-screen bg-background p-4 gap-4'>
      {' '}
      {/* ADDED p-4 and gap-4 here, removed h-[100vh] */}
      {/* Sidebar (Responsive) */}
      <div
        className={`
        flex-shrink-0
        md:w-72
        w-full
        bg-card text-foreground flex flex-col rounded-lg shadow-lg /* m-4 removed */
        md:relative md:translate-x-0
        ${
          isSidebarOpen
            ? 'fixed inset-y-0 left-0 z-50 transform translate-x-0'
            : 'fixed inset-y-0 left-0 z-50 transform -translate-x-full'
        }
        transition-transform duration-300 ease-in-out
        h-full /* Added h-full */
      `}
      >
        <ChatSidebar
          rooms={rooms}
          currentRoom={currentRoom}
          onSelectRoom={handleSelectRoom}
          currentUser={currentUser}
          onLogout={logout}
          fetchRooms={fetchRooms}
          navigate={navigate}
          onCreateOrJoinMemoRoom={handleCreateOrJoinMemoRoom}
        />
      </div>
      {/* Main chat area (Responsive) */}
      <div
        className={`
        flex-1 flex flex-col bg-card rounded-lg shadow-lg /* m-4 and w-[100%] removed */
        ${
          isSidebarOpen && window.innerWidth < 768 ? 'ml-0' : 'md:ml-0'
        } /* Simplified: gap-4 on parent handles desktop spacing. ml-0 for mobile overlay transition. */
        transition-all duration-300 ease-in-out
      `}
      >
        <div className='flex items-center justify-between p-4 border-b border-border bg-muted rounded-t-lg'>
          {/* Sidebar toggle button (visible on small screens) */}
          <Button
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            variant='ghost' // 目立たないボタンにする
            className='md:hidden p-2 mr-2' // Only visible on screens smaller than md
          >
            <Menu className='h-6 w-6 text-foreground' />{' '}
            {/* アイコンの色を調整 */}
          </Button>

          <h2 className='text-xl font-semibold text-primary flex-1'>
            {' '}
            {/* flex-1で残りのスペースを占有 */}
            {currentRoom ? currentRoom.name : 'ルームを選択してください'}
            {currentRoom?.isDM && (
              <span className='ml-2 text-sm text-muted-foreground'>
                (プライベート)
              </span>
            )}
            {currentRoom?.isMemo && (
              <span className='ml-2 text-sm text-muted-foreground'>(メモ)</span>
            )}
          </h2>
          {currentRoom && currentRoom.isDM && !currentRoom.isMemo && (
            <Button
              onClick={handleOpenInviteMembersDialog}
              className='ml-auto mr-2' // 右寄せ
              disabled={currentUser.isGuest} // ゲストユーザーは招待不可
            >
              <Plus className='h-4 w-4 mr-2' />
              メンバー招待
            </Button>
          )}
        </div>

        <div className='flex-1 p-4 overflow-y-auto custom-scrollbar'>
          {' '}
          {/* Removed w-[70vw] */}
          <MessageList messages={currentMessages} currentUser={currentUser} />
          <div ref={messagesEndRef} />
        </div>

        {currentRoom && (
          <div className='p-4 border-t border-border bg-background rounded-b-lg'>
            <MessageInput onSendMessage={handleSendMessage} />
          </div>
        )}
      </div>
      {/* プライベートチャット作成ダイアログ */}
      <Dialog
        open={showCreatePrivateChatDialog}
        onOpenChange={handleCloseCreatePrivateChatDialog}
      >
        <DialogContent className='sm:max-w-[425px]'>
          <DialogHeader>
            <DialogTitle>新しいプライベートチャットを作成</DialogTitle>
          </DialogHeader>
          <div className='grid gap-4 py-4'>
            {dialogError && (
              <p className='text-destructive text-sm text-center'>
                {dialogError}
              </p>
            )}
            <Input
              placeholder='チャットルーム名'
              value={newPrivateChatName}
              onChange={(e) => setNewPrivateChatName(e.target.value)}
              className='col-span-4'
              disabled={currentUser.isGuest} // ゲストユーザーは入力不可
            />
            <h4 className='font-semibold mt-2'>参加者を選択:</h4>
            <div className='max-h-60 overflow-y-auto border rounded-md'>
              {availableUsers.length === 0 ? (
                <p className='p-3 text-muted-foreground text-center'>
                  招待可能なユーザーがいません。
                </p>
              ) : (
                availableUsers.map((user) => (
                  <div
                    key={user.id}
                    className={`flex items-center p-2 cursor-pointer hover:bg-muted ${
                      selectedUsersForChat.includes(user.id)
                        ? 'bg-accent/50'
                        : ''
                    }`}
                    onClick={() => handleToggleUserSelection(user.id)}
                  >
                    <input
                      type='checkbox'
                      checked={selectedUsersForChat.includes(user.id)}
                      readOnly
                      className='mr-2'
                      disabled={currentUser.isGuest} // ゲストユーザーは選択不可
                    />
                    <img
                      src={
                        user.profileImage ||
                        `https://placehold.co/24x24/b0b0b0/ffffff?text=${user.username
                          .charAt(0)
                          .toUpperCase()}`
                      }
                      alt={`${user.username}'s profile`}
                      className='w-6 h-6 rounded-full mr-2 object-cover'
                    />
                    <label htmlFor={`user-${user.id}`} className='font-normal'>
                      {' '}
                      {/* Added label for accessibility */}
                      {user.username}
                    </label>
                  </div>
                ))
              )}
            </div>
          </div>
          <DialogFooter>
            <Button
              onClick={handleCreatePrivateChat}
              disabled={
                !newPrivateChatName.trim() ||
                selectedUsersForChat.length === 0 ||
                currentUser?.isGuest
              }
            >
              作成
            </Button>
            <Button
              variant='outline'
              onClick={handleCloseCreatePrivateChatDialog}
            >
              {' '}
              {/* Added variant="outline" */}
              キャンセル
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {/* メンバー招待ダイアログ */}
      <Dialog
        open={showInviteMembersDialog}
        onOpenChange={handleCloseInviteMembersDialog}
      >
        <DialogContent className='sm:max-w-[500px]'>
          <DialogHeader>
            <DialogTitle>メンバーを招待</DialogTitle>
          </DialogHeader>
          <div className='grid gap-4 py-4'>
            {dialogError && (
              <p className='text-destructive text-sm text-center'>
                {dialogError}
              </p>
            )}
            <h4 className='font-semibold mt-2'>招待するユーザーを選択:</h4>
            <div className='max-h-60 overflow-y-auto border rounded-md'>
              {availableUsers.length === 0 ? (
                <p className='p-3 text-muted-foreground text-center'>
                  招待可能なユーザーがいません。
                </p>
              ) : (
                availableUsers.map((user) => (
                  <div
                    key={user.id}
                    className={`flex items-center p-2 cursor-pointer hover:bg-muted ${
                      invitedMembers.includes(user.id) ? 'bg-accent/50' : ''
                    }`}
                    onClick={() => handleToggleInviteUserSelection(user.id)}
                  >
                    <input
                      type='checkbox'
                      checked={invitedMembers.includes(user.id)}
                      readOnly
                      className='mr-2'
                      disabled={currentUser.isGuest} // ゲストユーザーは選択不可
                    />
                    <img
                      src={
                        user.profileImage ||
                        `https://placehold.co/24x24/b0b0b0/ffffff?text=${user.username
                          .charAt(0)
                          .toUpperCase()}`
                      }
                      alt={`${user.username}'s profile`}
                      className='w-6 h-6 rounded-full mr-2 object-cover'
                    />
                    <label
                      htmlFor={`invite-user-${user.id}`}
                      className='font-normal'
                    >
                      {' '}
                      {/* Added label for accessibility */}
                      {user.username}
                    </label>
                  </div>
                ))
              )}
            </div>
          </div>
          <DialogFooter>
            <Button
              onClick={handleInviteMembers}
              disabled={invitedMembers.length === 0 || currentUser?.isGuest}
            >
              招待
            </Button>
            <Button variant='outline' onClick={handleCloseInviteMembersDialog}>
              {' '}
              {/* Added variant="outline" */}
              キャンセル
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

export default ChatPage
