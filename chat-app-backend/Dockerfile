# ベースイメージとして Node.js 20 のスリム版を使用
FROM node:20-alpine

# 作業ディレクトリを /app に設定
WORKDIR /app

# OpenSSL 開発パッケージ、libc6-compat、PostgreSQLクライアント、C++標準ライブラリをインストール
# これらはPrismaが内部的に使用するネイティブバイナリの依存関係を解決するために必要です。
RUN apk add --no-cache openssl-dev libc6-compat postgresql-client libstdc++

# ビルドキャッシュを無効化するための引数
# この行は、ビルド時に指定された値が変更されるたびに、
# このレイヤーとその後のレイヤーのキャッシュを無効化します。
ARG CACHE_BUSTER=

# package.json と package-lock.json (または yarn.lock) をコピー
# npm install を行う前にこれらをコピーすることで、依存関係の変更がない限りキャッシュが利用される
COPY package*.json ./

# ★ここが変更点: アプリケーションのソースコード全体をnpm install後にコピーします★
# これにより、prisma/schema.prisma が prisma generate 実行時にコンテナ内に存在することを保証します。
COPY . .

# 依存関係をインストール
RUN npm install

# Prisma Clientを生成
# これにより、@prisma/client が実行時に必要なファイルを作成します。
RUN npx prisma generate

# TypeScript コードをビルド
RUN npm run build

# アプリケーションがリッスンするポートを公開
EXPOSE 8000

# コンテナ起動時に実行されるコマンド (docker-compose.yml で上書きされる)
CMD ["npm", "start"]
