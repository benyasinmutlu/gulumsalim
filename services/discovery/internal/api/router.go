package api

import (
	"net/http"

	"github.com/gulumsalim/discovery/internal/api/handlers"
	"github.com/gulumsalim/discovery/internal/config"
)

// NewRouter, bu servisin tüm dış yüzeyini kurar. Kasıtlı olarak küçük:
// sadece /healthz ve /discover var. Bu servis 127.0.0.1'e bağlı kalır
// (nginx/firewalld dışarıya hiç yönlendirmez) — yine de her istekte
// paylaşımlı gizli anahtar kontrolü yapılır, ek bir savunma katmanı olarak.
func NewRouter(cfg *config.Config) http.Handler {
	mux := http.NewServeMux()

	mux.HandleFunc("GET /healthz", handlers.Healthz)
	mux.Handle("GET /discover", requireSharedSecret(cfg, http.HandlerFunc(handlers.Discover)))

	return mux
}

func requireSharedSecret(cfg *config.Config, next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Header.Get("X-Internal-Secret") != cfg.SharedSecret {
			http.Error(w, "unauthorized", http.StatusUnauthorized)
			return
		}
		next.ServeHTTP(w, r)
	})
}
