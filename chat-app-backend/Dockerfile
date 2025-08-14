 # ベースイメージとして Node.js 20 のスリム版を使用
 FROM node:20-alpine
 # 作業ディレクトリを /app に設定
 WORKDIR /app
 # OpenSSL 開発パッケージ、libc6-compat、PostgreSQLクライアント、C++標準ライブラリをインストール
 RUN apk add --no-cache openssl-dev libc6-compat postgresql-client libstdc++
 # package.json と package-lock.json (または yarn.lock) をコピー
 COPY package*.json ./
 # NODE_ENVを一時的にdevelopmentに設定して、devDependenciesもインストールされるようにする
 ENV NODE_ENV=development
 RUN npm install
 # アプリケーションのソースコードをコピー
 COPY . .
 # TypeScript コードをビルド
 RUN npm run build
 # NODE_ENV を production に戻す
 ENV NODE_ENV=production
 # アプリケーションがリッスンするポートを公開
 EXPOSE 8000
 # コンテナ起動時に実行されるコマンド (docker-compose.yml で上書きされる)
 CMD ["npm", "start"]