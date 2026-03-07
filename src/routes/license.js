const express = require('express');
const { requireLicense } = require('../middleware/license');
const router = express.Router();

router.get('/check', requireLicense, (_req, res) => {
  res.json({ success: true, message: 'License valid' });
});

module.exports = router;
