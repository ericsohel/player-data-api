const express = require('express');
const fs = require('fs');
const path = require('path');
const { requireLicense } = require('../middleware/license');

const playersPath = path.join(__dirname, '..', '..', 'data', 'players.json');
const fallbackPlayers = require('../../data/players');
function getPlayers() {
  try {
    if (fs.existsSync(playersPath)) {
      return JSON.parse(fs.readFileSync(playersPath, 'utf8'));
    }
  } catch (_) {}
  return fallbackPlayers;
}

const router = express.Router();

router.get('/', requireLicense, (req, res) => {
  let result = [...getPlayers()];
  const { search, team, position, limit, offset } = req.query;

  if (search) {
    const s = search.toLowerCase();
    result = result.filter(
      (p) =>
        p.playerName.toLowerCase().includes(s) ||
        (p.team && p.team.toLowerCase().includes(s)) ||
        (p.position && p.position.toLowerCase().includes(s))
    );
  }
  if (team) {
    const t = team.toUpperCase();
    result = result.filter((p) => p.team === t);
  }
  if (position) {
    const pos = position.toUpperCase();
    result = result.filter((p) => p.position === pos || (p.position && p.position.includes(pos)));
  }

  const total = result.length;
  const off = Math.max(0, parseInt(offset, 10) || 0);
  const lim = Math.min(100, Math.max(1, parseInt(limit, 10) || 50));
  const page = result.slice(off, off + lim);

  res.json({ success: true, players: page, total });
});

module.exports = router;
