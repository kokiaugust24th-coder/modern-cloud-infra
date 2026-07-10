output "pages_project_subdomain" {
  description = "Cloudflare Pages が割り当てるデフォルトサブドメイン"
  value       = cloudflare_pages_project.app.subdomain
}
