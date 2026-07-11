# Tasks: modern-cloud-infra

## 1. 仕様の検証

- [x] 1.1 `openspec validate --change modern-cloud-infra` を実行し、全スペックのフォーマットエラーを解消する（validate 通過を継続的に確認済み）
- [x] 1.2 9 ケーパビリティ間で用語（環境名、AZ、ワークロード、フェーズ等）の一貫性をレビュー。dev/staging/prod と本番の対応、AZ 表記、MUST/SHALL の使用（SHOULD/MAY 不使用）を確認し、修正が必要な揺れは検出されず
- [x] 1.3 各シナリオがテスト可能な粒度かレビュー。「適切」「十分」等の曖昧な修飾語は検出されず（GitOps 用語「望ましい状態」は技術用語として適正使用）、追加の具体化は不要と判断

## 2. 未決事項の解決

- [x] 2.1 参照実装のクラウドプロバイダを確定し、design.md の Open Questions を更新する（AWS に確定、D1/D7 参照）
- [x] 2.2 GitOps ツール（Argo CD / Flux）と監視バックエンドの選定方針を決定し、design.md に決定として追記する（Argo CD / CloudWatch+ADOT、D7 参照）
- [x] 2.3 対象リージョン・コンプライアンス制約を確認。個人規模プロジェクトのため GDPR/HIPAA 等の業界規制は対象外と暫定判断、リージョンは東京(ap-northeast-1)に確定（design.md Open Questions 参照）
- [x] 2.4 フェーズ移行トリガーの数値基準を実アカウントで確認した無料枠上限（Supabase DB 500MB、MAU 5万、R2 ストレージ10GB/月 等）に更新（design.md D8 参照）
- [x] 2.5 AWS Activate の申請要件を調査。2026年時点で「設立10年以内・企業サイトあり・Pre-Series B」等スタートアップ企業を前提とした要件であり、個人の副業規模プロジェクトはそのままでは典型的な適用対象と言い難い。事業化する場合に再検討する前提で保留

## 3. 仕様の確定と展開

- [x] 3.1 プロポーザル・デザイン・スペック全体の最終レビューを行い、承認を得る（`openspec validate --strict` 通過、ユーザー承認のうえ archive 実施）
- [x] 3.2 delta スペックをメインスペック（openspec/specs/）へ同期する（`openspec archive` により9ケーパビリティ登録完了）
- [x] 3.3 後続の実装変更をフェーズ順に分割して起票する（フェーズ0: Cloudflare Pages+Supabase セットアップ + workload-portability / cost-management 適用 → フェーズ1: バックエンドの AWS 移行・認証は A 案残留・CI に kind マニフェスト検証を追加 → フェーズ2: EKS フル構成）

## 4. フェーズ0 実装（自動構築、2026-07-11）

- [x] 4.1 アプリ scaffold 作成（`app/`: Vite + React + TypeScript、データアクセス層・認証抽象化層・OTel 計装を分離）— workload-portability 準拠
- [x] 4.2 Supabase スキーマをマイグレーションファイルとして作成（`supabase/migrations/0001_init.sql`、全テーブル RLS 有効化）
- [x] 4.3 Cloudflare Pages 用 Terraform（`infra/terraform/`）を作成。リモート状態は Terraform Cloud 無料枠を利用する設計
- [x] 4.4 CI（lint・typecheck・test・build・コンテナビルド検証・シークレットスキャン・terraform validate）を GitHub Actions で構築（`.github/workflows/ci.yml`）
- [x] 4.5 週次 `pg_dump` → Cloudflare R2 + リストア検証の GitHub Actions を構築（`.github/workflows/backup.yml`）
- [x] 4.6 ローカルで npm install / lint / typecheck / test / build を実行し green を確認。esbuild の中程度脆弱性を検出し Vite 6 / Vitest 3 へ更新して解消（`npm audit` 0 件）
- [x] 4.7 Docker Desktop 起動後に `docker build ./app` でコンテナビルドを実機検証。`docker run` で起動し HTTP 200 応答を確認済み
- [x] 4.8a GitHub リポジトリ作成 + push（`gh repo create --public --source=. --push`）。公開先: https://github.com/kokiaugust24th-coder/modern-cloud-infra
- [x] 4.8b Cloudflare アカウントへログイン済み（Koki.august24th@gmail.com、account_id: 3250126a91bc7330b3e2b85f53822f44 を確認）
- [x] 4.8c Cloudflare API トークン発行(Pages:Edit)完了。ユーザー本人が発行し `terraform.tfvars` に設定
- [x] 4.8d Supabase プロジェクト作成を MCP(`mcp__supabase__create_project`)経由で自動化。プロジェクト `modern-cloud-infra-phase0`(ref: zljeygbpnwxmjcgwfjla、リージョン ap-northeast-1、コスト $0/月)を作成。URL・publishable key は `app/.env` に反映済み(公開用キーのため代行設定可)
- [x] 4.8e Cloudflare R2 有効化(ユーザー本人が課金同意) + バケット `modern-cloud-infra-backups` 作成 + APIトークン発行(ユーザー本人)
- [x] 4.8f GitHub Secrets 登録完了(R2_ACCESS_KEY_ID / R2_SECRET_ACCESS_KEY / SUPABASE_DB_URL / R2_BACKUP_BUCKET / R2_ENDPOINT_URL)。CI の push トリガーが `main` のままで発火していなかったバグと `terraform fmt` 崩れを修正し、CI 全ジョブ green を確認
- [x] 4.8i SUPABASE_DB_URL を Session pooler(IPv4対応、ポート5432)の正しい接続文字列で再登録。あわせて pg_dump のサーバー/クライアントバージョン不一致(17 vs 16)を PGDG リポジトリ導入 + PATH 修正で解消し、Weekly DB Backup workflow が全ステップ成功(R2へ278.2KiBのダンプをアップロード、リストア検証も成功)することを確認
- [x] 4.8g `terraform apply` 完了。Cloudflare Pages プロジェクト作成(GitHub App 連携をユーザー本人が承認後、Terraform で作成)。初回デプロイを手動トリガーし HTTP 200 で稼働確認済み。公開URL: https://modern-cloud-infra-phase0.pages.dev
- [x] 4.8h マイグレーション適用を MCP(`mcp__supabase__apply_migration`)経由で自動化。`profiles` テーブル + RLS ポリシー作成済み（`supabase/migrations/0001_init.sql` と同一内容）

## 5. フェーズ0 完了確認

- [x] 5.1 CI(lint/typecheck/test/build/コンテナビルド検証/シークレットスキャン/terraform validate)全ジョブ green
- [x] 5.2 Weekly DB Backup workflow(pg_dump → R2アップロード → リストア検証)全ステップ green
- [x] 5.3 Cloudflare Pages 本番稼働確認(HTTP 200、`https://modern-cloud-infra-phase0.pages.dev`)
- [x] 5.4 Supabase プロジェクト稼働確認(`profiles` テーブル・RLS 適用済み)
- [x] 5.5 デプロイ後の実機確認で「アプリが真っ白」の不具合を検出。Cloudflare Pages のビルド環境に Supabase URL/anon key が渡っておらず初期化エラーになっていたため、Terraform でビルド時環境変数として追加し解消。ブラウザコンソールでエラー消失・正常描画を確認
