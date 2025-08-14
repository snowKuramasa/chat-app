import { Router, Request, Response } from 'express' // Request は express からインポート
import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'
import { generateToken } from '../utils/jwt'
import { authenticateJWT } from '../middlewares/authMiddleware'
import { UserPayload } from '../types/user' // UserPayload 型をインポート

const prisma = new PrismaClient()
const authRouter = Router()

// ログインエンドポイント
authRouter.post('/login', async (req: Request, res: Response) => {
  const { username, password, isGuest = false } = req.body

  if (!username || username.trim() === '') {
    return res.status(400).json({ message: 'ユーザー名を入力してください。' })
  }

  try {
    let user = await prisma.user.findUnique({ where: { username } })

    if (!user) {
      // 新規ユーザー登録
      if (!isGuest && (!password || password.trim() === '')) {
        return res
          .status(400)
          .json({ message: '通常ログインにはパスワードが必要です。' })
      }
      const passwordHash = password ? await bcrypt.hash(password, 10) : null

      user = await prisma.user.create({
        data: {
          username,
          passwordHash,
          isGuest: isGuest,
        },
      })
      // 新規ユーザーをGeneralルームに参加させる
      const generalRoom = await prisma.room.findFirst({
        where: { name: 'General', isDM: false, isMemo: false },
      })
      if (generalRoom) {
        await prisma.room.update({
          where: { id: generalRoom.id },
          data: {
            users: {
              connect: { id: user.id },
            },
          },
        })
      }
    } else {
      // 既存ユーザーのログイン
      if (user.isGuest && !isGuest) {
        return res.status(400).json({
          message:
            'このゲストユーザー名は既に存在します。通常ログインには別のユーザー名を選択してください。',
        })
      } else if (!user.isGuest && isGuest) {
        return res.status(400).json({
          message: 'このユーザー名は既に通常ユーザーとして登録されています。',
        })
      }

      if (!user.isGuest && user.passwordHash) {
        // 通常ユーザーでパスワードがある場合
        if (!password || !(await bcrypt.compare(password, user.passwordHash))) {
          return res
            .status(401)
            .json({ message: 'ユーザー名またはパスワードが間違っています。' })
        }
      }
      // ゲストユーザーの場合はパスワードチェックなし
    }

    // JWTトークンを生成
    const userPayload: UserPayload = {
      id: user.id,
      username: user.username,
      isGuest: user.isGuest,
      profileImage: user.profileImage,
      bio: user.bio,
    }
    const token = generateToken(userPayload)

    res
      .status(200)
      .json({ message: 'ログインに成功しました。', user: userPayload, token })
  } catch (error: any) {
    console.error('ログインエラー:', error)
    if (error.code === 'P2002' && error.meta?.target?.includes('username')) {
      return res
        .status(409)
        .json({ message: 'このユーザー名は既に使われています。' })
    }
    res.status(500).json({
      message: 'サーバー内部エラーが発生しました。',
      error: error.message,
    })
  }
})

// ログアウトエンドポイント (JWTベースなのでクライアント側でトークンを削除するだけでOKだが、サーバー側でもトークンを無効化する処理を入れる場合はここに追加)
authRouter.post('/logout', authenticateJWT, (req: Request, res: Response) => {
  // AuthenticatedRequest を Request に変更
  // ここでJWTのブラックリスト化を行う場合、Redisなどにトークンを保存して無効化する
  // 例: await redisClient.set(`blacklisted:${req.user.id}:${req.token}`, 'true', 'EX', jwt_expiration_time_in_seconds);
  res.status(200).json({ message: 'ログアウトしました。' })
})

// 認証済みのユーザー情報を取得
authRouter.get('/me', authenticateJWT, (req: Request, res: Response) => {
  // AuthenticatedRequest を Request に変更
  if ((req as any).user) {
    // 型アサーションを追加
    return res.status(200).json((req as any).user) // 型アサーションを追加
  }
  res.status(401).json({ message: '認証されていません。' }) // authenticateJWTで処理されるため、通常ここには到達しない
})

// プロフィール設定更新エンドポイント (初期フェーズではユーザー名のみ)
authRouter.put(
  '/profile',
  authenticateJWT,
  async (req: Request, res: Response) => {
    // AuthenticatedRequest を Request に変更
    const currentUser = (req as any).user // 型アサーションを追加
    if (!currentUser) {
      return res.status(401).json({ message: '認証されていません。' })
    }

    const { username } = req.body // profileImage, bio は初期フェーズでは含めない
    const updateData: { username?: string } = {}

    if (username !== undefined && username.trim() !== '') {
      updateData.username = username
    }

    // 更新するデータがない場合
    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({ message: '更新する情報がありません。' })
    }

    try {
      if (currentUser.isGuest && updateData.username) {
        return res
          .status(403)
          .json({ message: 'ゲストユーザーはユーザー名を変更できません。' })
      }

      const updatedUser = await prisma.user.update({
        where: { id: currentUser.id },
        data: updateData,
        select: {
          id: true,
          username: true,
          isGuest: true,
          profileImage: true,
          bio: true,
        }, // 更新後のユーザー情報を返す
      })

      // 新しいJWTトークンを発行してクライアントに返送する (ユーザー情報が変更されたため)
      const newToken = generateToken(updatedUser)

      res.status(200).json({
        message: 'プロフィールを更新しました。',
        user: updatedUser,
        token: newToken,
      })
    } catch (error: any) {
      console.error('プロフィール更新エラー:', error)
      if (error.code === 'P2002' && error.meta?.target?.includes('username')) {
        return res
          .status(409)
          .json({ message: 'このユーザー名は既に使われています。' })
      }
      res.status(500).json({
        message: 'プロフィールの更新に失敗しました。',
        error: error.message,
      })
    }
  }
)

export default authRouter
