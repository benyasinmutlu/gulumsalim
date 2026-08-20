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
// XACK ile onaylanır; işlenirken gerçek bir hata alan (Redis yazma hatası)
// event onaylanmaz ve pending listede kalır (sonraki XAutoClaim ile tekrar
// denenebilir — bkz. CLAUDE-003).
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

		c.readAndProcess(ctx, client)
	}
}

// readAndProcess tek bir XReadGroup turunu işler. Panic'i kurtarır: beklenmedik
// bir hata (nil deref, tip cast) tüm prosesi — HTTP sunucu + decay döngüsü —
// çökertmemeli (CLAUDE-015).
func (c *Consumer) readAndProcess(ctx context.Context, client *redis.Client) {
	defer func() {
		if rec := recover(); rec != nil {
			log.Printf("consumer panic kurtarıldı: %v", rec)
		}
	}()

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
		return
	}

	for _, stream := range streams {
		for _, msg := range stream.Messages {
			// XAck yalnızca event başarıyla işlendiğinde. Gerçek bir Redis
			// yazma hatasında event onaylanMAZ ki kaybolmasın (CLAUDE-003).
			if err := c.handleMessage(ctx, msg); err != nil {
				log.Printf("event işleme hatası (ack atlanıyor, id=%s): %v", msg.ID, err)
				continue
			}
			client.XAck(ctx, streamKey, consumerGroup, msg.ID)
		}
	}
}

// handleMessage bir event'i işler. nil dönüş = "onaylanabilir" (başarı veya
// işlenecek bir şey yok); non-nil = geçici hata, event onaylanmamalı.
func (c *Consumer) handleMessage(ctx context.Context, msg redis.XMessage) error {
	fields := make(map[string]string, len(msg.Values))
	for k, v := range msg.Values {
		if s, ok := v.(string); ok {
			fields[k] = s
		}
	}

	event, ok := parseEvent(fields)
	if !ok || event.CustomerID == 0 {
		// Misafir (giriş yapmamış) kullanıcı ya da parse edilemeyen event -
		// kişisel affinity'ye eklenecek bir şey yok. Tekrar denemenin anlamı
		// olmadığından başarı say (ack'le).
		return nil
	}

	weight := weightFor(event.Type)
	if weight == 0 {
		return nil
	}

	customerIDStr := strconv.FormatInt(event.CustomerID, 10)
	if err := c.redisStore.IncrAffinity(ctx, customerIDStr, event.CategoryID, event.VendorID, weight); err != nil {
		return err
	}
	return nil
}
