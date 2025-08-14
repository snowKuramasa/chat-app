import path from 'path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  // ★追加: デプロイ環境でアクセスを許可するホストを設定★
  server: {
    host: '0.0.0.0', // すべてのネットワークインターフェースでリッスン
    port: 5173, // 開発時のポート
    hmr: {
      host: 'localhost', // HMR (Hot Module Replacement) 用
    },
    // ファイルシステムアクセスを許可するディレクトリ
    fs: {
      strict: false, // プロジェクトルート外のファイルへのアクセスを許可しない (デフォルト: true)
      allow: ['..'], // 親ディレクトリへのアクセスを許可
    },
  },
  preview: {
    host: '0.0.0.0', // すべてのネットワークインターフェースでリッスン
    port: parseInt(process.env.PORT || '4173', 10), // Renderが提供するPORT環境変数を使用
    // ★重要★ Renderのホスト名を許可する
    // process.env.VITE_PREVIEW_HOST は Render の環境変数として設定します。
    // 例: VITE_PREVIEW_HOST=chat-app-frontend-r6ra.onrender.com
    allowedHosts: [
      'localhost',
      '127.0.0.1',
      process.env.VITE_PREVIEW_HOST || '', // Renderのホスト名を環境変数から取得
    ].filter(Boolean), // 空文字列をフィルタリング
  },
})
