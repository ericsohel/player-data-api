const express = require('express');
const { requireLicense } = require('../middleware/license');
const { listPlayers, getPlayerFilters } = require('../controllers/playersController');

const router = express.Router();

router.get('/filters', requireLicense, getPlayerFilters);
router.get('/', requireLicense, listPlayers);

module.exports = router;
