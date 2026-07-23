// Package store, Redis (affinity sorted set'leri + event stream) ve
// Postgres (ürün/kategori/satıcı verisi) erişimini sarmalar.
package store

import (
	"context"
	"strconv"

	"github.com/redis/go-redis/v9"
)

type RedisStore struct {
	Client *redis.Client
}

func NewRedisStore(url string) (*RedisStore, error) {
	opts, err := redis.ParseURL(url)
	if err != nil {
		return nil, err
	}
	return &RedisStore{Client: redis.NewClient(opts)}, nil
}

func categoryKey(customerID string) string { return "affinity:category:" + customerID }
func vendorKey(customerID string) string   { return "affinity:vendor:" + customerID }

// IncrAffinity, bir müşterinin kategori/satıcı ilgisini event ağırlığı
// kadar artırır. ZINCRBY negatif de olabilir (decay için).
func (s *RedisStore) IncrAffinity(ctx context.Context, customerID string, categoryID, vendorID int64, weight float64) error {
	pipe := s.Client.TxPipeline()
	if categoryID != 0 {
		pipe.ZIncrBy(ctx, categoryKey(customerID), weight, strconv.FormatInt(categoryID, 10))
	}
	if vendorID != 0 {
		pipe.ZIncrBy(ctx, vendorKey(customerID), weight, strconv.FormatInt(vendorID, 10))
	}
	_, err := pipe.Exec(ctx)
	return err
}

// TopCategories/TopVendors, bir müşterinin en yüksek skorlu N kategori/
// satıcısını (id, skor) çiftleri olarak döner.
func (s *RedisStore) TopCategories(ctx context.Context, customerID string, n int64) ([]redis.Z, error) {
	return s.Client.ZRevRangeWithScores(ctx, categoryKey(customerID), 0, n-1).Result()
}

func (s *RedisStore) TopVendors(ctx context.Context, customerID string, n int64) ([]redis.Z, error) {
	return s.Client.ZRevRangeWithScores(ctx, vendorKey(customerID), 0, n-1).Result()
}

// DecayAllAffinities, tüm affinity sorted set'lerindeki skorları belirli
// bir katsayıyla çarpar - eski davranışsal sinyalin zamanla sönmesini
// sağlar. Periyodik bir ticker tarafından çağrılır (bkz. ingest/decay.go).
// Event-başına üstel hesap yapmak yerine bu ucuz toplu yaklaşım tercih
// edildi - mimari planında "orta karmaşıklık" olarak tarif edilen kısım bu.
func (s *RedisStore) DecayAllAffinities(ctx context.Context, factor float64) error {
	iter := s.Client.Scan(ctx, 0, "affinity:*", 100).Iterator()
	for iter.Next(ctx) {
		key := iter.Val()
		members, err := s.Client.ZRangeWithScores(ctx, key, 0, -1).Result()
		if err != nil {
			continue
		}
		if len(members) == 0 {
			continue
		}
		pipe := s.Client.TxPipeline()
		for _, m := range members {
			pipe.ZAdd(ctx, key, redis.Z{Score: m.Score * factor, Member: m.Member})
		}
		pipe.Exec(ctx)
	}
	return iter.Err()
}
