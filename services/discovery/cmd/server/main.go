// Keşfet/analitik servisi. Node API'nin arkasında, sadece localhost'ta
// çalışır. main.go bilinçli olarak ince tutulur — kurulum kablolaması
// dışındaki her şey internal/ paketlerine gider (bkz. mimari planı §5).
package main

import (
	"log"
	"net/http"

	"github.com/gulumsalim/discovery/internal/api"
	"github.com/gulumsalim/discovery/internal/config"
)

func main() {
	cfg, err := config.Load()
	if err != nil {
		log.Fatalf("yapılandırma hatası: %v", err)
	}

	router := api.NewRouter(cfg)

	addr := "127.0.0.1:" + cfg.Port
	log.Printf("discovery servisi %s adresinde dinliyor", addr)
	if err := http.ListenAndServe(addr, router); err != nil {
		log.Fatalf("sunucu hatası: %v", err)
	}
}
