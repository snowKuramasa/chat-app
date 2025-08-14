import jwt from 'jsonwebtoken'
import { UserPayload } from '../types/user' // 定義したUserPayloadをインポート

const JWT_SECRET = process.env.JWT_SECRET || 'fallback_jwt_secret'
const JWT_EXPIRES_IN = '1d' // トークンの有効期限: 1日

// JWTを生成する関数
export const generateToken = (user: UserPayload): string => {
  // JWTのペイロードには機密情報を含めないが、ユーザーの基本情報を保持
  const payload: UserPayload = {
    id: user.id,
    username: user.username,
    isGuest: user.isGuest,
    profileImage: user.profileImage || null,
    bio: user.bio || null,
  }
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN })
}

// JWTを検証する関数
export const verifyToken = (token: string): UserPayload | null => {
  try {
    return jwt.verify(token, JWT_SECRET) as UserPayload
  } catch (error) {
    console.error('JWT検証エラー:', error)
    return null // 検証失敗
  }
}
