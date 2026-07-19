package store

import (
	"context"

	"github.com/jackc/pgx/v5/pgxpool"
)

type PostgresStore struct {
	Pool *pgxpool.Pool
}

func NewPostgresStore(ctx context.Context, url string) (*PostgresStore, error) {
	pool, err := pgxpool.New(ctx, url)
	if err != nil {
		return nil, err
	}
	return &PostgresStore{Pool: pool}, nil
}

type CandidateProduct struct {
	ID         int64
	VendorID   int64
	CategoryID int64
}

// ProductsByCategoryIDs, verilen kategorilerdeki aktif (ve satıcısı aktif
// olan) ürünleri döner - keşfet skorlamasının aday havuzu burası.
// Katalog API'sindeki (apps/api) aynı JOIN + WHERE deseni burada da
// tekrarlanıyor: satıcı askıya alınırsa ürünleri buradan da anında düşer.
func (s *PostgresStore) ProductsByCategoryIDs(ctx context.Context, categoryIDs []int64, limit int) ([]CandidateProduct, error) {
	if len(categoryIDs) == 0 {
		return nil, nil
	}
	rows, err := s.Pool.Query(ctx, `
		SELECT p.id, p.vendor_id, p.category_id
		FROM products p
		JOIN vendors v ON v.id = p.vendor_id
		WHERE p.status = 'active' AND v.status = 'active' AND p.category_id = ANY($1)
		ORDER BY p.created_at DESC
		LIMIT $2
	`, categoryIDs, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var out []CandidateProduct
	for rows.Next() {
		var c CandidateProduct
		if err := rows.Scan(&c.ID, &c.VendorID, &c.CategoryID); err != nil {
			return nil, err
		}
		out = append(out, c)
	}
	return out, rows.Err()
}

// RecentActiveProducts, cold-start (az/hiç geçmişi olan kullanıcı) ve
// popülerlik-tabanlı bir durum tutan tabloya sahip olmadığımız için
// "genel popülerlik" yerine kullanılan basit bir varsayılan: en yeni
// aktif ürünler. Gerçek trafik biriktikçe bu, event stream'den türetilen
// gerçek bir popülerlik sıralamasıyla değiştirilebilir.
func (s *PostgresStore) RecentActiveProducts(ctx context.Context, excludeIDs []int64, limit int) ([]CandidateProduct, error) {
	// pgx, nil bir Go slice'ını SQL NULL'a çevirir - "NOT (id = ANY(NULL))"
	// üç değerli SQL mantığında NULL'a (yani hiçbir satırı seçmemeye)
	// eşitlenir. Boş ama NULL olmayan bir dizi ('{}') bu tuzağı önler.
	if excludeIDs == nil {
		excludeIDs = []int64{}
	}
	rows, err := s.Pool.Query(ctx, `
		SELECT p.id, p.vendor_id, p.category_id
		FROM products p
		JOIN vendors v ON v.id = p.vendor_id
		WHERE p.status = 'active' AND v.status = 'active' AND NOT (p.id = ANY($1))
		ORDER BY p.created_at DESC
		LIMIT $2
	`, excludeIDs, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var out []CandidateProduct
	for rows.Next() {
		var c CandidateProduct
		if err := rows.Scan(&c.ID, &c.VendorID, &c.CategoryID); err != nil {
			return nil, err
		}
		out = append(out, c)
	}
	return out, rows.Err()
}
