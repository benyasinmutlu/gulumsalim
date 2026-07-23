package ingest

import (
	"context"
	"log"
	"strconv"
	"time"

	"github.com/redis/go-redis/v9"

	"github.com/gulumsalim/discovery/internal/store"
)

const (
	streamKey     = "events:behavioral"
	consumerGroup = "discovery"
	consumerName  = "discovery-1"
)

// Consumer, Redis Stream'den davranışsal event'leri okuyup affinity
// sorted set'lerini günceller. En-az-bir-kez teslimat: işlenen her event
// XACK ile onaylanır; işlenirken hata alan bir event onaylanmaz ve
// sonraki taramada tekrar denenir.
type Consumer struct {
	redisStore *store.RedisStore
}

func NewConsumer(rs *store.RedisStore) *Consumer {
	return &Consumer{redisStore: rs}
}

func (c *Consumer) Run(ctx context.Context) {
	client := c.redisStore.Client

	// Grup zaten varsa "BUSYGROUP" hatası döner - görmezden gelinir.
	_ = client.XGroupCreateMkStream(ctx, streamKey, consumerGroup, "0").Err()

	for {
		select {
		case <-ctx.Done():
			return
		default:
		}

		streams, err := client.XReadGroup(ctx, &redis.XReadGroupArgs{
			Group:    consumerGroup,
			Consumer: consumerName,
			Streams:  []string{streamKey, ">"},
			Count:    50,
			Block:    5 * time.Second,
		}).Result()

		if err != nil {
			if err != redis.Nil {
				log.Printf("event stream okuma hatası: %v", err)
				time.Sleep(time.Second)
			}
			continue
		}

		for _, stream := range streams {
			for _, msg := range stream.Messages {
				c.handleMessage(ctx, msg)
				client.XAck(ctx, streamKey, consumerGroup, msg.ID)
			}
		}
	}
}

func (c *Consumer) handleMessage(ctx context.Context, msg redis.XMessage) {
	fields := make(map[string]string, len(msg.Values))
	for k, v := range msg.Values {
		if s, ok := v.(string); ok {
			fields[k] = s
		}
	}

	event, ok := parseEvent(fields)
	if !ok || event.CustomerID == 0 {
		// Misafir (giriş yapmamış) kullanıcı event'i - kişisel affinity'ye
		// eklenecek bir şey yok, sadece giriş yapmış kullanıcılar için
		// kişiselleştirme yapılıyor.
		return
	}

	weight := weightFor(event.Type)
	if weight == 0 {
		return
	}

	customerIDStr := strconv.FormatInt(event.CustomerID, 10)
	if err := c.redisStore.IncrAffinity(ctx, customerIDStr, event.CategoryID, event.VendorID, weight); err != nil {
		log.Printf("affinity güncelleme hatası: %v", err)
	}
}
