/**
 * SupplierAdapter — Base class for all supplier integrations
 * 
 * Each supplier (Fortune Energy, Krannich, BayWa, Soligent, etc.)
 * extends this base class and implements the required methods.
 */

class SupplierAdapter {
    constructor(config) {
        this.name = config.name || 'Unknown Supplier';
        this.type = config.type || 'manual'; // api, portal, email, ecommerce
        this.regions = config.regions || [];
        this.warehouses = config.warehouses || [];
        this.credentials = config.credentials || {};
        this.margins = config.margins || {};
        this.responseTimeSLA = config.responseTimeSLA || 24; // hours
        this.active = config.active !== false;
    }

    /**
     * Check product availability across supplier warehouses
     * @param {Array} products - Array of { manufacturer, model, quantity }
     * @returns {Promise<Array>} - Array of { sku, available, quantity, warehouse, leadTimeDays }
     */
    async checkAvailability(products) {
        throw new Error(`${this.name}: checkAvailability() not implemented`);
    }

    /**
     * Submit a BOM for quoting
     * @param {Object} bom - Full BOM from Maxia calculator
     * @param {Object} jobSite - { address, lat, lon }
     * @returns {Promise<Object>} - { quoteId, estimatedResponseTime, status }
     */
    async requestQuote(bom, jobSite) {
        throw new Error(`${this.name}: requestQuote() not implemented`);
    }

    /**
     * Check if a quote has been responded to
     * @param {string} quoteId - Supplier-side quote ID
     * @returns {Promise<Object>} - { status, lineItems, totalPrice, shipping, leadTime }
     */
    async getQuoteResponse(quoteId) {
        throw new Error(`${this.name}: getQuoteResponse() not implemented`);
    }

    /**
     * Place an order based on an accepted quote
     * @param {string} quoteId - Accepted quote ID
     * @param {Object} payment - Payment details
     * @param {Object} shipping - Shipping address
     * @returns {Promise<Object>} - { orderId, confirmationNumber, estimatedDelivery }
     */
    async placeOrder(quoteId, payment, shipping) {
        throw new Error(`${this.name}: placeOrder() not implemented`);
    }

    /**
     * Track an existing order
     * @param {string} orderId - Supplier-side order ID
     * @returns {Promise<Object>} - { status, trackingNumber, carrier, events }
     */
    async trackOrder(orderId) {
        throw new Error(`${this.name}: trackOrder() not implemented`);
    }

    /**
     * Get product catalog / inventory
     * @param {Object} filters - { category, manufacturer, search }
     * @returns {Promise<Array>} - Array of product listings
     */
    async getInventory(filters) {
        throw new Error(`${this.name}: getInventory() not implemented`);
    }

    /**
     * Get detailed product specifications
     * @param {string} sku - Product SKU or model number
     * @returns {Promise<Object>} - Full product specs
     */
    async getProductSpecs(sku) {
        throw new Error(`${this.name}: getProductSpecs() not implemented`);
    }

    /**
     * Find nearest warehouse to a job site
     * @param {number} lat - Job site latitude
     * @param {number} lon - Job site longitude
     * @returns {Object|null} - Nearest warehouse { city, state, distanceMiles }
     */
    findNearestWarehouse(lat, lon) {
        if (!this.warehouses.length) return null;

        let nearest = null;
        let minDistance = Infinity;

        for (const wh of this.warehouses) {
            const distance = this._haversine(lat, lon, wh.lat, wh.lon);
            if (distance < minDistance) {
                minDistance = distance;
                nearest = { ...wh, distanceMiles: Math.round(distance) };
            }
        }

        return nearest;
    }

    /**
     * Check if supplier serves a given state
     * @param {string} state - Two-letter state code
     * @returns {boolean}
     */
    servesRegion(state) {
        return this.regions.length === 0 || this.regions.includes(state);
    }

    /**
     * Calculate margin for a given product category
     * @param {string} category - panels, inverters, batteries, racking, bos
     * @param {number} wholesalePrice - Supplier price
     * @returns {number} - Margin amount
     */
    calculateMargin(category, wholesalePrice) {
        const marginRate = this.margins[category] || 0.08; // default 8%
        return Math.round(wholesalePrice * marginRate * 100) / 100;
    }

    /**
     * Haversine distance in miles
     */
    _haversine(lat1, lon1, lat2, lon2) {
        const R = 3959; // Earth radius in miles
        const dLat = (lat2 - lat1) * Math.PI / 180;
        const dLon = (lon2 - lon1) * Math.PI / 180;
        const a = Math.sin(dLat / 2) ** 2 +
                  Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
                  Math.sin(dLon / 2) ** 2;
        return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    }
}

module.exports = SupplierAdapter;
