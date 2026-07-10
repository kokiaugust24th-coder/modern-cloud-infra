# Tasks: modern-cloud-infra

## 1. 仕様の検証

- [ ] 1.1 `openspec validate --change modern-cloud-infra` を実行し、全スペックのフォーマットエラーを解消する
- [ ] 1.2 9 ケーパビリティ間で用語（環境名、AZ、ワークロード、フェーズ等）の一貫性をレビューし、揺れを修正する
- [ ] 1.3 各シナリオがテスト（または運用検証手順）に落とせる粒度かレビューし、曖昧なものを具体化する

## 2. 未決事項の解決

- [x] 2.1 参照実装のクラウドプロバイダを確定し、design.md の Open Questions を更新する（AWS に確定、D1/D7 参照）
- [x] 2.2 GitOps ツール（Argo CD / Flux）と監視バックエンドの選定方針を決定し、design.md に決定として追記する（Argo CD / CloudWatch+ADOT、D7 参照）
- [ ] 2.3 対象リージョンとデータ所在地等のコンプライアンス制約の有無を確認し、必要なら security-baseline / data-persistence スペックへ要件を追加する
- [ ] 2.4 フェーズ移行トリガーの数値基準（PaaS 上限 70%、クレジット枯渇 90 日前 等）を実際のプラン・クレジット条件に合わせて確定する
- [ ] 2.5 AWS Activate 等のスタートアップクレジットの申請要件を確認し、申請時期をフェーズ計画に組み込む

## 3. 仕様の確定と展開

- [ ] 3.1 プロポーザル・デザイン・スペック全体の最終レビューを行い、承認を得る
- [ ] 3.2 delta スペックをメインスペック（openspec/specs/）へ同期する
- [x] 3.3 後続の実装変更をフェーズ順に分割して起票する（フェーズ0: Cloudflare Pages+Supabase セットアップ + workload-portability / cost-management 適用 → フェーズ1: バックエンドの AWS 移行・認証は A 案残留・CI に kind マニフェスト検証を追加 → フェーズ2: EKS フル構成）

## 4. フェーズ0 実装（自動構築、2026-07-11）

- [x] 4.1 アプリ scaffold 作成（`app/`: Vite + React + TypeScript、データアクセス層・認証抽象化層・OTel 計装を分離）— workload-portability 準拠
- [x] 4.2 Supabase スキーマをマイグレーションファイルとして作成（`supabase/migrations/0001_init.sql`、全テーブル RLS 有効化）
- [x] 4.3 Cloudflare Pages 用 Terraform（`infra/terraform/`）を作成。リモート状態は Terraform Cloud 無料枠を利用する設計
- [x] 4.4 CI（lint・typecheck・test・build・コンテナビルド検証・シークレットスキャン・terraform validate）を GitHub Actions で構築（`.github/workflows/ci.yml`）
- [x] 4.5 週次 `pg_dump` → Cloudflare R2 + リストア検証の GitHub Actions を構築（`.github/workflows/backup.yml`）
- [x] 4.6 ローカルで npm install / lint / typecheck / test / build を実行し green を確認。esbuild の中程度脆弱性を検出し Vite 6 / Vitest 3 へ更新して解消（`npm audit` 0 件）
- [x] 4.7 Docker Desktop 起動後に `docker build ./app` でコンテナビルドを実機検証。`docker run` で起動し HTTP 200 応答を確認済み
- [ ] 4.8 アカウント作成・API トークン発行等の手動手順（`docs/phase0-setup.md` 参照）をユーザー自身が実施し、Terraform apply・`supabase db push`・GitHub Secrets 登録を完了する
