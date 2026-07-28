package ingest

import "strconv"

type BehavioralEvent struct {
	Type       string
	CustomerID int64
	ProductID  int64
	VendorID   int64
	CategoryID int64
	SessionID  string
}

// Ağırlıklar mimari planındaki değerlerle birebir aynı: satın alma en
// güçlü sinyal, görüntüleme en zayıf.
var eventWeights = map[string]float64{
	"view":     1,
	"favorite": 3,
	"cart_add": 5,
	"purchase": 10,
}

func weightFor(eventType string) float64 {
	return eventWeights[eventType]
}

func parseEvent(fields map[string]string) (BehavioralEvent, bool) {
	e := BehavioralEvent{
		Type:      fields["type"],
		SessionID: fields["sessionId"],
	}
	if e.Type == "" {
		return e, false
	}
	if v, err := strconv.ParseInt(fields["customerId"], 10, 64); err == nil {
		e.CustomerID = v
	}
	if v, err := strconv.ParseInt(fields["productId"], 10, 64); err == nil {
		e.ProductID = v
	}
	if v, err := strconv.ParseInt(fields["vendorId"], 10, 64); err == nil {
		e.VendorID = v
	}
	if v, err := strconv.ParseInt(fields["categoryId"], 10, 64); err == nil {
		e.CategoryID = v
	}
	return e, true
}
