# transcribe-saas

日本語中心の音声文字起こしWebツール（OpenAI先行、Gemini拡張対応）

## 実装済み
- ユーザー登録 / ログイン
- 任意MFA（TOTP）セットアップ + 有効化API
- ユーザーごとのプロジェクト分離
- 音声アップロード（署名付きURL）
- Redisキュー投入
- Workerによる文字起こし（OpenAI / Gemini provider切替）
- 文字起こし/セグメント保存
- 話者ラベル保存（speaker profile）
- 自動同定の基盤（マッチ履歴、再同定API、埋め込み学習テーブル）
- エクスポート（txt/srt/json）

## 重要（現状の精度設計）
- **OPENAIだけでは話者埋め込みを直接取得しにくい**ため、
  現在は「自動同定の土台」は実装済みだが、埋め込み供給を別providerで強化する前提。
- そのため、現時点では話者分離精度は限定的（多くが `SPEAKER_00` になる）。
- 次段でDiarization/Voiceprint provider（外部API）を追加すると、継続同定精度を大幅に上げられる。

## 起動
```bash
cp .env.example .env
# .env に OPENAI_API_KEY を設定（Geminiを使うなら GEMINI_API_KEY も）

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
- `GET /api/audio/:id`
- `GET /api/transcripts/:id`
- `GET /api/transcripts/:id/matches`
- `POST /api/transcripts/:id/label`
- `POST /api/transcripts/:id/auto-identify`
- `GET /api/transcripts/:id/export?format=txt|srt|json`
- `GET /api/speakers`

## env（抜粋）
- `TRANSCRIPTION_PROVIDER=openai|gemini`
- `OPENAI_API_KEY=...`
- `OPENAI_TRANSCRIBE_MODEL=gpt-4o-mini-transcribe`
- `GEMINI_API_KEY=...`
- `GEMINI_TRANSCRIBE_MODEL=gemini-2.0-flash`
- `SPEAKER_AUTO_THRESHOLD=0.78`
- `SPEAKER_SUGGEST_THRESHOLD=0.70`


### Google STT話者分離を使う場合
1. Google Cloud Speech-to-Text APIを有効化
2. サービスアカウントJSONを配置（例: `./secrets/gcp-stt.json`）
3. `.env` に以下を設定

```env
DIARIZATION_PROVIDER=google
GOOGLE_APPLICATION_CREDENTIALS=/app/secrets/gcp-stt.json
GOOGLE_STT_LANGUAGE=ja-JP
GOOGLE_STT_SPEAKER_COUNT=2
GOOGLE_STT_MODEL=latest_long
GOOGLE_STT_ENCODING=MP3
GOOGLE_STT_SAMPLE_RATE=16000
```

> 注意: Google diarizationは speakerTag を返します。現在は speakerTag から疑似埋め込みを生成して継続同定に接続しています。
