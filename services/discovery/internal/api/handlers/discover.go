package handlers

import (
	"encoding/json"
	"net/http"
)

type DiscoverResponse struct {
	ProductIDs []int64 `json:"productIds"`
	Strategy   string  `json:"strategy"`
}

// Discover, şu an için iskelet aşamasında: her zaman boş bir cold-start
// yanıtı döner. Gerçek skorlama (Redis affinity sorted set'leri + Postgres
// popülerlik rollup'ı, bkz. mimari planı §5) Faz 4'te, davranışsal event
// akışı (services/discovery/internal/ingest) devreye girdiğinde eklenecek.
func Discover(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(DiscoverResponse{
		ProductIDs: []int64{},
		Strategy:   "cold_start",
	})
}
