## データベースの完全リセットと再初期化の手順:

### 全ての Docker コンテナを停止する:

`C:\works\projects\chat-app\` ディレクトリで:

```
docker compose down
```

### データベースの永続化ボリュームを削除する（重要！）:

`C:\works\projects\chat-app\` ディレクトリで:

```
docker volume rm chat-app_db_data
```

### Docker コンテナを再起動する:

`C:\works\projects\chat-app\` ディレクトリで:

```
docker compose up -d
```

### バックエンドの依存関係を再インストール（念のため）:

`C:\works\projects\chat-app\chat-app-backend`
ディレクトリで:

```
rmdir /s /q node_modules //node_modules ディレクトリを削除

del package-lock.json // package-lock.json ファイルを削除

npm install // 依存関係を再インストール
```

### Prisma のマイグレーションを実行:

`C:\works\projects\chat-app\chat-app-backend` ディレクトリで:

```
npx prisma migrate dev --name init （プロンプトが出たら y を入力）
```

### Prisma Client を生成:

`C:\works\projects\chat-app\chat-app-backend` ディレクトリで:

```
npx prisma generate
```
