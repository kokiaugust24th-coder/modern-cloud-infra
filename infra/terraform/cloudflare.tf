# Cloudflare Pages プロジェクト。GitHub 連携により push で自動デプロイされる(GitOps 的なプル型に近い挙動)。
# Supabase 側のスキーマは Terraform でなく supabase/migrations 配下のマイグレーションファイルで
# 管理する(supabase db push)。プロジェクト自体の作成は一度だけの手動/CLI 操作となる
# (docs/phase0-setup.md 参照)。
resource "cloudflare_pages_project" "app" {
  account_id        = var.cloudflare_account_id
  name              = var.project_name
  production_branch = var.production_branch

  source {
    type = "github"
    config {
      owner                         = var.github_owner
      repo_name                     = var.github_repo_name
      production_branch             = var.production_branch
      pr_comments_enabled           = true
      deployments_enabled           = true
      production_deployment_enabled = true
    }
  }

  build_config {
    build_command   = "npm run build"
    destination_dir = "dist"
    root_dir        = "app"
  }

  # Supabase の URL / publishable key はフロントエンドに埋め込まれる公開用の値であり
  # 秘密情報ではない(データ保護は RLS が担う)。ビルド時環境変数として設定する。
  deployment_configs {
    production {
      environment_variables = {
        VITE_SUPABASE_URL      = var.supabase_url
        VITE_SUPABASE_ANON_KEY = var.supabase_anon_key
      }
    }
    preview {
      environment_variables = {
        VITE_SUPABASE_URL      = var.supabase_url
        VITE_SUPABASE_ANON_KEY = var.supabase_anon_key
      }
    }
  }
}
