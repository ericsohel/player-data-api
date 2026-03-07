const {
  loadPlayers,
  buildPlayersQuery,
  applyPlayersQuery,
  getPlayerFilterOptions,
} = require('../services/playersService');

function listPlayers(req, res) {
  const players = loadPlayers();
  const query = buildPlayersQuery(req.query || {});
  const result = applyPlayersQuery(players, query);
  res.json({ success: true, ...result });
}

function getPlayerFilters(_req, res) {
  const players = loadPlayers();
  const filters = getPlayerFilterOptions(players);
  res.json({ success: true, filters });
}

module.exports = {
  listPlayers,
  getPlayerFilters,
};
