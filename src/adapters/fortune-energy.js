/**
 * Fortune Energy Adapter
 * 
 * Fortune Energy is a CA-based nationwide solar distributor with:
 * - iDesign BOM Calculator tool
 * - Real-time pricing quotes via sales rep
 * - Warehouses: Simi Valley CA, Sacramento CA, Austin TX, NJ
 * - Brands: Canadian Solar, Silfab, Q Cells, Jinko, Longi, Solaria, CSUN
 * 
 * Integration approach: Structured email to sales rep with BOM,
 * parsed response via email or webhook callback.
 * 
 * URL: https://www.fortuneenergy.net
 */

const SupplierAdapter = require('./base');
const axios = require('axios');

class FortuneEnergyAdapter extends SupplierAdapter {
    constructor(config = {}) {
        super({
            name: 'Fortune Energy',
            type: 'email',
            regions: ['CA', 'AZ', 'TX', 'NJ', 'NV', 'OR', 'WA', 'CO', 'FL', 'NY'],
            warehouses: [
                { city: 'Simi Valley', state: 'CA', lat: 34.2694, lon: -118.7815 },
                { city: 'Sacramento', state: 'CA', lat: 38.5816, lon: -121.4944 },
                { city: 'Austin', state: 'TX', lat: 30.2672, lon: -97.7431 },
                { city: 'Edison', state: 'NJ', lat: 40.5187, lon: -74.4121 },
            ],
            margins: {
                panels: 0.05,
                inverters: 0.08,
                batteries: 0.08,
                racking: 0.12,
                bos: 0.15,
            },
            responseTimeSLA: 4, // hours
            ...config,
        });
    }

    async requestQuote(bom, jobSite) {
        // Format BOM into structured email for Fortune Energy sales rep
        const emailBody = this._formatBOMEmail(bom, jobSite);

        // TODO: Send structured email via SMTP or API
        // For now, log the formatted request
        console.log(`[Fortune Energy] Quote request formatted for ${bom.panels?.length || 0} panel types`);

        // In production: send email, store pending quote in DB, 
        // wait for rep response via email parsing or webhook
        return {
            quoteId: `FE-${Date.now()}`,
            estimatedResponseTime: '4 hours',
            status: 'pending',
            method: 'email',
        };
    }

    async checkAvailability(products) {
        // Fortune Energy doesn't have a public availability API
        // Return unknown status — availability confirmed during quoting
        return products.map(p => ({
            sku: `${p.manufacturer}-${p.model}`,
            available: null, // unknown until quote response
            quantity: p.quantity,
            warehouse: null,
            leadTimeDays: null,
            note: 'Availability confirmed during quoting process',
        }));
    }

    /**
     * Format BOM into a structured email for Fortune Energy sales team
     */
    _formatBOMEmail(bom, jobSite) {
        const lines = [
            `MAXIFY PROCUREMENT QUOTE REQUEST`,
            `================================`,
            ``,
            `Job Site: ${jobSite?.address || 'N/A'}`,
            `Date: ${new Date().toISOString().split('T')[0]}`,
            ``,
            `BILL OF MATERIALS:`,
            `------------------`,
        ];

        if (bom.panels?.length) {
            lines.push(`\nSOLAR PANELS:`);
            bom.panels.forEach(p => {
                lines.push(`  ${p.manufacturer} ${p.model} — Qty: ${p.quantity} (${p.watts}W)`);
            });
        }

        if (bom.inverters?.length) {
            lines.push(`\nINVERTERS:`);
            bom.inverters.forEach(p => {
                lines.push(`  ${p.manufacturer} ${p.model} — Qty: ${p.quantity}`);
            });
        }

        if (bom.batteries?.length) {
            lines.push(`\nBATTERIES:`);
            bom.batteries.forEach(p => {
                lines.push(`  ${p.manufacturer} ${p.model} — Qty: ${p.quantity}`);
            });
        }

        if (bom.racking?.length) {
            lines.push(`\nRACKING:`);
            bom.racking.forEach(p => {
                lines.push(`  ${p.manufacturer} ${p.model} — Qty: ${p.quantity} (${p.type})`);
            });
        }

        if (bom.bos?.length) {
            lines.push(`\nBOS (Balance of System):`);
            bom.bos.forEach(p => {
                lines.push(`  ${p.description || p.model} — Qty: ${p.quantity}`);
            });
        }

        lines.push(`\n------------------`);
        lines.push(`Please provide pricing, availability, lead time, and shipping estimate.`);
        lines.push(`Preferred delivery to: ${jobSite?.address || 'TBD'}`);
        lines.push(`\nThis is an automated quote request from the Maxify Procurement Agent.`);
        lines.push(`Reply to this email or use the webhook: POST ${process.env.WEBHOOK_URL || 'TBD'}`);

        return lines.join('\n');
    }
}

module.exports = FortuneEnergyAdapter;
