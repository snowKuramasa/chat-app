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

# アプリケーションがリッスンするポートを公開
EXPOSE 5173

# コンテナ起動時に実行されるデフォルトコマンド (docker-compose.yml で上書きされる可能性が高いです)
CMD ["npm", "run", "dev"]
