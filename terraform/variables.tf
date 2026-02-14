variable "project_id" {
  description = "GCP project ID"
  type        = string
}

variable "region" {
  description = "GCP region"
  type        = string
  default     = "us-central1"
}

variable "db_password" {
  description = "Cloud SQL database password"
  type        = string
  sensitive   = true
}

variable "google_oauth_client_id" {
  description = "Google OAuth client ID for Firebase Auth"
  type        = string
}

variable "google_oauth_client_secret" {
  description = "Google OAuth client secret for Firebase Auth"
  type        = string
  sensitive   = true
}

variable "vercel_api_token" {
  description = "Vercel API token"
  type        = string
  sensitive   = true
}

variable "github_repo" {
  description = "GitHub repository (owner/repo format)"
  type        = string
}

variable "backend_image" {
  description = "Container image for Cloud Run backend"
  type        = string
  default     = "us-docker.pkg.dev/cloudrun/container/hello"
}
