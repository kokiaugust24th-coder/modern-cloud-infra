# modern-cloud-infra — フェーズ0 スキャフォールド

[openspec/changes/modern-cloud-infra](openspec/changes/modern-cloud-infra) で定義したモダンな
クラウドインフラ仕様のうち、フェーズ0(無料構成)の実装です。構成の意図・移行計画は
[design.md](openspec/changes/modern-cloud-infra/design.md) を参照してください。

## 構成
- `app/` — Cloudflare Pages にデプロイする Vite + React + TypeScript SPA
- `supabase/` — DB スキーマ(マイグレーション)。Postgres + RLS
- `infra/terraform/` — Cloudflare Pages プロジェクトの IaC
- `.github/workflows/` — CI(品質ゲート)と週次バックアップ

## セットアップ
アカウント作成・API トークン発行などあなたの操作が必要な手順は
[docs/phase0-setup.md](docs/phase0-setup.md) にまとめています。

## ローカル開発
```
cd app
cp .env.example .env   # Supabase の URL/anon key を設定
npm ci
npm run dev
```
