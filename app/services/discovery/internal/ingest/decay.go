package ingest

import (
	"context"
	"log"
	"time"

	"github.com/gulumsalim/discovery/internal/store"
)

const decayFactor = 0.98

// RunDecayLoop, periyodik olarak tüm affinity skorlarını azaltır - eski
// davranışsal sinyalin zamanla sönmesini sağlar (bkz. store/redis.go
// DecayAllAffinities). Event-başına üstel hesap yapmak yerine bu ucuz
// toplu yaklaşım, mimari planındaki "orta karmaşıklık" kararının parçası.
func RunDecayLoop(ctx context.Context, rs *store.RedisStore, interval time.Duration) {
	ticker := time.NewTicker(interval)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			if err := rs.DecayAllAffinities(ctx, decayFactor); err != nil {
				log.Printf("decay hatası: %v", err)
			}
		}
	}
}
