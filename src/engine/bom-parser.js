/**
 * BOM Parser — Parse and validate BOMs from the Maxia Calculator
 * 
 * Matches BOM line items against the maxia_equipment.db (23,704 CEC/NREL records)
 * to ensure valid products and fill in missing specs.
 */

class BOMParser {
    constructor({ equipmentDb, logger }) {
        this.db = equipmentDb; // better-sqlite3 instance for maxia_equipment.db
        this.logger = logger || console;
    }

    /**
     * Parse and validate a BOM from Maxia calculator
     * @param {Object} rawBom - Raw BOM from Maxia API
     * @returns {Object} - Validated and enriched BOM
     */
    parse(rawBom) {
        const validated = {
            panels: this._validateCategory(rawBom.panels || [], 'panel'),
            inverters: this._validateCategory(rawBom.inverters || [], 'inverter'),
            batteries: this._validateCategory(rawBom.batteries || [], 'battery'),
            racking: rawBom.racking || [],
            bos: rawBom.bos || [],
            metadata: {
                totalWatts: 0,
                panelCount: 0,
                inverterCount: 0,
                batteryCount: 0,
                parsedAt: new Date().toISOString(),
            },
        };

        // Calculate metadata
        validated.metadata.panelCount = validated.panels.reduce((sum, p) => sum + p.quantity, 0);
        validated.metadata.totalWatts = validated.panels.reduce((sum, p) => sum + (p.watts || 0) * p.quantity, 0);
        validated.metadata.inverterCount = validated.inverters.reduce((sum, p) => sum + p.quantity, 0);
        validated.metadata.batteryCount = validated.batteries.reduce((sum, p) => sum + p.quantity, 0);

        this.logger.info(
            `[BOMParser] Parsed BOM: ${validated.metadata.totalWatts}W system, ` +
            `${validated.metadata.panelCount} panels, ` +
            `${validated.metadata.inverterCount} inverters, ` +
            `${validated.metadata.batteryCount} batteries`
        );

        return validated;
    }

    /**
     * Validate and enrich BOM items against equipment database
     */
    _validateCategory(items, category) {
        return items.map(item => {
            // Try to match against equipment database
            const match = this._findInDatabase(item, category);

            if (match) {
                return {
                    ...item,
                    cecListed: true,
                    dbId: match.id,
                    manufacturer: match.manufacturer || item.manufacturer,
                    model: match.model || item.model,
                    watts: match.watts || item.watts,
                    specs: match.specs || {},
                };
            }

            // No match — still valid, just not CEC-listed
            this.logger.warn(
                `[BOMParser] No CEC match for ${item.manufacturer} ${item.model} (${category})`
            );

            return {
                ...item,
                cecListed: false,
                dbId: null,
            };
        });
    }

    /**
     * Search equipment database for a matching product
     */
    _findInDatabase(item, category) {
        if (!this.db) return null;

        try {
            // Try exact model match first
            const exactMatch = this.db.prepare(
                `SELECT * FROM equipment WHERE model = ? AND category = ? LIMIT 1`
            ).get(item.model, category);

            if (exactMatch) return exactMatch;

            // Try fuzzy match on manufacturer + partial model
            const fuzzyMatch = this.db.prepare(
                `SELECT * FROM equipment 
                 WHERE manufacturer LIKE ? AND model LIKE ? AND category = ? 
                 LIMIT 1`
            ).get(`%${item.manufacturer}%`, `%${item.model?.split('-')[0]}%`, category);

            return fuzzyMatch || null;
        } catch (error) {
            this.logger.error(`[BOMParser] DB lookup error: ${error.message}`);
            return null;
        }
    }

    /**
     * Find equivalent alternatives for a product (for BOM optimization)
     * @param {Object} product - Product to find alternatives for
     * @param {string} category - Product category
     * @returns {Array} - Up to 5 alternatives sorted by relevance
     */
    findAlternatives(product, category) {
        if (!this.db) return [];

        try {
            const watts = product.watts || 0;
            const tolerance = watts * 0.05; // 5% tolerance

            const alternatives = this.db.prepare(
                `SELECT * FROM equipment 
                 WHERE category = ? 
                 AND watts BETWEEN ? AND ?
                 AND manufacturer != ?
                 ORDER BY ABS(watts - ?) ASC
                 LIMIT 5`
            ).all(category, watts - tolerance, watts + tolerance, product.manufacturer, watts);

            return alternatives;
        } catch (error) {
            this.logger.error(`[BOMParser] Alternative lookup error: ${error.message}`);
            return [];
        }
    }
}

module.exports = BOMParser;
