# Supplier Onboarding Guide

## Overview

This guide covers how to add a new solar equipment supplier to the Maxify Procurement Agent.

## Adapter Types

### 1. API Adapter
For suppliers with a documented REST/GraphQL API.

**Requirements:**
- API documentation / developer portal
- API key or OAuth credentials
- Endpoints for: product search, availability, pricing, order placement

**Example:** Wesco (apideveloper.wesco.com)

### 2. Portal Adapter
For suppliers with an authenticated web ordering portal.

**Requirements:**
- Dealer account credentials
- Understanding of portal workflow
- Session management approach

**Example:** Soligent Connect, BayWa r.e. Webstore, Krannich Shop

### 3. Email/Manual Adapter
For suppliers without digital ordering capabilities.

**Requirements:**
- Sales rep contact email
- BOM format they accept (PDF, CSV, Excel)
- Expected response time

**Example:** GreenTech Renewables, CivicSolar

### 4. E-Commerce Adapter
For suppliers with public-facing product catalogs.

**Requirements:**
- Product catalog URL
- Pricing visibility (public vs. dealer-only)
- Order method (cart, email, phone)

**Example:** RENVU

## Creating a New Adapter

```javascript
// src/adapters/new-supplier.js

const BaseAdapter = require('./base');

class NewSupplierAdapter extends BaseAdapter {
    constructor(config) {
        super(config);
        this.name = 'New Supplier';
        this.type = 'api'; // api, portal, email, ecommerce
    }

    async checkAvailability(products) {
        // Check if products are in stock
        // Return: { sku, available: bool, quantity, warehouse, leadTimeDays }
    }

    async requestQuote(bom) {
        // Submit BOM for quoting
        // Return: { quoteId, estimatedResponseTime, status }
    }

    async getQuoteResponse(quoteId) {
        // Check if quote has been responded to
        // Return: { status, lineItems, totalPrice, shipping, leadTime }
    }

    async placeOrder(quoteId, paymentInfo) {
        // Place order based on accepted quote
        // Return: { orderId, confirmationNumber, estimatedDelivery }
    }

    async trackOrder(orderId) {
        // Get order tracking status
        // Return: { status, trackingNumber, carrier, estimatedDelivery }
    }
}

module.exports = NewSupplierAdapter;
```

## Supplier Configuration

Add supplier config to `src/config/suppliers.json`:

```json
{
    "new-supplier": {
        "name": "New Supplier Co.",
        "adapter": "new-supplier",
        "type": "api",
        "regions": ["CA", "AZ", "NV", "TX"],
        "warehouses": [
            { "city": "Los Angeles", "state": "CA", "lat": 34.0522, "lon": -118.2437 }
        ],
        "credentials": {
            "apiKey": "ENV:NEW_SUPPLIER_API_KEY",
            "dealerId": "ENV:NEW_SUPPLIER_DEALER_ID"
        },
        "margins": {
            "panels": 0.05,
            "inverters": 0.08,
            "batteries": 0.08,
            "racking": 0.12,
            "bos": 0.15
        },
        "responseTimeSLA": 4,
        "active": true
    }
}
```

## Testing

1. Create adapter test file in `tests/adapters/`
2. Test with sample BOM from Maxia calculator
3. Verify response format matches schema
4. Test error handling (timeout, auth failure, out of stock)

## Supplier Contact List

| Supplier | Contact | Type | Priority |
|----------|---------|------|----------|
| Fortune Energy | fortuneenergy.net | Email/iDesign | Phase 1 |
| Krannich Solar | krannich-solar.com/us-en | Portal | Phase 2 |
| BayWa r.e. | solar-store-us.baywa-re.com | Portal | Phase 2 |
| Soligent | connect.soligent.net | Portal | Phase 2 |
| GreenTech Renewables | greentechrenewables.com | Email | Phase 2 |
| RENVU | renvu.com | E-Commerce | Phase 2 |
| Wesco | apideveloper.wesco.com | API | Phase 3 |
| CivicSolar | civicsolar.com | Email | Phase 3 |
