package scoring

import "testing"

// CLAUDE-011 regresyonu: eşit skorlu ürünlerde sıralama deterministik olmalı.
func TestDiversifyDeterministicOnTiedScores(t *testing.T) {
	in := []scoredProduct{
		{ProductID: 1, VendorID: 10, Score: 0.5},
		{ProductID: 2, VendorID: 11, Score: 0.5},
		{ProductID: 3, VendorID: 12, Score: 0.5},
	}
	// diversify slice'ı yerinde sıraladığı için her çağrıya kopya ver.
	a := diversify(append([]scoredProduct(nil), in...), 10)
	b := diversify(append([]scoredProduct(nil), in...), 10)

	if len(a) != len(b) {
		t.Fatalf("uzunluk farkı: %d vs %d", len(a), len(b))
	}
	for i := range a {
		if a[i] != b[i] {
			t.Fatalf("sıralama deterministik değil: %v vs %v", a, b)
		}
	}
	// Tie-breaker ProductID DESC → 3, 2, 1
	want := []int64{3, 2, 1}
	for i := range want {
		if a[i] != want[i] {
			t.Fatalf("beklenen %v, gelen %v", want, a)
		}
	}
}

// diversify tek bir satıcının akışı doldurmasına izin vermemeli.
func TestDiversifyVendorCap(t *testing.T) {
	var in []scoredProduct
	for i := 0; i < 10; i++ {
		in = append(in, scoredProduct{ProductID: int64(i + 1), VendorID: 99, Score: float64(10 - i)})
	}
	out := diversify(in, 10)
	if len(out) != maxProductsPerVendor {
		t.Fatalf("satıcı başına %d beklenirken %d ürün döndü", maxProductsPerVendor, len(out))
	}
}

func TestDiversifyRespectsLimit(t *testing.T) {
	var in []scoredProduct
	for i := 0; i < 20; i++ {
		in = append(in, scoredProduct{ProductID: int64(i + 1), VendorID: int64(i + 1), Score: float64(20 - i)})
	}
	out := diversify(in, 5)
	if len(out) != 5 {
		t.Fatalf("limit 5 beklenirken %d döndü", len(out))
	}
}
