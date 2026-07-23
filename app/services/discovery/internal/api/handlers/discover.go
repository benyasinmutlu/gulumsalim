package handlers

import (
	"encoding/json"
	"net/http"
	"strconv"

	"github.com/gulumsalim/discovery/internal/scoring"
	"github.com/gulumsalim/discovery/internal/store"
)

type DiscoverResponse struct {
	ProductIDs []int64 `json:"productIds"`
	Strategy   string  `json:"strategy"`
}

const defaultLimit = 20

// Discover, ürün detayını hiç bilmez - sadece sıralanmış ürün ID listesi
// döner (bkz. mimari planı §5). Detayı Node/Meilisearch doldurur.
func Discover(rs *store.RedisStore, pg *store.PostgresStore) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		limit := defaultLimit
		if l := r.URL.Query().Get("limit"); l != "" {
			if v, err := strconv.Atoi(l); err == nil && v > 0 && v <= 50 {
				limit = v
			}
		}

		userID := r.URL.Query().Get("userId")
		ctx := r.Context()

		var ids []int64
		strategy := "cold_start"

		if userID != "" {
			personalized, err := scoring.Personalized(ctx, rs, pg, userID, limit)
			if err == nil && len(personalized) > 0 {
				ids = personalized
				strategy = "personalized"
			}
		}

		if len(ids) == 0 {
			coldStart, err := scoring.ColdStart(ctx, pg, ids, limit)
			if err != nil {
				http.Error(w, "discover hatası", http.StatusInternalServerError)
				return
			}
			ids = coldStart
		}

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(DiscoverResponse{ProductIDs: ids, Strategy: strategy})
	}
}
