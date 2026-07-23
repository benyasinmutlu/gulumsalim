package handlers

import (
	"encoding/json"
	"net/http"
)

// Healthz, systemd/deploy script'lerinin servisin ayakta olduğunu
// doğrulaması için kullanılır. Faz 0'da Postgres/Redis bağlantı
// kontrolleri de buraya eklenecek (bkz. apps/api'deki /healthz deseni).
func Healthz(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{"status": "ok"})
}
