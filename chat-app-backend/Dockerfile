# ベースイメージとして Node.js 20 のスリム版を使用
FROM node:20-alpine

# 作業ディレクトリを /app に設定
WORKDIR /app

# OpenSSL 開発パッケージ、libc6-compat、PostgreSQLクライアント、C++標準ライブラリをインストール
# これらはPrismaが内部的に使用するネイティブバイナリの依存関係を解決するために必要です。
RUN apk add --no-cache openssl-dev libc6-compat postgresql-client libstdc++

# ビルドキャッシュを無効化するための引数 (通常はdocker-compose.ymlで指定されますが、手動ビルドの際に役立ちます)
# この行は、ビルド時に指定された値が変更されるたびに、
# このレイヤーとその後のレイヤーのキャッシュを無効化します。
ARG CACHE_BUSTER=

# package.json と package-lock.json (または yarn.lock) をコピー
# npm install を行う前にこれらをコピーすることで、依存関係の変更がない限りキャッシュが利用される
COPY package*.json ./

# 依存関係をインストール
# --omit=dev は本番環境ビルドで開発依存を除外しますが、開発中はそのままです
RUN npm install

# アプリケーションのソースコードをコピー
COPY . .

# TypeScript コードをビルド
RUN npm run build

# アプリケーションがリッスンするポートを公開
EXPOSE 8000

# コンテナ起動時に実行されるデフォルトコマンド (docker-compose.yml で上書きされる可能性が高いです)
CMD ["npm", "start"]
