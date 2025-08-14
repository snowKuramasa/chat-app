# ベースイメージとして Node.js 20 のスリム版を使用
FROM node:20-alpine

# 作業ディレクトリを /app に設定
WORKDIR /app

# OpenSSL 開発パッケージ、libc6-compat、PostgreSQLクライアント、C++標準ライブラリをインストール
# これらはPrismaが内部的に使用するネイティブバイナリの依存関係を解決するために必要です。
RUN apk add --no-cache openssl-dev libc6-compat postgresql-client libstdc++

# ビルドキャッシュを無効化するための引数 (通常は変更不要)
ARG CACHE_BUSTER=

# package.json と package-lock.json をコピー
# npm install を行う前にこれらをコピーすることで、依存関係の変更がない限りキャッシュが利用される
COPY package*.json ./

# ★ここが重要★ 開発環境の依存関係もインストールするために NODE_ENV を development に設定
# その後、npm ci を実行して package-lock.json に厳密に従い、すべての依存関係をインストール
ENV NODE_ENV=development
RUN npm ci

# アプリケーションのソースコードをコピー
COPY . .

# TypeScript コードをビルド
RUN npm run build

# 最終的な実行環境のために NODE_ENV を production に戻す
ENV NODE_ENV=production

# アプリケーションがリッスンするポートを公開
EXPOSE 8000

# コンテナ起動時に実行されるコマンド (docker-compose.yml で上書きされるが、Renderの起動コマンドと合わせる)
CMD ["npm", "start"]
