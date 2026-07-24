// Package scoring, Twitter-Keşfet ilhamlı ama bu sunucunun ölçeğine uygun
// "orta karmaşıklık" öneri mantığını içerir: tam bir ML/embedding sistemi
// değil, kullanıcının kategori/satıcı ilgisine göre ağırlıklandırılmış
// basit bir skor (bkz. mimari planı §5).
package scoring

import (
	"context"
	"sort"
	"strconv"

	"github.com/gulumsalim/discovery/internal/store"
)

const (
	maxProductsPerVendor = 3
	candidatePoolSize    = 60
	topAffinityCount     = 5
)

type scoredProduct struct {
	ProductID int64
	VendorID  int64
	Score     float64
}

// Personalized, geçmişi olan bir kullanıcı için kategori/satıcı ilgisine
// göre ağırlıklandırılmış ürün önerileri üretir. Boş dönerse (hiç
// affinity verisi yoksa) çağıran cold-start'a düşmeli.
func Personalized(ctx context.Context, rs *store.RedisStore, pg *store.PostgresStore, customerID string, limit int) ([]int64, error) {
	topCategories, err := rs.TopCategories(ctx, customerID, topAffinityCount)
	if err != nil {
		return nil, err
	}
	if len(topCategories) == 0 {
		return nil, nil
	}

	categoryIDs := make([]int64, 0, len(topCategories))
	categoryScore := map[int64]float64{}
	var maxCatScore float64
	for _, z := range topCategories {
		id := parseMemberID(z.Member)
		categoryIDs = append(categoryIDs, id)
		categoryScore[id] = z.Score
		if z.Score > maxCatScore {
			maxCatScore = z.Score
		}
	}

	topVendors, err := rs.TopVendors(ctx, customerID, topAffinityCount)
	if err != nil {
		return nil, err
	}
	vendorScore := map[int64]float64{}
	var maxVendorScore float64
	for _, z := range topVendors {
		id := parseMemberID(z.Member)
		vendorScore[id] = z.Score
		if z.Score > maxVendorScore {
			maxVendorScore = z.Score
		}
	}

	candidates, err := pg.ProductsByCategoryIDs(ctx, categoryIDs, candidatePoolSize)
	if err != nil {
		return nil, err
	}

	scored := make([]scoredProduct, 0, len(candidates))
	for i, c := range candidates {
		catNorm := 0.0
		if maxCatScore > 0 {
			catNorm = categoryScore[c.CategoryID] / maxCatScore
		}
		vendNorm := 0.0
		if maxVendorScore > 0 {
			vendNorm = vendorScore[c.VendorID] / maxVendorScore
		}
		// Postgres sorgusu created_at DESC sıralı geldiği için pozisyon,
		// gerçek bir popülerlik metriği birikene kadar basit bir
		// "yenilik" vekili olarak kullanılıyor.
		recencyNorm := 1.0 - float64(i)/float64(len(candidates))

		score := 0.5*catNorm + 0.3*vendNorm + 0.2*recencyNorm
		scored = append(scored, scoredProduct{ProductID: c.ID, VendorID: c.VendorID, Score: score})
	}

	return diversify(scored, limit), nil
}

// ColdStart, az/hiç geçmişi olmayan kullanıcılar için en yeni aktif
// ürünlerden bir liste döner. Gerçek bir "genel popülerlik" metriği
// (bkz. store/postgres.go RecentActiveProducts yorumu) henüz yok.
func ColdStart(ctx context.Context, pg *store.PostgresStore, excludeIDs []int64, limit int) ([]int64, error) {
	candidates, err := pg.RecentActiveProducts(ctx, excludeIDs, limit*2)
	if err != nil {
		return nil, err
	}
	scored := make([]scoredProduct, len(candidates))
	for i, c := range candidates {
		scored[i] = scoredProduct{ProductID: c.ID, VendorID: c.VendorID, Score: 1.0 - float64(i)/float64(len(candidates))}
	}
	return diversify(scored, limit), nil
}

// diversify skora göre sıralar ve satıcı başına en fazla
// maxProductsPerVendor ürünle sınırlar - tek bir satıcının tüm akışı
// doldurmasını engeller.
func diversify(scored []scoredProduct, limit int) []int64 {
	// Deterministik sıralama: eşit skorlu ürünlerde stable + ikincil
	// tie-breaker (ProductID) ile sıra çağrıdan çağrıya sabit kalır; aksi halde
	// unstable sort SSR/ISR cache ve sayfalamayı bozar (CLAUDE-011).
	sort.SliceStable(scored, func(i, j int) bool {
		if scored[i].Score != scored[j].Score {
			return scored[i].Score > scored[j].Score
		}
		return scored[i].ProductID > scored[j].ProductID
	})

	vendorCount := map[int64]int{}
	out := make([]int64, 0, limit)
	for _, s := range scored {
		if len(out) >= limit {
			break
		}
		if vendorCount[s.VendorID] >= maxProductsPerVendor {
			continue
		}
		vendorCount[s.VendorID]++
		out = append(out, s.ProductID)
	}
	return out
}

func parseMemberID(member interface{}) int64 {
	s, ok := member.(string)
	if !ok {
		return 0
	}
	id, err := strconv.ParseInt(s, 10, 64)
	if err != nil {
		return 0
	}
	return id
}
