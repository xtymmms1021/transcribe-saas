# transcribe-saas

日本語中心の音声文字起こしWebツール（OpenAI優先、Gemini拡張可能）

## Stack
- Next.js (web)
- Node worker (provider abstraction)
- PostgreSQL + pgvector
- Redis
- MinIO (S3 compatible)
- Docker Compose

## Quick start
```bash
cp .env.example .env
# OPENAI_API_KEY を設定

docker compose up -d db redis minio minio-init
# optional: full stack
# docker compose up --build
```

Web: http://localhost:3000  
MinIO Console: http://localhost:9001

## Provider strategy
- 現在: `TRANSCRIPTION_PROVIDER=openai`
- 将来: `gemini` 実装追加で切り替え可能

## Next TODO
- Auth + optional MFA
- Upload API + signed URL
- Queue integration
- Transcript persistence schema + RLS
- Speaker profile & auto-labeling pipeline
