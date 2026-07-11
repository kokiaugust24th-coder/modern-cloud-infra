variable "cloudflare_api_token" {
  description = "Cloudflare API トークン (Pages:Edit 権限)"
  type        = string
  sensitive   = true
}

variable "cloudflare_account_id" {
  description = "Cloudflare アカウント ID"
  type        = string
}

variable "project_name" {
  description = "Cloudflare Pages プロジェクト名"
  type        = string
  default     = "modern-cloud-infra-phase0"
}

variable "github_owner" {
  description = "GitHub リポジトリのオーナー名"
  type        = string
}

variable "github_repo_name" {
  description = "GitHub リポジトリ名"
  type        = string
}

variable "production_branch" {
  description = "本番デプロイ対象ブランチ"
  type        = string
  default     = "main"
}

variable "supabase_url" {
  description = "Supabase プロジェクトの URL(公開情報)"
  type        = string
}

variable "supabase_anon_key" {
  description = "Supabase の publishable/anon key(公開埋め込み前提の値。秘密情報ではない)"
  type        = string
}
