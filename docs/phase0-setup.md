# フェーズ0 環境構築ガイド(要手動対応)

このリポジトリは [openspec/changes/modern-cloud-infra](../openspec/changes/modern-cloud-infra) の仕様に基づく
フェーズ0(無料構成)のスキャフォールドです。コード・IaC・CI はここに揃っていますが、以下は
アカウント作成や API トークン発行を伴うため、あなた自身の操作が必要です。

## 1. Supabase プロジェクト作成
1. https://supabase.com で無料プロジェクトを作成
2. プロジェクトの Settings > API から `Project URL` と `anon public key` を取得
3. Settings > Database から接続文字列(`SUPABASE_DB_URL`)を取得
4. ローカルで Supabase CLI をインストールし、以下を実行:
   ```
   supabase link --project-ref <ref>
   supabase db push
   ```
   `supabase/migrations/0001_init.sql` が適用され、`profiles` テーブルと RLS ポリシーが作成される

## 2. Cloudflare アカウント作成
1. https://dash.cloudflare.com でアカウント作成
2. My Profile > API Tokens で `Cloudflare Pages:Edit` 権限のトークンを発行
3. アカウント ID を控える(ダッシュボード右下)

## 3. Cloudflare R2(バックアップ保管先)
1. Cloudflare ダッシュボード > R2 でバケットを作成(無料枠 10GB)
2. R2 の API トークン(アクセスキー/シークレットキー)を発行

## 4. GitHub リポジトリの Secrets 設定
Settings > Secrets and variables > Actions に以下を登録する:

| Secret | 用途 |
|---|---|
| `SUPABASE_DB_URL` | 週次バックアップ(pg_dump) |
| `R2_ACCESS_KEY_ID` / `R2_SECRET_ACCESS_KEY` | R2 へのバックアップアップロード |
| `R2_ENDPOINT_URL` / `R2_BACKUP_BUCKET` | R2 接続先 |
| `CLOUDFLARE_API_TOKEN` / `CLOUDFLARE_ACCOUNT_ID` | Terraform 実行(ローカルまたは別ワークフロー) |

`app/.env.example` を `app/.env` にコピーし、Supabase の URL / anon key を設定するとローカル開発が可能。

## 5. Terraform の適用(初回のみ、ローカル実行)
```
cd infra/terraform
cp terraform.tfvars.example terraform.tfvars   # 値を埋める
terraform init
terraform plan
terraform apply
```
Cloudflare Pages プロジェクトが作成され、GitHub リポジトリと連携した自動デプロイが有効になる。

## 6. 監視(Grafana Cloud 無料プラン)
1. https://grafana.com/products/cloud/ で無料アカウント作成
2. OTLP エンドポイントと認証情報を取得
3. `app/src/lib/telemetry.ts` は OpenTelemetry API のみを使う最小構成(ノーオペトレーサー)。
   実際に送信するには `@opentelemetry/exporter-trace-otlp-http` 等を追加し、
   取得したエンドポイントをエクスポータに設定する

## 完了確認チェックリスト
- [ ] Supabase プロジェクト作成 + マイグレーション適用済み(`supabase db push` 成功)
- [ ] Cloudflare Pages プロジェクトが Terraform 経由で作成され、push で自動デプロイされる
- [ ] GitHub Actions の CI(lint/typecheck/test/build/container-build/secret-scan/terraform-check)が全て green
- [ ] 週次バックアップ workflow が最低 1 回成功している(`workflow_dispatch` で手動実行して確認)
- [ ] Grafana Cloud 無料プランに接続済み、またはフェーズ0では未接続のまま先送りと判断済み
