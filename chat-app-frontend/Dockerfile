# ベースイメージとして Node.js 20 のスリム版を使用
FROM node:20-alpine

# 作業ディレクトリを /app に設定
WORKDIR /app

# package.json と package-lock.json (または yarn.lock) をコピー
COPY package*.json ./

# 依存関係をインストール
RUN npm install

# アプリケーションのソースコードをコピー
COPY . .

# アプリケーションのビルド (本番デプロイ用)
RUN npm run build

# アプリケーションがリッスンするポートを公開 (Renderのデフォルトは8080ですが、環境変数PORTが使用されます)
EXPOSE 5173

# コンテナ起動時に実行されるコマンドを 'npm run preview' に変更
# Renderは自動的にPORT環境変数を注入し、Viteがそれを活用するように設定
CMD ["npm", "run", "preview"]
