# Maxify Procurement Agent — API Reference

Base URL: `https://procurement.gomaxify.com/api/v1`

## Authentication

All endpoints require a JWT token in the Authorization header:

```
Authorization: Bearer <token>
```

System-to-system calls (e.g., Maxia → Procurement) use API keys:

```
X-API-Key: <api-key>
```

---

## Quotes

### Request a Quote

`POST /quotes/request`

Submit a BOM from the Maxia calculator for multi-supplier quoting.

**Request Body:**
```json
{
    "bom": {
        "panels": [
            {
                "manufacturer": "Canadian Solar",
                "model": "CS6W-545MS",
                "quantity": 20,
                "watts": 545
            }
        ],
        "inverters": [
            {
                "manufacturer": "Enphase",
                "model": "IQ8M-72-2-US",
                "quantity": 20
            }
        ],
        "batteries": [
            {
                "manufacturer": "Tesla",
                "model": "Powerwall 3",
                "quantity": 1
            }
        ],
        "racking": [
            {
                "type": "roof_mount",
                "manufacturer": "IronRidge",
                "model": "XR100",
                "quantity": 20
            }
        ],
        "bos": []
    },
    "jobSite": {
        "address": "1234 Solar Way, Phoenix, AZ 85001",
        "lat": 33.4484,
        "lon": -112.0740
    },
    "preferences": {
        "maxLeadTimeDays": 14,
        "domesticContentRequired": false,
        "preferredSuppliers": [],
        "maxBudget": null
    }
}
```

**Response:**
```json
{
    "quoteId": "qt_abc123",
    "status": "quoting",
    "suppliersQueried": 5,
    "estimatedCompletionTime": "2026-03-21T14:00:00Z",
    "createdAt": "2026-03-20T10:00:00Z"
}
```

### Get Quote Status

`GET /quotes/:id`

**Response:**
```json
{
    "quoteId": "qt_abc123",
    "status": "complete",
    "suppliersQueried": 5,
    "responsesReceived": 4,
    "responses": [
        {
            "responseId": "qr_def456",
            "supplier": "Fortune Energy",
            "status": "received",
            "totalPrice": 12450.00,
            "shippingCost": 350.00,
            "maxifyMargin": 870.00,
            "finalPrice": 13670.00,
            "leadTimeDays": 5,
            "domesticContent": true,
            "lineItems": [
                {
                    "category": "panels",
                    "product": "Canadian Solar CS6W-545MS",
                    "quantity": 20,
                    "unitPrice": 195.00,
                    "available": true,
                    "warehouse": "Simi Valley, CA"
                }
            ],
            "receivedAt": "2026-03-20T14:30:00Z"
        }
    ],
    "recommendation": {
        "bestPrice": "qr_def456",
        "fastestDelivery": "qr_ghi789",
        "bestOverall": "qr_def456"
    }
}
```

### List Quotes

`GET /quotes`

Query params: `status`, `page`, `limit`, `dateFrom`, `dateTo`

---

## Orders

### Place Order

`POST /orders`

```json
{
    "quoteResponseId": "qr_def456",
    "payment": {
        "method": "ach",
        "accountId": "pay_123"
    },
    "shippingAddress": {
        "address": "1234 Solar Way, Phoenix, AZ 85001",
        "contactName": "John Smith",
        "contactPhone": "(480) 555-1234"
    }
}
```

**Response:**
```json
{
    "orderId": "ord_xyz789",
    "status": "placed",
    "supplier": "Fortune Energy",
    "totalAmount": 13670.00,
    "estimatedDelivery": "2026-03-27",
    "confirmationNumber": "FE-2026-4521"
}
```

### Track Order

`GET /orders/:id/track`

**Response:**
```json
{
    "orderId": "ord_xyz789",
    "status": "shipped",
    "trackingNumber": "1Z999AA10123456784",
    "carrier": "UPS Freight",
    "estimatedDelivery": "2026-03-26",
    "events": [
        {
            "timestamp": "2026-03-22T08:00:00Z",
            "status": "Picked up from warehouse",
            "location": "Simi Valley, CA"
        },
        {
            "timestamp": "2026-03-23T12:00:00Z",
            "status": "In transit",
            "location": "Flagstaff, AZ"
        }
    ]
}
```

---

## Suppliers

### List Suppliers

`GET /suppliers`

**Response:**
```json
{
    "suppliers": [
        {
            "id": "sup_001",
            "name": "Fortune Energy",
            "type": "email",
            "regions": ["CA", "AZ", "TX", "NJ"],
            "avgResponseHours": 3.2,
            "productCategories": ["panels", "inverters", "racking"],
            "active": true
        }
    ]
}
```

---

## Products

### Search Products

`GET /products/search?q=canadian+solar+545w&category=panels`

Searches the maxia_equipment.db (23,704 CEC/NREL records).

**Response:**
```json
{
    "results": [
        {
            "id": "CEC-MOD-12345",
            "manufacturer": "Canadian Solar",
            "model": "CS6W-545MS",
            "category": "panel",
            "watts": 545,
            "efficiency": 21.1,
            "technology": "Mono-PERC",
            "cecListed": true,
            "specs": {
                "voc": 49.4,
                "isc": 13.95,
                "vmp": 41.5,
                "imp": 13.13,
                "dimensions": "2256 x 1133 x 35 mm",
                "weight": "28.6 kg"
            }
        }
    ],
    "total": 3,
    "page": 1
}
```

---

## Webhooks

The Procurement Agent sends webhooks for key events:

| Event | Description |
|-------|-------------|
| `quote.response_received` | A supplier responded to a quote |
| `quote.complete` | All suppliers responded (or timed out) |
| `order.confirmed` | Supplier confirmed the order |
| `order.shipped` | Order has shipped |
| `order.delivered` | Order delivered |

**Webhook Payload:**
```json
{
    "event": "quote.response_received",
    "timestamp": "2026-03-20T14:30:00Z",
    "data": {
        "quoteId": "qt_abc123",
        "supplierId": "sup_001",
        "supplierName": "Fortune Energy",
        "responsesReceived": 3,
        "totalSuppliers": 5
    }
}
```
