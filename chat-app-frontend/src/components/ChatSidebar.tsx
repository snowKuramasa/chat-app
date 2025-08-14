import React, { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox' // Checkboxをインポート

import {
  MessageSquare, // チャットルームアイコン
  FileText, // メモアイコン
  LogOut, // ログアウトアイコン
  Plus, // 新規作成アイコン
  Users, // グループチャットアイコン
} from 'lucide-react' // lucide-react からアイコンをインポート

import type { Room } from '@/types/room'
import type { User } from '@/types/user'
import { useAppContext } from '@/types/app-context'

interface ChatSidebarProps {
  rooms: Room[]
  currentRoom: Room | null
  onSelectRoom: (room: Room) => void
  currentUser: User
  onLogout: () => void
  fetchRooms: () => void // ルームリストをリロードするための関数
  navigate: (path: string) => void
  onCreateOrJoinMemoRoom: () => void
  // ChatPageから渡されるダイアログ開閉ハンドラと参加ハンドラは、
  // Sidebar内でDialogが管理されるようになったため不要になりました。
  // onOpenCreatePrivateChatDialog: () => void;
  // onJoinPublicRoom: (roomId: string) => void;
}

const ChatSidebar: React.FC<ChatSidebarProps> = ({
  rooms,
  currentRoom,
  onSelectRoom,
  currentUser,
  onLogout,
  fetchRooms,
  navigate,
  onCreateOrJoinMemoRoom,
}) => {
  const { backendUrl, getToken } = useAppContext()

  // 公開ルーム作成ダイアログの状態
  const [isCreatePublicRoomDialogOpen, setIsCreatePublicRoomDialogOpen] =
    useState(false)
  const [newPublicRoomName, setNewPublicRoomName] = useState('')
  const [publicRoomError, setPublicRoomError] = useState('')

  // プライベートチャット作成ダイアログの状態
  const [isCreatePrivateRoomDialogOpen, setIsCreatePrivateRoomDialogOpen] =
    useState(false)
  const [newPrivateRoomName, setNewPrivateRoomName] = useState('')
  const [allUsers, setAllUsers] = useState<User[]>([]) // DM/グループチャットの相手選択用
  const [selectedParticipantIds, setSelectedParticipantIds] = useState<
    string[]
  >([])
  const [privateRoomError, setPrivateRoomError] = useState('')

  // ルームのカテゴリ分け
  // rooms が undefined や null の場合でも安全にフィルターできるように修正
  const publicRooms = (rooms || []).filter((room) => !room.isDM && !room.isMemo)
  const privateRooms = (rooms || []).filter((room) => room.isDM && !room.isMemo) // isDM:true のルームをプライベートチャットとする
  const memoRooms = (rooms || []).filter(
    (room) => room.isMemo && room.ownerId === currentUser.id
  )

  // ユーザーがメンバーとして参加している公開ルームのIDリスト
  const joinedPublicRoomIds = new Set(
    publicRooms
      .filter((room) => room.users?.some((u) => u.id === currentUser.id))
      .map((r) => r.id)
  )

  // 参加可能な公開ルーム (ユーザーがまだ参加していないもの)
  const joinablePublicRooms = publicRooms.filter(
    (room) => !joinedPublicRoomIds.has(room.id)
  )

  // 全ユーザーリストの取得（プライベートチャット作成用）
  useEffect(() => {
    const fetchUsers = async () => {
      const token = getToken()
      if (!token) {
        // alert('認証されていません。'); // alertではなくUIで表示
        return
      }
      try {
        const res = await fetch(`${backendUrl}/api/users`, {
          headers: { Authorization: `Bearer ${token}` },
        })
        if (res.ok) {
          const data = await res.json()
          // 自分自身を除外
          setAllUsers(data.filter((user: User) => user.id !== currentUser.id))
        } else {
          console.error('ユーザー一覧の取得に失敗しました:', res.status)
          // エラーをダイアログ内に表示するため、setStateで設定
          setPrivateRoomError('ユーザー一覧の取得に失敗しました。')
        }
      } catch (error) {
        console.error('ユーザー一覧取得リクエスト失敗:', error)
        setPrivateRoomError('ユーザー一覧の取得に失敗しました。')
      }
    }
    if (isCreatePrivateRoomDialogOpen) {
      // ダイアログが開かれたときにフェッチ
      fetchUsers()
    }
  }, [isCreatePrivateRoomDialogOpen, backendUrl, getToken, currentUser.id]) // currentUser.id を依存配列に追加

  // 新しい公開チャットルームの作成
  const handleCreatePublicRoom = async () => {
    setPublicRoomError('')
    if (!newPublicRoomName.trim()) {
      setPublicRoomError('ルーム名を入力してください。')
      return
    }
    if (currentUser.isGuest) {
      // ゲストユーザーの制限を追加
      setPublicRoomError('ゲストユーザーはルームを作成できません。')
      return
    }

    try {
      const token = getToken()
      if (!token) {
        setPublicRoomError('認証されていません。')
        return
      }

      const res = await fetch(`${backendUrl}/api/rooms/public`, {
        // エンドポイントを /public に変更
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ name: newPublicRoomName }),
      })

      if (res.ok) {
        // alert(`公開チャットルーム「${newPublicRoomName}」を作成しました！`); // alertを削除
        setIsCreatePublicRoomDialogOpen(false)
        setNewPublicRoomName('')
        fetchRooms() // 作成後、リストを更新する
        // 成功メッセージは表示しない、ルームが追加されることで分かる
      } else {
        const errorData = await res.json()
        setPublicRoomError(`ルーム作成失敗: ${errorData.message}`)
      }
    } catch (error) {
      console.error('公開チャットルーム作成エラー:', error)
      setPublicRoomError('ルームの作成に失敗しました。')
    }
  }

  // 公開チャットルームへの参加ハンドラ
  const handleJoinPublicRoom = async (roomId: string) => {
    const token = getToken()
    if (!token) {
      alert('認証されていません。')
      return
    } // alertをカスタムダイアログに置き換え
    if (currentUser.isGuest) {
      // ゲストユーザーの制限を追加
      alert('ゲストユーザーはルームに参加できません。')
      return
    }

    try {
      const res = await fetch(`${backendUrl}/api/rooms/${roomId}/members`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ userIds: [currentUser.id] }), // 自分自身を追加
      })
      if (res.ok) {
        // alert('ルームに参加しました！'); // alertを削除
        fetchRooms() // ルームリストを更新
        // 参加したルームに自動的に切り替える
        const joinedRoom = rooms.find((r) => r.id === roomId)
        if (joinedRoom) {
          onSelectRoom(joinedRoom) // ルーム選択をトリガー
        }
      } else {
        const errorData = await res.json()
        alert(`ルーム参加失敗: ${errorData.message}`) // alertをカスタムダイアログに置き換え
      }
    } catch (error) {
      console.error('ルーム参加リクエスト失敗:', error)
      alert('ルームの参加に失敗しました。') // alertをカスタムダイアログに置き換え
    }
  }

  // 新しいプライベートチャットルームの作成
  const handleCreatePrivateRoom = async () => {
    setPrivateRoomError('')
    if (!newPrivateRoomName.trim()) {
      setPrivateRoomError('ルーム名を入力してください。')
      return
    }
    if (selectedParticipantIds.length === 0) {
      setPrivateRoomError('招待するユーザーを少なくとも1人選択してください。')
      return
    }
    if (currentUser.isGuest) {
      // ゲストユーザーの制限を追加
      setPrivateRoomError(
        'ゲストユーザーはプライベートチャットを作成できません。'
      )
      return
    }

    try {
      const token = getToken()
      if (!token) {
        setPrivateRoomError('認証されていません。')
        return
      }

      const res = await fetch(`${backendUrl}/api/rooms/private`, {
        // エンドポイントを /private に変更
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: newPrivateRoomName,
          participantIds: selectedParticipantIds,
        }),
      })

      if (res.ok) {
        // alert(`プライベートチャットルーム「${newPrivateRoomName}」を作成しました！`); // alertを削除
        setIsCreatePrivateRoomDialogOpen(false)
        setNewPrivateRoomName('')
        setSelectedParticipantIds([])
        fetchRooms() // 作成後、リストを更新する
        // 成功メッセージは表示しない、ルームが追加されることで分かる
      } else {
        const errorData = await res.json()
        setPrivateRoomError(`ルーム作成失敗: ${errorData.message}`)
      }
    } catch (error) {
      console.error('プライベートチャットルーム作成エラー:', error)
      setPrivateRoomError('ルームの作成に失敗しました。')
    }
  }

  const handleParticipantToggle = (userId: string, isChecked: boolean) => {
    setSelectedParticipantIds((prev) =>
      isChecked ? [...prev, userId] : prev.filter((id) => id !== userId)
    )
  }

  return (
    // サイドバーの幅はChatPage.tsxで制御されているため、ここではw-fullのまま
    // bg-card, rounded-lg, shadow-lg は親コンポーネント (ChatPage.tsx) で適用されているため削除
    <div className='w-full flex flex-col p-4'>
      <h1 className='text-2xl font-bold mb-6 text-center text-primary'>
        Chat App
        <span className='block text-sm font-normal text-muted-foreground'>
          ({currentUser.username}
          {currentUser.isGuest ? ' (ゲスト)' : ''})
        </span>
      </h1>
      {/* ここからスクロール可能な領域 */}
      <div className='flex-1 overflow-y-auto custom-scrollbar pr-2'>
        {/* 参加している公開チャットルーム */}
        <div className='mb-6'>
          <h3 className='text-lg font-semibold mb-3 flex items-center text-secondary-foreground'>
            {' '}
            {/* text-secondary-foreground を追加 */}
            <MessageSquare className='w-5 h-5 mr-2' />
            公開チャットルーム
          </h3>
          <ul className='space-y-2'>
            {publicRooms.filter((room) => joinedPublicRoomIds.has(room.id))
              .length > 0 ? ( // 参加済みのものだけ表示
              publicRooms
                .filter((room) => joinedPublicRoomIds.has(room.id))
                .map((room) => (
                  <li
                    key={room.id}
                    className={`flex items-center p-3 rounded-md cursor-pointer transition-colors duration-150 ${
                      currentRoom?.id === room.id
                        ? 'bg-primary text-primary-foreground font-bold'
                        : 'hover:bg-muted'
                    }`}
                    onClick={() => onSelectRoom(room)}
                  >
                    <span className='truncate'>{room.name}</span>
                  </li>
                ))
            ) : (
              <p className='text-muted-foreground text-sm pl-3'>
                参加している公開ルームはありません。
              </p>
            )}
            <li className='flex items-center p-0 rounded-md cursor-pointer hover:bg-muted'>
              <Button
                className='w-full justify-start' // に変更
                onClick={() => {
                  setIsCreatePublicRoomDialogOpen(true)
                  setNewPublicRoomName('')
                  setPublicRoomError('')
                }}
                disabled={currentUser.isGuest} // ゲストユーザーは無効化
              >
                <Plus className='w-5 h-5 mr-3' />
                新しい公開ルームを作成
              </Button>
            </li>
          </ul>
        </div>

        {/* 参加可能な公開チャットルーム */}
        {joinablePublicRooms.length > 0 && (
          <div className='mb-6'>
            <h3 className='text-lg font-semibold mb-3 flex items-center text-secondary-foreground'>
              {' '}
              {/* text-secondary-foreground を追加 */}
              <MessageSquare className='w-5 h-5 mr-2' />
              参加可能な公開ルーム
            </h3>
            <ul className='space-y-2'>
              {joinablePublicRooms.map((room) => (
                <li
                  key={room.id}
                  className={`flex items-center p-3 rounded-md cursor-pointer transition-colors duration-150 ${
                    currentRoom?.id === room.id
                      ? 'bg-primary text-primary-foreground font-bold'
                      : 'hover:bg-muted'
                  }`}
                  onClick={() => onSelectRoom(room)}
                >
                  <span className='truncate'>{room.name}</span>
                  <Button
                    variant='outline'
                    size='sm'
                    className='ml-auto'
                    onClick={(e) => {
                      e.stopPropagation()
                      handleJoinPublicRoom(room.id)
                    }}
                    disabled={currentUser.isGuest}
                  >
                    参加
                  </Button>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* プライベートチャットルーム */}
        <div className='mb-6'>
          <h3 className='text-lg font-semibold mb-3 flex items-center text-secondary-foreground'>
            {' '}
            {/* text-secondary-foreground を追加 */}
            <Users className='w-5 h-5 mr-2' />
            プライベートチャット
          </h3>
          <ul className='space-y-2'>
            {privateRooms.length > 0 ? (
              privateRooms.map((room) => (
                <li
                  key={room.id}
                  className={`flex items-center p-3 rounded-md cursor-pointer transition-colors duration-150 ${
                    currentRoom?.id === room.id
                      ? 'bg-primary text-primary-foreground font-bold'
                      : 'hover:bg-muted'
                  }`}
                  onClick={() => onSelectRoom(room)}
                >
                  <span className='truncate'>{room.name}</span>
                  <span className='ml-2 text-xs text-muted-foreground'>
                    ({room.users?.length || 0}人)
                  </span>{' '}
                  {/* 参加人数を表示 */}
                </li>
              ))
            ) : (
              <p className='text-muted-foreground text-sm pl-3'>
                プライベートチャットルームはありません。
              </p>
            )}
            <li className='flex items-center p-0 rounded-md cursor-pointer hover:bg-muted'>
              <Button
                className='w-full justify-start' // に変更
                onClick={() => {
                  setIsCreatePrivateRoomDialogOpen(true)
                  setNewPrivateRoomName('')
                  setSelectedParticipantIds([])
                  setPrivateRoomError('')
                }}
                disabled={currentUser.isGuest} // ゲストユーザーは無効化
              >
                <Plus className='w-5 h-5 mr-3' />
                プライベートチャット作成
              </Button>
            </li>
          </ul>
        </div>

        {/* メモルーム */}
        <div className='mb-6'>
          <h3 className='text-lg font-semibold mb-3 flex items-center text-secondary-foreground'>
            {' '}
            {/* text-secondary-foreground を追加 */}
            <FileText className='w-5 h-5 mr-2' />
            メモルーム
          </h3>
          <ul className='space-y-2'>
            {memoRooms.length > 0 ? (
              memoRooms.map((room) => (
                <li
                  key={room.id}
                  className={`flex items-center p-3 rounded-md cursor-pointer transition-colors duration-150 ${
                    currentRoom?.id === room.id
                      ? 'bg-primary text-primary-foreground font-bold'
                      : 'hover:bg-muted'
                  }`}
                  onClick={() => onSelectRoom(room)}
                >
                  <span className='truncate'>{room.name}</span>
                </li>
              ))
            ) : (
              <p className='text-muted-foreground text-sm pl-3'>
                メモルームはありません。
              </p>
            )}
            <li className='flex items-center p-0 rounded-md cursor-pointer hover:bg-muted'>
              <Button
                className='w-full justify-start' // に変更
                onClick={onCreateOrJoinMemoRoom}
              >
                <Plus className='w-5 h-5 mr-3' />
                メモ用ルームを開く
              </Button>
            </li>
          </ul>
        </div>
      </div>{' '}
      {/* スクロール可能な領域ここまで */}
      <div className='mt-auto pt-4 border-t border-border'>
        <Button onClick={() => navigate('/profile')} className='w-full mb-3'>
          プロフィール設定
        </Button>
        <Button onClick={onLogout} variant='destructive' className='w-full'>
          <LogOut className='w-5 h-5 mr-2' />
          ログアウト
        </Button>
      </div>
      {/* 新しい公開ルーム作成ダイアログ */}
      <Dialog
        open={isCreatePublicRoomDialogOpen}
        onOpenChange={setIsCreatePublicRoomDialogOpen}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>新しい公開チャットルームを作成</DialogTitle>
            <DialogDescription>
              他のユーザーと共有する新しい公開チャットルームを作成します。
            </DialogDescription>
          </DialogHeader>
          <div className='grid gap-4 py-4'>
            <div className='grid grid-cols-4 items-center gap-4'>
              <Label htmlFor='public-room-name' className='text-right'>
                ルーム名
              </Label>
              <Input
                id='public-room-name'
                value={newPublicRoomName}
                onChange={(e) => setNewPublicRoomName(e.target.value)}
                className='col-span-3'
                disabled={currentUser.isGuest} // ゲストユーザーは入力不可
              />
            </div>
            {publicRoomError && (
              <p className='text-destructive text-sm col-span-4 text-center'>
                {publicRoomError}
              </p>
            )}
            {currentUser.isGuest && (
              <p className='text-muted-foreground text-sm text-center'>
                ゲストユーザーはルームを作成できません。
              </p>
            )}
          </div>
          <DialogFooter>
            <Button
              variant='outline'
              onClick={() => setIsCreatePublicRoomDialogOpen(false)}
            >
              {' '}
              {/* variant="outline" に変更 */}
              キャンセル
            </Button>
            <Button
              onClick={handleCreatePublicRoom}
              disabled={!newPublicRoomName.trim() || currentUser.isGuest}
            >
              作成
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {/* 新しいプライベートチャットルーム作成ダイアログ */}
      <Dialog
        open={isCreatePrivateRoomDialogOpen}
        onOpenChange={setIsCreatePrivateRoomDialogOpen}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>新しいプライベートチャットルームを作成</DialogTitle>
            <DialogDescription>
              招待したユーザーのみが参加できるチャットルームを作成します。
            </DialogDescription>
          </DialogHeader>
          <div className='grid gap-4 py-4'>
            <div className='grid grid-cols-4 items-center gap-4'>
              <Label htmlFor='private-room-name' className='text-right'>
                ルーム名
              </Label>
              <Input
                id='private-room-name'
                value={newPrivateRoomName}
                onChange={(e) => setNewPrivateRoomName(e.target.value)}
                className='col-span-3'
                disabled={currentUser.isGuest} // ゲストユーザーは入力不可
              />
            </div>
            {privateRoomError && (
              <p className='text-destructive text-sm col-span-4 text-center'>
                {privateRoomError}
              </p>
            )}
            {currentUser.isGuest && (
              <p className='text-muted-foreground text-sm text-center'>
                ゲストユーザーはプライベートチャットを作成できません。
              </p>
            )}
            <div className='mt-4'>
              <Label className='text-base'>招待するユーザー:</Label>
              <div className='mt-2 h-40 overflow-y-auto custom-scrollbar border rounded-md p-2'>
                {allUsers.length === 0 ? (
                  <p className='text-muted-foreground text-sm'>
                    招待できるユーザーがいません。
                  </p>
                ) : (
                  allUsers.map((user) => (
                    <div
                      key={user.id}
                      className='flex items-center space-x-2 py-1'
                    >
                      <Checkbox
                        id={`user-${user.id}`}
                        checked={selectedParticipantIds.includes(user.id)}
                        onCheckedChange={(checked) =>
                          handleParticipantToggle(user.id, checked as boolean)
                        }
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
                      <Label
                        htmlFor={`user-${user.id}`}
                        className='font-normal'
                      >
                        {user.username}
                      </Label>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant='outline'
              onClick={() => setIsCreatePrivateRoomDialogOpen(false)}
            >
              {' '}
              {/* variant="outline" に変更 */}
              キャンセル
            </Button>
            <Button
              onClick={handleCreatePrivateRoom}
              disabled={
                selectedParticipantIds.length === 0 ||
                !newPrivateRoomName.trim() ||
                currentUser.isGuest
              } // ルーム名入力も必須に
            >
              作成
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

export default ChatSidebar
