// routes/supplierRoutes.js
const express = require('express');
const router = express.Router();
const supplierController = require('../controllers/supplierController');

// Supplier search API
router.post('/search', supplierController.searchSuppliers);

module.exports = router;
