terraform {
  required_version = ">= 1.7.0"

  required_providers {
    cloudflare = {
      source  = "cloudflare/cloudflare"
      version = "~> 4.40"
    }
  }

  # フェーズ0のリモート状態管理には Terraform Cloud の無料枠を使う。
  # 組織/ワークスペース作成後、コメントを外して有効化する。
  # (infrastructure-as-code: リモート状態管理 + ロック)
  # backend "remote" {
  #   organization = "<your-tfc-org>"
  #   workspaces {
  #     name = "modern-cloud-infra-phase0"
  #   }
  # }
}

provider "cloudflare" {
  api_token = var.cloudflare_api_token
}
