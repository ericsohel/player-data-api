const express = require('express');
const router = express.Router();

router.get('/', (_req, res) => {
  res.json({ success: true, status: 'ok', service: 'player-data-api' });
});

module.exports = router;
