package api

import (
	"crypto/subtle"
	"net/http"

	"github.com/gulumsalim/discovery/internal/api/handlers"
	"github.com/gulumsalim/discovery/internal/config"
	"github.com/gulumsalim/discovery/internal/store"
)

// NewRouter, bu servisin tüm dış yüzeyini kurar. Kasıtlı olarak küçük:
// /healthz (liveness), /readyz (bağımlılık readiness) ve /discover var. Bu
// servis 127.0.0.1'e bağlı kalır (nginx/firewalld dışarıya hiç yönlendirmez)
// — yine de her /discover isteğinde paylaşımlı gizli anahtar kontrolü yapılır,
// ek bir savunma katmanı olarak.
func NewRouter(cfg *config.Config, rs *store.RedisStore, pg *store.PostgresStore) http.Handler {
	mux := http.NewServeMux()

	mux.HandleFunc("GET /healthz", handlers.Healthz)
	mux.HandleFunc("GET /readyz", handlers.Readyz(rs, pg))
	mux.Handle("GET /discover", requireSharedSecret(cfg, handlers.Discover(rs, pg)))

	return mux
}

func requireSharedSecret(cfg *config.Config, next http.Handler) http.Handler {
	expected := []byte(cfg.SharedSecret)
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// Sabit-zamanlı karşılaştırma: erken-çıkışlı `!=` timing side-channel
		// bırakır (CLAUDE-014). ConstantTimeCompare uzunluk farkında da
		// sabit davranır ve eşitse 1 döner.
		provided := []byte(r.Header.Get("X-Internal-Secret"))
		if subtle.ConstantTimeCompare(provided, expected) != 1 {
			http.Error(w, "unauthorized", http.StatusUnauthorized)
			return
		}
		next.ServeHTTP(w, r)
	})
}
