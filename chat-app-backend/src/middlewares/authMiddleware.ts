import { Request, Response, NextFunction } from 'express'
import { verifyToken } from '../utils/jwt'
import { UserPayload } from '../types/user' // UserPayloadをインポート

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
      // req.user は src/types/express.d.ts で拡張されているため、安全に代入できます。
      // ただし、型チェッカーが厳しいため、UserPayload に型アサーションします。
      ;(req as any).user = decodedUser // 汎用的な Request 型に user プロパティを追加
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
