import { Request, Response, NextFunction } from 'express'
import { verifyToken } from '../utils/jwt'
import { UserPayload } from '../types/user'

// 認証済みリクエストの型定義
export interface AuthenticatedRequest extends Request {
  user?: UserPayload // JWTからデコードされたユーザー情報
}

// JWT認証ミドルウェア
export const authenticateJWT = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const authHeader = req.headers.authorization

  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.split(' ')[1] // "Bearer TOKEN"形式からTOKENを取得

    const decodedUser = verifyToken(token)
    if (decodedUser) {
      // トークンが有効であればユーザー情報をリクエストオブジェクトに追加
      ;(req as AuthenticatedRequest).user = decodedUser
      next()
    } else {
      // トークンが無効または期限切れ
      return res
        .status(401)
        .json({ message: '認証トークンが無効または期限切れです。' })
    }
  } else {
    // トークンが提供されていない
    return res.status(401).json({ message: '認証トークンがありません。' })
  }
}
