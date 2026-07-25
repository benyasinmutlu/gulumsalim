package handlers

import (
	"context"
	"encoding/json"
	"net/http"
	"time"

	"github.com/gulumsalim/discovery/internal/store"
)

// Healthz, systemd/deploy script'lerinin servisin ayakta olduğunu
// doğrulaması için kullanılır. Bilinçli olarak liveness'tır: bağımlılıklardan
// bağımsız her zaman "ok" döner ki geçici bir Postgres/Redis kesintisi
// systemd restart döngüsü tetiklemesin. Bağımlılık kontrolü /readyz'de.
func Healthz(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{"status": "ok"})
}

// Readyz, servisin trafiğe hazır olup olmadığını bağımlılıkları (Postgres,
// Redis) ping'leyerek doğrular. Biri düşükse 503 döner — böylece kırık bir
// servise trafik yönlendirilmez (CLAUDE-023).
func Readyz(rs *store.RedisStore, pg *store.PostgresStore) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		ctx, cancel := context.WithTimeout(r.Context(), 2*time.Second)
		defer cancel()

		w.Header().Set("Content-Type", "application/json")
		if err := pg.Pool.Ping(ctx); err != nil {
			w.WriteHeader(http.StatusServiceUnavailable)
			json.NewEncoder(w).Encode(map[string]string{"status": "postgres unavailable"})
			return
		}
		if err := rs.Client.Ping(ctx).Err(); err != nil {
			w.WriteHeader(http.StatusServiceUnavailable)
			json.NewEncoder(w).Encode(map[string]string{"status": "redis unavailable"})
			return
		}
		json.NewEncoder(w).Encode(map[string]string{"status": "ready"})
	}
}
