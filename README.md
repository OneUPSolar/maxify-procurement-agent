# Maxify Procurement Agent

**Solar Equipment Intelligence Layer — Connecting Contractors to Nationwide Suppliers**

[![GoMaxify](https://img.shields.io/badge/GoMaxify-Platform-01696F)](https://gomaxify.com)
[![License](https://img.shields.io/badge/License-Proprietary-red)]()

## Overview

The Maxify Procurement Agent is an AI-powered equipment procurement platform that bridges the gap between the [Maxia Calculator](https://github.com/OneUPSolar/maxify-calculator-maxia-3-3) design tool and nationwide solar equipment distributors.

**How it works:**
1. Contractor designs a solar system in Maxia → BOM (Bill of Materials) generated
2. Contractor clicks **"Quote My System"** → Agent queries multiple suppliers in parallel
3. Suppliers respond with pricing, availability, and lead times within hours
4. Contractor sees a comparison table → selects best option → places order
5. Order tracked from supplier warehouse to job site

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                  PRESENTATION LAYER                      │
│  Maxia Calculator UI  │  Contractor Dashboard  │  Admin  │
├─────────────────────────────────────────────────────────┤
│                  INTELLIGENCE LAYER                      │
│  BOM Ingestion │ Multi-Vendor Quote Engine │ Geofencing  │
│  Price Comparison │ Margin Calculator │ Recommendations  │
├─────────────────────────────────────────────────────────┤
│                  INTEGRATION LAYER                       │
│  API Adapters │ Portal Scrapers │ Email/Manual Adapters  │
│  Soligent │ GreenTech │ BayWa │ Krannich │ Fortune │ +  │
└─────────────────────────────────────────────────────────┘
```

## Tech Stack

| Component | Technology |
|-----------|-----------|
| **API** | Node.js / Express |
| **Database** | PostgreSQL (quotes, orders, suppliers) |
| **Equipment DB** | SQLite (23,704 records from CEC/NREL) |
| **Queue** | Bull / Redis (async supplier queries) |
| **Auth** | JWT + API keys |
| **Hosting** | Cloudflare Workers / AWS Lambda |

## Project Structure

```
maxify-procurement-agent/
├── src/
│   ├── api/                    # Express API routes
│   │   ├── routes/
│   │   │   ├── quotes.js       # POST /quotes/request, GET /quotes/:id
│   │   │   ├── suppliers.js    # GET /suppliers, GET /suppliers/:id
│   │   │   ├── orders.js       # POST /orders, GET /orders/:id/track
│   │   │   └── products.js     # GET /products/search, GET /products/:id
│   │   ├── middleware/
│   │   │   ├── auth.js         # JWT + API key authentication
│   │   │   └── rateLimit.js    # Rate limiting per contractor
│   │   └── index.js            # Express app setup
│   │
│   ├── adapters/               # Supplier integration adapters
│   │   ├── base.js             # SupplierAdapter base class
│   │   ├── fortune-energy.js   # Fortune Energy (iDesign API / email)
│   │   ├── krannich.js         # Krannich Solar (shop portal)
│   │   ├── baywa.js            # BayWa r.e. (webstore)
│   │   ├── soligent.js         # Soligent (Connect portal)
│   │   ├── greentech.js        # GreenTech Renewables (email/manual)
│   │   ├── renvu.js            # RENVU (e-commerce)
│   │   └── wesco.js            # Wesco (API developer portal)
│   │
│   ├── engine/                 # Core procurement intelligence
│   │   ├── bom-parser.js       # Parse BOM from Maxia calculator
│   │   ├── quote-engine.js     # Multi-vendor quoting orchestrator
│   │   ├── price-compare.js    # Price comparison + recommendations
│   │   ├── geofence.js         # Nearest warehouse selection
│   │   ├── margin.js           # Maxify margin calculator
│   │   └── optimizer.js        # BOM optimization (equivalent alternatives)
│   │
│   ├── models/                 # Database models (PostgreSQL)
│   │   ├── Quote.js
│   │   ├── QuoteResponse.js
│   │   ├── Order.js
│   │   ├── Supplier.js
│   │   └── Product.js
│   │
│   ├── services/               # Business logic
│   │   ├── quoteService.js     # Quote lifecycle management
│   │   ├── orderService.js     # Order placement + tracking
│   │   ├── supplierService.js  # Supplier management + health
│   │   └── notifyService.js    # Email/webhook notifications
│   │
│   └── config/                 # Configuration
│       ├── database.js         # PostgreSQL connection
│       ├── redis.js            # Redis/Bull queue config
│       ├── suppliers.json      # Supplier registry
│       └── margins.json        # Margin rules per category
│
├── data/
│   └── maxia_equipment.db      # CEC/NREL equipment database (23,704 records)
│
├── docs/
│   ├── architecture.md         # Detailed architecture documentation
│   ├── api-reference.md        # API endpoint documentation
│   ├── supplier-onboarding.md  # Guide for adding new suppliers
│   └── revenue-model.md        # Revenue and margin model details
│
├── tests/
│   ├── adapters/
│   ├── engine/
│   └── api/
│
├── .env.example                # Environment variables template
├── package.json
├── docker-compose.yml          # Local dev: PostgreSQL + Redis
└── README.md
```

## API Endpoints

### Quotes
| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/quotes/request` | Submit BOM for multi-supplier quoting |
| `GET` | `/api/quotes/:id` | Get quote status and all supplier responses |
| `GET` | `/api/quotes` | List all quotes for authenticated contractor |

### Orders
| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/orders` | Place order with selected supplier + quote |
| `GET` | `/api/orders/:id` | Get order details |
| `GET` | `/api/orders/:id/track` | Track order shipping status |

### Suppliers
| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/suppliers` | List all connected suppliers |
| `GET` | `/api/suppliers/:id` | Supplier details + capabilities |

### Products
| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/products/search` | Search equipment database |
| `GET` | `/api/products/:id` | Product details + specs |

## Revenue Model

**Equipment Margin Structure:**

| Category | Target Margin | Notes |
|----------|-------------|-------|
| Solar Panels | 3-8% | Commodity, compete on volume |
| Inverters | 5-10% | Higher complexity, more margin |
| Batteries | 5-10% | Growing category |
| Racking/BOS | 8-15% | Highest margin, most fragmented |

Equipment margins subsidize contractor SaaS license fees for the Maxia platform.

## Target Suppliers

### Tier 1 — National, Digital-Ready
- **Soligent** — Largest pure-play, "Soligent Connect" portal
- **GreenTech Renewables** — 100+ locations, formerly CED Greentech
- **BayWa r.e.** — Advanced webstore with real-time inventory
- **Krannich Solar USA** — 4 US locations, online shop with CSV upload

### Tier 2 — Regional/Specialty
- **Fortune Energy** — CA-based, iDesign BOM calculator (priority integration)
- **RENVU** — E-commerce model, visible pricing
- **CivicSolar** — National, US + Caribbean + Latin America
- **ACES** — East coast focused

## Development Roadmap

| Phase | Timeline | Milestone |
|-------|----------|-----------|
| **Foundation** | Q2 2026 | API skeleton, PostgreSQL schema, first adapter (Fortune Energy) |
| **Multi-Supplier** | Q3 2026 | 3+ suppliers live, contractor beta launch |
| **Intelligence** | Q4 2026 | AI optimization, geofencing, pricing trends |
| **Marketplace** | Q1 2027 | Supplier self-onboarding, Net-30 credit |

## Related Repos

| Repo | Description |
|------|-------------|
| [maxify-calculator-maxia-3-3](https://github.com/OneUPSolar/maxify-calculator-maxia-3-3) | Maxia 3.3 solar calculator (BOM source) |
| [SolarTech-Project](https://github.com/OneUPSolar/SolarTech-Project) | California solar platform |
| [Solana-Project](https://github.com/OneUPSolar/Solana-Project) | Arizona/Solana solar platform |
| [Maxify-website](https://github.com/OneUPSolar/Maxify-website) | GoMaxify main website (Next.js) |

## Getting Started

```bash
# Clone the repo
git clone https://github.com/OneUPSolar/maxify-procurement-agent.git
cd maxify-procurement-agent

# Install dependencies
npm install

# Copy environment template
cp .env.example .env

# Start local services (PostgreSQL + Redis)
docker-compose up -d

# Run database migrations
npm run migrate

# Start development server
npm run dev
```

## Environment Variables

See `.env.example` for required configuration.

## License

Proprietary — GoMaxify, Inc. All rights reserved.
