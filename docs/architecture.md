# Maxify Procurement Agent — Architecture

## System Overview

The Maxify Procurement Agent is a three-layer system that connects the Maxia solar calculator to nationwide equipment suppliers, enabling contractors to get competitive quotes with a single click.

## Architecture Layers

### 1. Integration Layer (Supplier Connectors)

Each supplier is connected through a standardized `SupplierAdapter` interface, regardless of their backend technology.

```
SupplierAdapter Interface
├── checkAvailability(products[]) → AvailabilityResponse
├── requestQuote(bom) → QuoteResponse
├── placeOrder(quoteId, payment) → OrderConfirmation
├── trackOrder(orderId) → TrackingStatus
├── getInventory(filters) → InventoryList
└── getProductSpecs(sku) → ProductSpecs
```

**Adapter Types:**

| Type | Suppliers | Method |
|------|-----------|--------|
| **API** | Wesco (developer portal) | Direct REST API calls |
| **Portal** | Soligent Connect, BayWa Webstore, Krannich Shop | Authenticated web portal interaction |
| **Email/Manual** | GreenTech, Fortune Energy, CivicSolar | Structured email → manual response → parsed |
| **E-Commerce** | RENVU | Public product catalog + email ordering |

### 2. Intelligence Layer (AI Procurement Engine)

The core engine that processes BOMs and orchestrates multi-supplier quoting.

**Components:**

- **BOM Parser** — Ingests BOMs from the Maxia calculator in JSON format. Maps product specifications to the `maxia_equipment.db` (23,704 CEC/NREL records) for standardized matching.

- **Quote Engine** — Orchestrates parallel quote requests across all connected suppliers via Bull/Redis job queue. Handles timeouts, retries, and partial responses.

- **Geofencing** — Uses contractor job-site location to prioritize suppliers with nearby warehouses, minimizing shipping cost and delivery time.

- **Price Comparison** — Normalizes supplier responses into a standardized comparison format. Accounts for: unit price, shipping cost, lead time, warranty terms, domestic content compliance.

- **Margin Calculator** — Applies Maxify's margin rules per equipment category on top of wholesale pricing. Configurable per supplier, volume tier, and contractor tier.

- **BOM Optimizer** — Suggests equivalent alternative products at lower cost. Example: if a specified panel is out of stock or expensive, recommends a compatible alternative from the equipment database.

### 3. Presentation Layer (Contractor Interface)

- **"Quote My System" Button** — Embedded in the Maxia calculator UI. Appears after BOM generation.
- **Quote Dashboard** — Shows pending quotes, supplier responses, price comparisons.
- **Order Management** — Place orders, track shipments, view history.
- **Admin Panel** — Supplier management, margin configuration, analytics.

## Data Flow

```
1. Contractor designs system in Maxia Calculator
   ↓
2. BOM generated (panels, inverters, batteries, racking, BOS)
   ↓
3. Contractor clicks "Quote My System"
   ↓
4. BOM sent to Procurement Agent API
   ↓
5. Quote Engine creates Bull jobs for each connected supplier
   ↓
6. Supplier adapters query each supplier in parallel
   ↓ (async, typically 1-4 hours for all responses)
7. Responses normalized and stored in PostgreSQL
   ↓
8. Contractor notified (email/SMS/push)
   ↓
9. Contractor views comparison dashboard
   ↓
10. Contractor selects supplier → Order placed via adapter
    ↓
11. Order tracked through delivery
```

## Database Schema

### PostgreSQL Tables

```sql
-- Contractors (from Maxify CRM)
CREATE TABLE contractors (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    maxify_id VARCHAR(255) UNIQUE NOT NULL,
    company_name VARCHAR(255),
    email VARCHAR(255),
    phone VARCHAR(50),
    address JSONB,
    tier VARCHAR(20) DEFAULT 'starter', -- starter, pro, enterprise
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Suppliers
CREATE TABLE suppliers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    adapter_type VARCHAR(50) NOT NULL, -- api, portal, email, ecommerce
    config JSONB, -- adapter-specific config (encrypted)
    regions TEXT[], -- states/regions served
    warehouses JSONB[], -- {lat, lon, city, state}
    is_active BOOLEAN DEFAULT true,
    avg_response_time_hours DECIMAL(4,1),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Quotes
CREATE TABLE quotes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    contractor_id UUID REFERENCES contractors(id),
    bom JSONB NOT NULL, -- full BOM from Maxia
    job_site_address JSONB,
    status VARCHAR(20) DEFAULT 'pending', -- pending, quoting, complete, expired
    supplier_count INTEGER,
    responses_received INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ
);

-- Quote Responses (one per supplier per quote)
CREATE TABLE quote_responses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    quote_id UUID REFERENCES quotes(id),
    supplier_id UUID REFERENCES suppliers(id),
    status VARCHAR(20) DEFAULT 'pending', -- pending, received, declined, timeout
    total_price DECIMAL(12,2),
    shipping_cost DECIMAL(8,2),
    lead_time_days INTEGER,
    line_items JSONB, -- per-product pricing
    maxify_margin DECIMAL(8,2), -- margin amount applied
    final_price DECIMAL(12,2), -- total_price + margin + shipping
    warranty_terms TEXT,
    domestic_content BOOLEAN,
    notes TEXT,
    received_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Orders
CREATE TABLE orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    quote_response_id UUID REFERENCES quote_responses(id),
    contractor_id UUID REFERENCES contractors(id),
    supplier_id UUID REFERENCES suppliers(id),
    status VARCHAR(20) DEFAULT 'placed', -- placed, confirmed, shipped, delivered
    total_amount DECIMAL(12,2),
    tracking_number VARCHAR(255),
    tracking_url TEXT,
    estimated_delivery DATE,
    delivered_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
```

## Integration with Existing Maxify Stack

| System | Integration |
|--------|-------------|
| **Maxia Calculator** | BOM input via REST API. "Quote My System" button calls POST /api/quotes/request |
| **maxia_equipment.db** | Product matching + spec validation. 23,704 CEC/NREL records |
| **Maxify CRM** | Contractor profiles, lead tracking via Zapier webhook |
| **Nearmap** | Roof measurements feed into BOM sizing |
| **Arcadia** | Utility data for system sizing → affects BOM |
| **ATTOM** | Property data for permitting requirements |
| **Twilio** | SMS notifications for quote/order updates |

## Security

- JWT authentication for contractor API access
- API keys for system-to-system integration (Maxia → Procurement)
- Encrypted supplier credentials in database (AES-256)
- Rate limiting per contractor (prevent quote abuse)
- Supplier data isolation (contractor cannot see wholesale pricing)
