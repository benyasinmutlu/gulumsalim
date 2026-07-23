// Package config, ortam değişkenlerinden servis yapılandırmasını okur.
package config

import (
	"fmt"
	"os"
)

type Config struct {
	Port           string
	DatabaseURL    string
	RedisURL       string
	SharedSecret   string // Node API'den gelen isteklerde beklenen paylaşımlı gizli anahtar
}

func Load() (*Config, error) {
	cfg := &Config{
		Port:         getEnv("PORT", "8081"),
		DatabaseURL:  os.Getenv("DATABASE_URL"),
		RedisURL:     os.Getenv("REDIS_URL"),
		SharedSecret: os.Getenv("DISCOVERY_SERVICE_SECRET"),
	}

	if cfg.DatabaseURL == "" {
		return nil, fmt.Errorf("DATABASE_URL ayarlanmamış")
	}
	if cfg.RedisURL == "" {
		return nil, fmt.Errorf("REDIS_URL ayarlanmamış")
	}
	if cfg.SharedSecret == "" {
		return nil, fmt.Errorf("DISCOVERY_SERVICE_SECRET ayarlanmamış")
	}

	return cfg, nil
}

func getEnv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}
