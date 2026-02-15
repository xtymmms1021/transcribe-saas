# transcribe-saas

日本語中心の音声文字起こしWebツール（OpenAI先行、Gemini拡張対応）

## 実装済み
- ユーザー登録 / ログイン
- 任意MFA（TOTP）セットアップ + 有効化API
- ユーザーごとのプロジェクト分離
- 音声アップロード（署名付きURL）
- Redisキュー投入
- WorkerによるOpenAI文字起こし
- 文字起こし/セグメント保存
- 話者ラベル保存（speaker profile）
- データは全て user_id 紐づけで分離

## 注意
- **文字起こし実行には `OPENAI_API_KEY` が必須**
- 現在のOpenAI実装では話者分離は `SPEAKER_00` 固定（将来、Diarization providerを追加して強化）
- Provider抽象化済みのため Gemini 実装を追加可能

## 起動
```bash
cp .env.example .env
# .env に OPENAI_API_KEY を設定

sudo docker compose up -d --build
```

Web: <http://localhost:3000>  
MinIO Console: <http://localhost:9001>

## 主要API
- `POST /api/auth/register`
- `POST /api/auth/login`
- `POST /api/auth/mfa/setup`
- `POST /api/auth/mfa/enable`
- `GET/POST /api/projects`
- `POST /api/audio/upload-url`
- `POST /api/audio/enqueue/:id`
- `GET /api/transcripts/:id`
- `POST /api/transcripts/:id/label`
- `GET /api/speakers`

