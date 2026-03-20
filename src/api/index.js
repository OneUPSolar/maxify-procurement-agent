/**
 * Maxify Procurement Agent — API Server
 * 
 * Express API that handles quote requests, order management,
 * and supplier integrations for the Maxia calculator platform.
 */

require('dotenv').config();

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { createLogger, format, transports } = require('winston');

const app = express();
const PORT = process.env.PORT || 3000;

// Logger
const logger = createLogger({
    level: process.env.LOG_LEVEL || 'info',
    format: format.combine(
        format.timestamp(),
        format.json()
    ),
    transports: [
        new transports.Console({ format: format.combine(format.colorize(), format.simple()) }),
    ],
});

// Middleware
app.use(helmet());
app.use(cors({
    origin: [
        'https://gomaxify.com',
        'https://solar-tech.solarandroof.pro',
        'https://solana.solarandroof.pro',
        'http://localhost:*',
    ],
}));
app.use(express.json({ limit: '10mb' }));

// Rate limiting
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // limit each IP to 100 requests per window
    message: { error: 'Too many requests, please try again later.' },
});
app.use('/api/', limiter);

// Health check
app.get('/health', (req, res) => {
    res.json({ 
        status: 'ok', 
        service: 'maxify-procurement-agent',
        version: require('../../package.json').version,
        timestamp: new Date().toISOString(),
    });
});

// API Routes
// TODO: Import route modules as they are built
// app.use('/api/v1/quotes', require('./routes/quotes'));
// app.use('/api/v1/orders', require('./routes/orders'));
// app.use('/api/v1/suppliers', require('./routes/suppliers'));
// app.use('/api/v1/products', require('./routes/products'));

// Placeholder routes
app.post('/api/v1/quotes/request', (req, res) => {
    const { bom, jobSite, preferences } = req.body;

    if (!bom) {
        return res.status(400).json({ error: 'BOM is required' });
    }

    // TODO: Replace with QuoteEngine.createQuoteRequest()
    res.status(201).json({
        quoteId: `qt_${Date.now()}`,
        status: 'quoting',
        suppliersQueried: 0,
        estimatedCompletionTime: new Date(Date.now() + 4 * 60 * 60 * 1000).toISOString(),
        message: 'Procurement agent is in development. Quote request recorded.',
    });
});

app.get('/api/v1/quotes/:id', (req, res) => {
    res.json({
        quoteId: req.params.id,
        status: 'pending',
        message: 'Procurement agent is in development.',
    });
});

app.get('/api/v1/suppliers', (req, res) => {
    res.json({
        suppliers: [
            { name: 'Fortune Energy', type: 'email', status: 'planned', regions: ['CA', 'AZ', 'TX', 'NJ'] },
            { name: 'Krannich Solar', type: 'portal', status: 'planned', regions: ['TX', 'FL', 'CA', 'NJ'] },
            { name: 'BayWa r.e.', type: 'portal', status: 'planned', regions: ['nationwide'] },
            { name: 'Soligent', type: 'portal', status: 'planned', regions: ['nationwide'] },
            { name: 'GreenTech Renewables', type: 'email', status: 'planned', regions: ['nationwide'] },
            { name: 'RENVU', type: 'ecommerce', status: 'planned', regions: ['nationwide'] },
            { name: 'CivicSolar', type: 'email', status: 'planned', regions: ['nationwide'] },
            { name: 'Wesco', type: 'api', status: 'planned', regions: ['nationwide'] },
        ],
    });
});

app.get('/api/v1/products/search', (req, res) => {
    const { q, category, page = 1, limit = 20 } = req.query;

    // TODO: Query maxia_equipment.db
    res.json({
        results: [],
        total: 0,
        page: parseInt(page),
        limit: parseInt(limit),
        message: 'Connect to maxia_equipment.db (23,704 CEC/NREL records)',
    });
});

// Error handler
app.use((err, req, res, next) => {
    logger.error(err.stack);
    res.status(500).json({ error: 'Internal server error' });
});

// Start server
app.listen(PORT, () => {
    logger.info(`Maxify Procurement Agent API running on port ${PORT}`);
    logger.info(`Health check: http://localhost:${PORT}/health`);
});

module.exports = app;
