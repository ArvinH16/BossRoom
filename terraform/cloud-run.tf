resource "google_cloud_run_v2_service" "game_server" {
  name                = "bossroom-game-server"
  location            = var.region
  deletion_protection = false
  ingress             = "INGRESS_TRAFFIC_ALL"

  template {
    timeout = "3600s"
    session_affinity = true

    containers {
      image = var.backend_image

      ports {
        name           = "http1"
        container_port = 8080
      }

      env {
        name  = "DB_HOST"
        value = "/cloudsql/${google_sql_database_instance.main.connection_name}"
      }

      env {
        name  = "DB_NAME"
        value = google_sql_database.bossroom.name
      }

      env {
        name  = "DB_USER"
        value = google_sql_user.bossroom.name
      }

      env {
        name  = "DB_PASS"
        value = var.db_password
      }
    }

    volumes {
      name = "cloudsql"
      cloud_sql_instance {
        instances = [google_sql_database_instance.main.connection_name]
      }
    }
  }

  depends_on = [google_project_service.apis]
}

resource "google_cloud_run_v2_service_iam_member" "public" {
  project  = var.project_id
  location = var.region
  name     = google_cloud_run_v2_service.game_server.name
  role     = "roles/run.invoker"
  member   = "allUsers"
}
