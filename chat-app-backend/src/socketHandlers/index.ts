import { Server as SocketIOServer, Socket } from 'socket.io'
import { PrismaClient } from '@prisma/client'
import { UserPayload } from '../types/user' // UserPayloadをインポート

// io.on('connection') のソケットの型を拡張
// JWT認証ミドルウェア (src/index.ts) で socket.user に設定された情報を受け取る
interface CustomSocket extends Socket {
  user?: UserPayload // JWT認証ミドルウェアから設定されたユーザー情報
}

// Socket.IOイベントを初期化する関数
// `io` と `prisma` インスタンスを引数で受け取る
export const initializeSocketHandlers = (
  io: SocketIOServer,
  prisma: PrismaClient
) => {
  io.on('connection', async (socket: CustomSocket) => {
    const user = socket.user // ★ socket.user からユーザー情報を取得 ★

    if (!user) {
      console.log(
        'Socket disconnected (in socketHandlers/index.ts): No user payload found after JWT auth.'
      )
      return socket.disconnect()
    }

    console.log(
      `[Backend Socket] User connected: ${user.username} (${user.id}). Socket ID: ${socket.id}`
    )

    socket.join(user.id) // ユーザー固有のルームに参加 (自身のオンライン状態管理用)

    // 初期設定: 'General' ルームが存在しない場合作成し、現在のユーザーを参加させる
    // (この部分は initializeGeneralRoom() と重複するが、Socket接続時にユーザーを確実に追加するため残す)
    const generalRoom = await prisma.room.findFirst({
      where: { name: 'General', isDM: false, isMemo: false },
    })

    if (!generalRoom) {
      const newGeneralRoom = await prisma.room.create({
        data: {
          name: 'General',
          isDM: false,
          isMemo: false,
          users: {
            connect: { id: user.id },
          },
        },
      })
      socket.join(newGeneralRoom.id)
      console.log(
        '[Backend Socket] General room created and user joined (Socket.IO & DB).'
      )
    } else {
      const isUserInGeneral = await prisma.room.findFirst({
        where: {
          id: generalRoom.id,
          users: { some: { id: user.id } },
        },
      })
      if (!isUserInGeneral) {
        await prisma.room.update({
          where: { id: generalRoom.id },
          data: { users: { connect: { id: user.id } } },
        })
        console.log(
          `[Backend Socket] User ${user.username} joined existing General room in DB.`
        )
      }
      socket.join(generalRoom.id)
      console.log(
        `[Backend Socket] User ${user.username} joined existing General room in Socket.IO.`
      )
    }

    // ルームに参加するイベント
    socket.on('join_room', async (roomId: string) => {
      console.log(
        `[Backend Socket] Received 'join_room' event for roomId: ${roomId} from user: ${user.username}. Socket ID: ${socket.id}`
      )
      const room = await prisma.room.findUnique({ where: { id: roomId } })
      if (room) {
        // Socket.IOのルームにまだ参加していない場合のみ参加させる
        if (!socket.rooms.has(roomId)) {
          socket.join(roomId)
          console.log(
            `[Backend Socket] Socket ${socket.id} joined Socket.IO room: ${roomId}`
          )
        } else {
          console.log(
            `[Backend Socket] Socket ${socket.id} already in Socket.IO room: ${roomId}. Skipping join.`
          )
        }

        // DB上のユーザーとルームの関連付けを更新 (まだ関連がない場合)
        const isUserInRoom = await prisma.room.findFirst({
          where: { id: roomId, users: { some: { id: user.id } } },
        })
        if (!isUserInRoom) {
          await prisma.room.update({
            where: { id: roomId },
            data: { users: { connect: { id: user.id } } },
          })
          console.log(
            `[Backend Socket] User ${user.username} joined DB room ${room.name} (${room.id}).`
          )
        } else {
          console.log(
            `[Backend Socket] User ${user.username} already in DB room ${room.name} (${room.id}).`
          )
        }

        // そのルームの過去メッセージを取得して送信
        const messages = await prisma.message.findMany({
          where: { roomId },
          include: {
            user: { select: { id: true, username: true, profileImage: true } },
          },
          orderBy: { createdAt: 'asc' }, // 古い順に取得
        })
        console.log(
          `[Backend Socket] Emitting 'room_messages' to socket ${socket.id} for room ${roomId} with ${messages.length} messages.`
        )
      } else {
        console.warn(
          `[Backend Socket] Room ${roomId} not found for 'join_room' event from user ${user.username}.`
        )
        socket.emit('error', { message: 'ルームが見つかりません。' })
      }
    })

    // メッセージ送信イベント
    socket.on(
      'send_message',
      async ({ roomId, content }: { roomId: string; content: string }) => {
        console.log(
          `[Backend Socket] Received 'send_message' for room ${roomId} from user ${user.username}.`
        )
        if (!content || content.trim() === '') {
          return socket.emit('error', {
            message: 'メッセージ内容は空にできません。',
          })
        }

        try {
          const message = await prisma.message.create({
            data: {
              userId: user.id,
              roomId,
              content,
            },
            include: {
              user: {
                select: { id: true, username: true, profileImage: true },
              },
            },
          })

          console.log(
            `[Backend Socket] Emitting 'new_message' to room ${roomId}: "${message.content.substring(
              0,
              20
            )}..."`
          )
          io.to(roomId).emit('new_message', message)
        } catch (error) {
          console.error(
            `[Backend Socket] Message send error for room ${roomId}, user ${user.username}:`,
            error
          )
          socket.emit('error', { message: 'メッセージの送信に失敗しました。' })
        }
      }
    )

    // 自分一人だけのルームを作成・参加（メモルーム）
    socket.on('create_or_join_memo_room', async () => {
      console.log(
        `[Backend Socket] Received 'create_or_join_memo_room' from user: ${user.username}.`
      )
      try {
        let memoRoom = await prisma.room.findFirst({
          where: {
            isMemo: true,
            ownerId: user.id,
          },
        })

        if (!memoRoom) {
          memoRoom = await prisma.room.create({
            data: {
              name: `${user.username}のメモ`,
              isMemo: true,
              isDM: false, // メモルームはDMではない
              owner: { connect: { id: user.id } }, // 所有者をユーザー自身に設定
              users: { connect: { id: user.id } }, // 作成者自身を参加者として追加
            },
            include: {
              users: {
                select: { id: true, username: true, profileImage: true },
              },
            },
          })
          console.log(
            `[Backend Socket] Memo room created: ${memoRoom.name} (${memoRoom.id}).`
          )
        } else {
          memoRoom = await prisma.room.findUnique({
            where: { id: memoRoom.id },
            include: {
              users: {
                select: { id: true, username: true, profileImage: true },
              },
            },
          })
          console.log(
            `[Backend Socket] Existing memo room retrieved: ${memoRoom?.name} (${memoRoom?.id}).`
          )
        }

        // メモルームのユーザーリストに自分が入っているか確認・追加
        const isUserInMemoRoom = await prisma.room.findFirst({
          where: { id: memoRoom?.id, users: { some: { id: user.id } } },
        })
        if (!isUserInMemoRoom) {
          await prisma.room.update({
            where: { id: memoRoom?.id },
            data: { users: { connect: { id: user.id } } },
          })
          console.log(
            `[Backend Socket] User ${user.username} added to memo room ${memoRoom?.name} in DB.`
          )
        }

        console.log(
          `[Backend Socket] Emitting 'memo_room_info' and 'join_room' for memo room ${memoRoom?.name}.`
        )
        socket.emit('memo_room_info', memoRoom)
        socket.emit('join_room', memoRoom?.id) // メモルームの過去メッセージをリクエスト
      } catch (error) {
        console.error('[Backend Socket] Memo room create/get error:', error)
        socket.emit('error', {
          message: 'メモルームの作成または取得に失敗しました。',
        })
      }
    })

    socket.on('disconnect', (reason) => {
      console.log(
        `[Backend Socket] User disconnected: ${user.username} (${user.id}). Socket ID: ${socket.id}. Reason: ${reason}`
      )
    })
  })
}
