// Keşfet/analitik servisi. Node API'nin arkasında, sadece localhost'ta
// çalışır. main.go bilinçli olarak ince tutulur — kurulum kablolaması
// dışındaki her şey internal/ paketlerine gider (bkz. mimari planı §5).
//
// Sunucu, event tüketici goroutine'i ve decay ticker goroutine'i aynı
// process/systemd unit'inde birlikte çalışır - bu sunucudaki operasyonel
// sadelik için bilinçli bir tercih (bkz. mimari planı, "varsayılan
// kararlar" bölümü).
package main

import (
	"context"
	"log"
	"net/http"
	"os/signal"
	"syscall"
	"time"

	"github.com/gulumsalim/discovery/internal/api"
	"github.com/gulumsalim/discovery/internal/config"
	"github.com/gulumsalim/discovery/internal/ingest"
	"github.com/gulumsalim/discovery/internal/store"
)

func main() {
	cfg, err := config.Load()
	if err != nil {
		log.Fatalf("yapılandırma hatası: %v", err)
	}

	ctx, stop := signal.NotifyContext(context.Background(), syscall.SIGINT, syscall.SIGTERM)
	defer stop()

	redisStore, err := store.NewRedisStore(cfg.RedisURL)
	if err != nil {
		log.Fatalf("redis bağlantı hatası: %v", err)
	}

	pgStore, err := store.NewPostgresStore(ctx, cfg.DatabaseURL)
	if err != nil {
		log.Fatalf("postgres bağlantı hatası: %v", err)
	}
	defer pgStore.Pool.Close()

	consumer := ingest.NewConsumer(redisStore)
	go consumer.Run(ctx)
	go ingest.RunDecayLoop(ctx, redisStore, time.Hour)

	router := api.NewRouter(cfg, redisStore, pgStore)
	// Timeout'lar Slowloris ve asılı bağlantılara karşı zorunlu: timeout'suz
	// http.Server yavaş-header saldırısında goroutine/FD tüketir (CLAUDE-004).
	server := &http.Server{
		Addr:              "127.0.0.1:" + cfg.Port,
		Handler:           router,
		ReadHeaderTimeout: 5 * time.Second,
		ReadTimeout:       10 * time.Second,
		WriteTimeout:      15 * time.Second,
		IdleTimeout:       60 * time.Second,
		MaxHeaderBytes:    1 << 20,
	}

	go func() {
		<-ctx.Done()
		shutdownCtx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()
		server.Shutdown(shutdownCtx)
	}()

	log.Printf("discovery servisi %s adresinde dinliyor", server.Addr)
	if err := server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
		log.Fatalf("sunucu hatası: %v", err)
	}
}
