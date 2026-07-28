package ingest

import "testing"

func TestParseEventValid(t *testing.T) {
	e, ok := parseEvent(map[string]string{
		"type": "purchase", "customerId": "42", "productId": "7",
		"vendorId": "3", "categoryId": "9", "sessionId": "s1",
	})
	if !ok {
		t.Fatal("geçerli event parse edilemedi")
	}
	if e.CustomerID != 42 || e.ProductID != 7 || e.VendorID != 3 || e.CategoryID != 9 {
		t.Fatalf("alanlar yanlış parse edildi: %+v", e)
	}
}

func TestParseEventMissingTypeRejected(t *testing.T) {
	if _, ok := parseEvent(map[string]string{"customerId": "42"}); ok {
		t.Fatal("type'sız event kabul edilmemeli")
	}
}

// Bozuk sayısal alanlar sessizce 0'a düşmeli (misafir gibi işlenir), panic değil.
func TestParseEventGarbageNumbersDefaultZero(t *testing.T) {
	e, ok := parseEvent(map[string]string{"type": "view", "customerId": "abc", "productId": "x"})
	if !ok {
		t.Fatal("view event ok olmalı")
	}
	if e.CustomerID != 0 || e.ProductID != 0 {
		t.Fatalf("geçersiz sayı 0 olmalı: %+v", e)
	}
}

// Event type allowlist: yalnızca bilinen tipler ağırlık üretmeli.
func TestWeightForAllowlist(t *testing.T) {
	cases := map[string]float64{
		"view": 1, "favorite": 3, "cart_add": 5, "purchase": 10,
		"unknown": 0, "": 0, "PURCHASE": 0,
	}
	for typ, want := range cases {
		if got := weightFor(typ); got != want {
			t.Fatalf("weightFor(%q)=%v, beklenen %v", typ, got, want)
		}
	}
}
