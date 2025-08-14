import { Router, Request, Response } from 'express'
import { PrismaClient } from '@prisma/client'
import {
  authenticateJWT,
  AuthenticatedRequest,
} from '../middlewares/authMiddleware'

const prisma = new PrismaClient()
const roomRouter = Router()

// ルーム一覧を取得 (認証必須)
roomRouter.get(
  '/rooms',
  authenticateJWT,
  async (req: AuthenticatedRequest, res: Response) => {
    const currentUser = req.user
    if (!currentUser) {
      // authenticateJWTで処理されるため通常は到達しない
      return res.status(401).json({ message: '認証されていません。' })
    }

    try {
      // 1. ユーザーがメンバーとして参加している全てのルームを取得 (公開、DM、メモを含む)
      const roomsUserIsIn = await prisma.room.findMany({
        where: {
          users: {
            some: {
              id: currentUser.id,
            },
          },
        },
        include: {
          users: { select: { id: true, username: true, profileImage: true } },
        },
      })

      // 2. 参加していない全ての公開ルームを取得
      const joinablePublicRooms = await prisma.room.findMany({
        where: {
          isDM: false,
          isMemo: false,
          users: {
            none: {
              // ユーザーがメンバーではないルーム
              id: currentUser.id,
            },
          },
        },
        include: {
          users: { select: { id: true, username: true, profileImage: true } },
        },
      })

      // 両方のリストを結合し、重複を排除
      const combinedRoomsMap = new Map<string, any>()
      roomsUserIsIn.forEach((room) => combinedRoomsMap.set(room.id, room))
      joinablePublicRooms.forEach((room) => combinedRoomsMap.set(room.id, room))

      const allRelevantRooms = Array.from(combinedRoomsMap.values())

      // ルーム名を昇順でソート
      allRelevantRooms.sort((a, b) => a.name.localeCompare(b.name))

      res.status(200).json(allRelevantRooms)
    } catch (error) {
      console.error('ルーム取得エラー:', error)
      res.status(500).json({ message: 'ルームの取得に失敗しました。' })
    }
  }
)

// 新しい公開チャットルームを作成するエンドポイント
roomRouter.post(
  '/rooms/public',
  authenticateJWT,
  async (req: AuthenticatedRequest, res: Response) => {
    const currentUser = req.user
    if (!currentUser) {
      return res.status(401).json({ message: '認証されていません。' })
    }
    const { name } = req.body

    if (!name || name.trim() === '') {
      return res.status(400).json({ message: 'ルーム名を入力してください。' })
    }
    if (currentUser.isGuest) {
      return res
        .status(403)
        .json({
          message: 'ゲストユーザーは公開チャットルームを作成できません。',
        })
    }

    try {
      // 公開ルームの重複チェック (name と isDM:false, isMemo:false の複合ユニーク)
      const existingRoom = await prisma.room.findFirst({
        where: {
          name: name,
          isDM: false,
          ownerId: null, // ownerId は公開ルームでは null
        },
      })
      if (existingRoom) {
        return res
          .status(409)
          .json({ message: 'このルーム名は既に存在します。' })
      }

      const newRoom = await prisma.room.create({
        data: {
          name,
          isDM: false,
          isMemo: false,
          users: {
            connect: { id: currentUser.id }, // 作成者自身を参加者として追加
          },
        },
        include: {
          users: { select: { id: true, username: true, profileImage: true } },
        },
      })
      res
        .status(201)
        .json({
          message: '公開チャットルームが作成されました。',
          room: newRoom,
        })
    } catch (error: any) {
      console.error('公開チャットルーム作成エラー:', error)
      res
        .status(500)
        .json({
          message: '公開チャットルームの作成に失敗しました。',
          error: error.message,
        })
    }
  }
)

// ユーザー一覧を取得 (自分自身とゲストユーザーを除外)
roomRouter.get(
  '/users',
  authenticateJWT,
  async (req: AuthenticatedRequest, res: Response) => {
    const currentUser = req.user
    if (!currentUser) {
      return res.status(401).json({ message: '認証されていません。' })
    }
    try {
      const users = await prisma.user.findMany({
        where: {
          id: { not: currentUser.id }, // 自分自身を除外
          isGuest: false, // ゲストユーザーを除外
        },
        select: { id: true, username: true, profileImage: true },
      })
      res.status(200).json(users)
    } catch (error) {
      console.error('ユーザー取得エラー:', error)
      res.status(500).json({ message: 'ユーザーの取得に失敗しました。' })
    }
  }
)

// 新しいプライベートチャットルームを作成するエンドポイント (複数人対応)
roomRouter.post(
  '/rooms/private',
  authenticateJWT,
  async (req: AuthenticatedRequest, res: Response) => {
    const currentUser = req.user
    if (!currentUser) {
      return res.status(401).json({ message: '認証されていません。' })
    }
    const { name, participantIds } = req.body // ルーム名と参加者IDの配列を受け取る

    if (!name || name.trim() === '') {
      return res.status(400).json({ message: 'ルーム名を入力してください。' })
    }
    if (
      !participantIds ||
      !Array.isArray(participantIds) ||
      participantIds.length === 0
    ) {
      return res
        .status(400)
        .json({ message: '招待するユーザーを選択してください。' })
    }
    if (currentUser.isGuest) {
      return res
        .status(403)
        .json({
          message:
            'ゲストユーザーはプライベートチャットルームを作成できません。',
        })
    }

    // 参加者IDリストに現在のユーザー自身が含まれていないかチェック
    if (participantIds.includes(currentUser.id)) {
      return res
        .status(400)
        .json({
          message: '招待するユーザーリストに自分自身を含めることはできません。',
        })
    }

    // 招待されたユーザー + 現在のユーザー
    const allParticipantIds = [...new Set([...participantIds, currentUser.id])]

    // 招待されたユーザーがすべて存在し、かつゲストではないかを確認
    const invitedUsers = await prisma.user.findMany({
      where: { id: { in: participantIds }, isGuest: false },
      select: { id: true },
    })
    if (invitedUsers.length !== participantIds.length) {
      return res
        .status(400)
        .json({
          message:
            '無効なユーザーIDが含まれているか、ゲストユーザーが招待されています。',
        })
    }

    try {
      // プライベートチャットルーム名も一意性を確保 (isDM:true かつ isMemo:false の中で名前が一意)
      const existingPrivateRoom = await prisma.room.findFirst({
        where: {
          name: name,
          isDM: true,
          isMemo: false, // メモルームではないことを保証
          ownerId: null, // プライベートグループチャットはownerIdを持たない
        },
      })
      if (existingPrivateRoom) {
        return res
          .status(409)
          .json({
            message: 'このプライベートチャットルーム名は既に存在します。',
          })
      }

      // 新しいプライベートチャットルームを作成
      const newRoom = await prisma.room.create({
        data: {
          name: name,
          isDM: true, // プライベートチャットを示す
          isMemo: false,
          users: {
            connect: allParticipantIds.map((id) => ({ id })), // 全ての参加者を接続
          },
        },
        include: {
          users: { select: { id: true, username: true, profileImage: true } },
        },
      })
      res
        .status(201)
        .json({
          message: '新しいプライベートチャットルームを作成しました。',
          room: newRoom,
        })
    } catch (error: any) {
      console.error('プライベートチャットルーム作成エラー:', error)
      res
        .status(500)
        .json({
          message: 'プライベートチャットルームの作成に失敗しました。',
          error: error.message,
        })
    }
  }
)

// 特定のルームのメッセージを取得するエンドポイント
roomRouter.get(
  '/rooms/:roomId/messages',
  authenticateJWT,
  async (req: AuthenticatedRequest, res: Response) => {
    const currentUser = req.user
    const { roomId } = req.params

    if (!currentUser) {
      return res.status(401).json({ message: '認証されていません。' })
    }

    try {
      // ユーザーがそのルームのメンバーであることを確認
      const room = await prisma.room.findFirst({
        where: {
          id: roomId,
          users: {
            some: {
              id: currentUser.id,
            },
          },
        },
      })

      if (!room) {
        return res
          .status(403)
          .json({ message: 'このルームへのアクセス権がありません。' })
      }

      const messages = await prisma.message.findMany({
        where: { roomId },
        include: {
          user: {
            select: {
              id: true,
              username: true,
              profileImage: true,
            },
          },
        },
        orderBy: { createdAt: 'asc' }, // 古い順に取得
      })
      console.log(
        `[Backend REST API] Fetched ${messages.length} messages for room ${roomId}.`
      )
      res.status(200).json(messages)
    } catch (error) {
      console.error(`ルーム ${roomId} のメッセージ取得エラー:`, error)
      res.status(500).json({ message: 'メッセージの取得に失敗しました。' })
    }
  }
)

// 既存のルームにメンバーを追加する新しいエンドポイント
roomRouter.post(
  '/rooms/:roomId/members',
  authenticateJWT,
  async (req: AuthenticatedRequest, res: Response) => {
    const currentUser = req.user
    const { roomId } = req.params
    const { userIds } = req.body // 追加するユーザーIDの配列

    if (!currentUser) {
      return res.status(401).json({ message: '認証されていません。' })
    }
    if (!userIds || !Array.isArray(userIds) || userIds.length === 0) {
      return res
        .status(400)
        .json({ message: '追加するユーザーを選択してください。' })
    }
    if (currentUser.isGuest) {
      return res
        .status(403)
        .json({ message: 'ゲストユーザーはルームにメンバーを追加できません。' })
    }

    try {
      // 現在のユーザーがルームのメンバーであることを確認
      const room = await prisma.room.findFirst({
        where: {
          id: roomId,
          users: {
            some: {
              id: currentUser.id,
            },
          },
        },
        include: { users: true }, // 既存メンバーを取得するため
      })

      if (!room) {
        return res
          .status(403)
          .json({ message: 'このルームへのアクセス権がありません。' })
      }

      if (!room.isDM || room.isMemo) {
        // プライベートグループチャット（isDM:true, isMemo:false）のみメンバー追加可能とする
        return res
          .status(403)
          .json({ message: 'この種類のルームにはメンバーを追加できません。' })
      }

      const existingMemberIds = new Set(room.users.map((u) => u.id))
      const newMemberIds = userIds.filter(
        (id: string) => !existingMemberIds.has(id)
      )

      if (newMemberIds.length === 0) {
        return res
          .status(200)
          .json({ message: '指定されたユーザーは既にルームのメンバーです。' })
      }

      // 新しく追加するユーザーが存在し、ゲストではないことを確認
      const usersToAdd = await prisma.user.findMany({
        where: { id: { in: newMemberIds }, isGuest: false },
        select: { id: true },
      })
      if (usersToAdd.length !== newMemberIds.length) {
        return res
          .status(400)
          .json({
            message:
              '無効なユーザーIDが含まれているか、ゲストユーザーが招待されています。',
          })
      }

      const updatedRoom = await prisma.room.update({
        where: { id: roomId },
        data: {
          users: {
            connect: usersToAdd.map((user) => ({ id: user.id })),
          },
        },
        include: {
          users: { select: { id: true, username: true, profileImage: true } },
        },
      })

      res
        .status(200)
        .json({ message: 'メンバーが追加されました。', room: updatedRoom })
    } catch (error: any) {
      console.error('メンバー追加エラー:', error)
      res
        .status(500)
        .json({
          message: 'メンバーの追加に失敗しました。',
          error: error.message,
        })
    }
  }
)

export default roomRouter
