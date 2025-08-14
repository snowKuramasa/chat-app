import { PrismaClient } from '@prisma/client'

// 最初の起動時にGeneralルームを作成するヘルパー関数
export async function initializeGeneralRoom(prisma: PrismaClient) {
  try {
    const generalRoom = await prisma.room.findFirst({
      where: { name: 'General', isDM: false, isMemo: false },
    })
    if (!generalRoom) {
      await prisma.room.create({
        data: {
          name: 'General',
          isDM: false,
          isMemo: false,
        },
      })
      console.log('Generalルームが作成されました。')
    }
  } catch (error) {
    console.error('Generalルームの初期化エラー:', error)
  }
}
