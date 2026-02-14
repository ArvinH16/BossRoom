resource "vercel_project" "frontend" {
  name      = "bossroom"
  framework = "nextjs"

  git_repository {
    type = "github"
    repo = var.github_repo
  }

  build_command = "npx nx build game-frontend --configuration=production"
}

resource "vercel_project_environment_variable" "firebase_api_key" {
  project_id = vercel_project.frontend.id
  key        = "NEXT_PUBLIC_FIREBASE_API_KEY"
  value      = data.google_firebase_web_app_config.default.api_key
  target     = ["production", "preview"]
}

resource "vercel_project_environment_variable" "firebase_auth_domain" {
  project_id = vercel_project.frontend.id
  key        = "NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN"
  value      = data.google_firebase_web_app_config.default.auth_domain
  target     = ["production", "preview"]
}

resource "vercel_project_environment_variable" "firebase_project_id" {
  project_id = vercel_project.frontend.id
  key        = "NEXT_PUBLIC_FIREBASE_PROJECT_ID"
  value      = var.project_id
  target     = ["production", "preview"]
}

resource "vercel_project_environment_variable" "firebase_app_id" {
  project_id = vercel_project.frontend.id
  key        = "NEXT_PUBLIC_FIREBASE_APP_ID"
  value      = google_firebase_web_app.default.app_id
  target     = ["production", "preview"]
}

resource "vercel_project_environment_variable" "backend_url" {
  project_id = vercel_project.frontend.id
  key        = "NEXT_PUBLIC_BACKEND_URL"
  value      = google_cloud_run_v2_service.game_server.uri
  target     = ["production", "preview"]
}

resource "vercel_project_environment_variable" "ws_url" {
  project_id = vercel_project.frontend.id
  key        = "NEXT_PUBLIC_WS_URL"
  value      = replace(google_cloud_run_v2_service.game_server.uri, "https://", "wss://")
  target     = ["production", "preview"]
}
