/**
 * Quote Engine — Multi-Vendor Quoting Orchestrator
 * 
 * Takes a BOM from the Maxia calculator, queries all connected suppliers
 * in parallel via Bull/Redis job queue, aggregates responses, and
 * produces a normalized comparison for the contractor.
 */

const { v4: uuidv4 } = require('uuid');

class QuoteEngine {
    constructor({ supplierRegistry, db, queue, logger }) {
        this.suppliers = supplierRegistry;
        this.db = db;
        this.queue = queue;
        this.logger = logger || console;
    }

    /**
     * Create a new multi-supplier quote request
     * @param {Object} bom - BOM from Maxia calculator
     * @param {Object} jobSite - { address, lat, lon, state }
     * @param {Object} contractor - Authenticated contractor info
     * @param {Object} preferences - { maxLeadTimeDays, domesticContentRequired, preferredSuppliers }
     * @returns {Object} - Quote record with status
     */
    async createQuoteRequest(bom, jobSite, contractor, preferences = {}) {
        const quoteId = uuidv4();

        // 1. Determine which suppliers to query
        const eligibleSuppliers = this._filterSuppliers(jobSite, preferences);

        if (eligibleSuppliers.length === 0) {
            throw new Error('No eligible suppliers found for this job site location');
        }

        // 2. Store quote in database
        const quote = {
            id: quoteId,
            contractorId: contractor.id,
            bom: bom,
            jobSite: jobSite,
            preferences: preferences,
            status: 'quoting',
            supplierCount: eligibleSuppliers.length,
            responsesReceived: 0,
            createdAt: new Date(),
            expiresAt: new Date(Date.now() + 48 * 60 * 60 * 1000), // 48h expiry
        };

        // TODO: Save to PostgreSQL
        this.logger.info(`[QuoteEngine] Created quote ${quoteId} — querying ${eligibleSuppliers.length} suppliers`);

        // 3. Dispatch parallel quote jobs to each supplier
        for (const supplier of eligibleSuppliers) {
            await this._dispatchQuoteJob(quoteId, supplier, bom, jobSite);
        }

        return quote;
    }

    /**
     * Filter suppliers based on job site location and contractor preferences
     */
    _filterSuppliers(jobSite, preferences) {
        const allSuppliers = this.suppliers.getActive();

        return allSuppliers.filter(supplier => {
            // Check if supplier serves the job site state
            if (jobSite.state && !supplier.servesRegion(jobSite.state)) {
                return false;
            }

            // Check preferred suppliers filter
            if (preferences.preferredSuppliers?.length) {
                return preferences.preferredSuppliers.includes(supplier.name);
            }

            return true;
        });
    }

    /**
     * Dispatch a quote request job to a specific supplier via Bull queue
     */
    async _dispatchQuoteJob(quoteId, supplier, bom, jobSite) {
        const jobData = {
            quoteId,
            supplierId: supplier.name,
            adapterType: supplier.type,
            bom,
            jobSite,
            nearestWarehouse: supplier.findNearestWarehouse(jobSite.lat, jobSite.lon),
        };

        if (this.queue) {
            await this.queue.add('supplier-quote', jobData, {
                attempts: 3,
                backoff: { type: 'exponential', delay: 5000 },
                timeout: supplier.responseTimeSLA * 60 * 60 * 1000, // SLA in ms
            });
        }

        this.logger.info(`[QuoteEngine] Dispatched quote job to ${supplier.name} (${supplier.type})`);
    }

    /**
     * Process a supplier's quote response
     * Called when a supplier adapter returns pricing
     */
    async processResponse(quoteId, supplierName, response) {
        const supplier = this.suppliers.get(supplierName);
        if (!supplier) {
            throw new Error(`Unknown supplier: ${supplierName}`);
        }

        // Normalize the response
        const normalized = this._normalizeResponse(response, supplier);

        // Apply Maxify margin
        normalized.lineItems = normalized.lineItems.map(item => ({
            ...item,
            margin: supplier.calculateMargin(item.category, item.unitPrice * item.quantity),
            finalPrice: item.unitPrice * item.quantity + 
                        supplier.calculateMargin(item.category, item.unitPrice * item.quantity),
        }));

        normalized.maxifyMargin = normalized.lineItems.reduce((sum, item) => sum + item.margin, 0);
        normalized.finalPrice = normalized.totalPrice + normalized.maxifyMargin + (normalized.shippingCost || 0);

        // TODO: Store in PostgreSQL quote_responses table
        // TODO: Check if all suppliers have responded → mark quote as complete
        // TODO: Notify contractor

        this.logger.info(
            `[QuoteEngine] Received response from ${supplierName} for quote ${quoteId}: ` +
            `$${normalized.totalPrice} wholesale → $${normalized.finalPrice} final`
        );

        return normalized;
    }

    /**
     * Normalize supplier response into standard format
     */
    _normalizeResponse(response, supplier) {
        return {
            supplier: supplier.name,
            status: 'received',
            totalPrice: response.totalPrice || 0,
            shippingCost: response.shippingCost || 0,
            leadTimeDays: response.leadTimeDays || null,
            domesticContent: response.domesticContent || false,
            lineItems: (response.lineItems || []).map(item => ({
                category: item.category,
                product: `${item.manufacturer} ${item.model}`,
                quantity: item.quantity,
                unitPrice: item.unitPrice,
                available: item.available,
                warehouse: item.warehouse,
                leadTimeDays: item.leadTimeDays,
                notes: item.notes,
            })),
            warrantyTerms: response.warrantyTerms || null,
            notes: response.notes || null,
            receivedAt: new Date(),
        };
    }

    /**
     * Generate recommendation from completed quote responses
     */
    generateRecommendation(responses) {
        if (!responses.length) return null;

        const received = responses.filter(r => r.status === 'received');
        if (!received.length) return null;

        // Best price
        const bestPrice = received.reduce((best, r) => 
            r.finalPrice < best.finalPrice ? r : best
        );

        // Fastest delivery
        const withLeadTime = received.filter(r => r.leadTimeDays != null);
        const fastestDelivery = withLeadTime.length
            ? withLeadTime.reduce((best, r) => r.leadTimeDays < best.leadTimeDays ? r : best)
            : null;

        // Best overall (weighted score: 60% price, 30% speed, 10% domestic content)
        const scored = received.map(r => {
            const priceScore = 1 - (r.finalPrice / Math.max(...received.map(x => x.finalPrice)));
            const speedScore = r.leadTimeDays 
                ? 1 - (r.leadTimeDays / Math.max(...withLeadTime.map(x => x.leadTimeDays)))
                : 0.5;
            const domesticScore = r.domesticContent ? 1 : 0;
            return {
                ...r,
                score: priceScore * 0.6 + speedScore * 0.3 + domesticScore * 0.1,
            };
        });
        const bestOverall = scored.reduce((best, r) => r.score > best.score ? r : best);

        return {
            bestPrice: bestPrice.supplier,
            fastestDelivery: fastestDelivery?.supplier || null,
            bestOverall: bestOverall.supplier,
        };
    }
}

module.exports = QuoteEngine;
