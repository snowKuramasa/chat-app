// .envファイルを読み込む
import 'dotenv/config'

import express from 'express'
import { createServer } from 'http'
import { Server as SocketIOServer } from 'socket.io'
import { createClient } from 'redis'
import { createAdapter } from '@socket.io/redis-adapter'
import { PrismaClient } from '@prisma/client'
import cors from 'cors'

// 作成したルーティングとユーティリティをインポート
import authRouter from './routes/authRoutes'
import roomRouter from './routes/roomRoutes'
import { initializeGeneralRoom } from './utils/initializers'
import { initializeSocketHandlers } from './socketHandlers' // CustomSocket は socketHandlers.ts で定義されるためここでのインポートは不要
import { UserPayload } from './types/user' // UserPayload 型をインポート
import { verifyToken } from './utils/jwt' // JWT検証関数をインポート
import { authenticateJWT } from './middlewares/authMiddleware' // ExpressのJWT認証ミドルウェア

// Prismaクライアントの初期化
const prisma = new PrismaClient()

const app = express()
const httpServer = createServer(app)

// CORS設定
app.use(
  cors({
    origin: [
      'http://localhost:5173',
      'http://127.0.0.1:5173',
      'https://chat-app-frontend-r6ra.onrender.com',
    ], // フロントエンドのVite開発サーバーのURLを許可
    credentials: true, // クッキー、Authorizationヘッダーを許可 (JWTでは必須ではないが、将来的な拡張のために残す)
  })
)

// リクエストボディをJSONとしてパース
app.use(express.json())

// Redisクライアントのセットアップ
const pubClient = createClient({ url: process.env.REDIS_URL })
const subClient = pubClient.duplicate()

// Redisクライアントの接続を待機
Promise.all([pubClient.connect(), subClient.connect()])
  .then(() => {
    console.log('Redis clients connected.')

    // Socket.IOのセットアップ
    const io = new SocketIOServer(httpServer, {
      cors: {
        origin: ['http://localhost:5173', 'http://127.0.0.1:5173'], // フロントエンドのVite開発サーバーのURLを許可
        credentials: true,
      },
      adapter: createAdapter(pubClient, subClient), // Redisアダプターを適用
    })

    // Socket.IOの接続認証ミドルウェア (JWTトークンを検証)
    io.use(async (socket, next) => {
      const token = socket.handshake.auth.token // クライアントから送信されたJWTトークン
      if (!token) {
        console.log('Socket connection rejected (io.use): No token provided.')
        return next(new Error('Authentication error: Token not provided.'))
      }

      const decodedUser = verifyToken(token) // JWTを直接検証
      if (decodedUser) {
        // デコードされたユーザー情報を socket オブジェクトに格納
        // socketの型定義を拡張する必要があるが、ここでは一時的にanyを使用（後ほどCustomSocketで対応）
        ;(socket as any).user = decodedUser
        console.log(
          `Socket JWT authentication successful (io.use) for user: ${decodedUser.username} (${decodedUser.id})`
        )
        next() // 認証成功、次のミドルウェアへ
      } else {
        console.error(
          'Socket JWT authentication failed (io.use): Invalid or expired token.'
        )
        return next(
          new Error('Authentication error: Invalid or expired token.')
        )
      }
    })

    // --- ルーティング（REST API）の適用 ---
    // ExpressのauthenticateJWTミドルウェアはExpressのRequest/Responseを期待するため、ここでのみ使用
    app.use('/api', authRouter) // /api/login, /api/logout, /api/me, /api/profile
    app.use('/api', roomRouter) // /api/rooms, /api/users

    // --- Socket.IOイベントハンドリングの初期化 ---
    // ここでioインスタンスとprismaインスタンスを渡す
    initializeSocketHandlers(io, prisma)

    // サーバー起動
    const PORT = process.env.PORT || 8000
    httpServer.listen(PORT, () => {
      console.log(
        `バックエンドサーバーが http://localhost:${PORT} で起動しました`
      )
    })

    // 最初の起動時にGeneralルームを作成
    initializeGeneralRoom(prisma)
  })
  .catch((err) => {
    console.error('Redisへの接続に失敗しました:', err)
    process.exit(1) // Redis接続失敗時はアプリケーションを終了
  })
