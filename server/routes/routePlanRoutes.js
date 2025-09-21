const express = require('express');
const router = express.Router();
const { computeRoute } = require('../controllers/routePlanController');
// Auth could be added if needed
router.post('/', computeRoute);
module.exports = router;