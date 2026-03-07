#!/usr/bin/env node
/**
 * Convert NL stats CSV to data/players.json for the API.
 * Usage: node scripts/csv-to-players.js [path-to-csv]
 *   Default CSV: data/2025-player-NL-stats.csv (or 3Year-average-NL-stats.csv / projections-NL.csv)
 *
 * CSV columns: Player,AB,R,H,1B,2B,3B,HR,RBI,BB,K,SB,CS,AVG,OBP,SLG,FPTS
 * Player format: "Name Position | TEAM" or Name Position | TEAM
 */
const fs = require('fs');
const path = require('path');

const csvPath = process.argv[2] || path.join(__dirname, '..', 'data', '2025-player-NL-stats.csv');
const outPath = path.join(__dirname, '..', 'data', 'players.json');

function parsePlayerField(raw) {
  // "Juan Soto OF | NYM" or "Shohei Ohtani U,P | LAD " -> name, position, team
  const s = raw.trim();
  const pipe = s.lastIndexOf(' | ');
  if (pipe === -1) return { playerName: s, position: '', team: '' };
  const team = s.slice(pipe + 3).trim();
  const nameAndPos = s.slice(0, pipe).trim();
  const knownPositions = ['U,P', '1B', '2B', '3B', 'SS', 'OF', 'C', 'DH', 'P'];
  let position = '';
  let playerName = nameAndPos;
  for (const pos of knownPositions) {
    const suffix = ' ' + pos;
    if (nameAndPos.endsWith(suffix)) {
      position = pos;
      playerName = nameAndPos.slice(0, -suffix.length).trim();
      break;
    }
  }
  if (!position && nameAndPos.includes(' ')) {
    const last = nameAndPos.split(/\s+/).pop();
    if (last.length <= 4) {
      position = last;
      playerName = nameAndPos.slice(0, nameAndPos.length - last.length).trim();
    }
  }
  return { playerName, position, team };
}

function slug(name) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

function parseLine(line) {
  let playerRaw;
  let restStr;
  if (line.startsWith('"')) {
    const end = line.indexOf('",');
    if (end === -1) return null;
    playerRaw = line.slice(1, end).replace(/""/g, '"');
    restStr = line.slice(end + 2);
  } else {
    const idx = line.indexOf(',');
    if (idx === -1) return null;
    playerRaw = line.slice(0, idx);
    restStr = line.slice(idx + 1);
  }
  const rest = restStr.split(',').map((x) => x.trim());
  if (rest.length < 16) return null;
  const num = (i) => {
    const v = rest[i];
    if (v === '' || v == null) return 0;
    const n = parseFloat(v);
    return Number.isFinite(n) ? n : 0;
  };
  const { playerName, position, team } = parsePlayerField(playerRaw);
  const id = slug(playerName) || 'p-' + Math.random().toString(36).slice(2, 9);
  return {
    id,
    playerName,
    team,
    position,
    ab: num(0),
    r: num(1),
    h: num(2),
    hr: num(6),
    rbi: num(7),
    bb: num(8),
    k: num(9),
    sb: num(10),
    avg: num(12),
    obp: num(13),
    slg: num(14),
    fpts: num(15),
  };
}

const csv = fs.readFileSync(csvPath, 'utf8');
const lines = csv.split(/\r?\n/).filter((l) => l.trim());
const header = lines[0];
if (!header.startsWith('Player')) {
  console.error('Expected CSV header starting with Player. Got:', header.slice(0, 50));
  process.exit(1);
}
const players = [];
for (let i = 1; i < lines.length; i++) {
  const row = parseLine(lines[i]);
  if (row && row.playerName) players.push(row);
}
// Dedupe by id (same name)
const seen = new Set();
const unique = players.filter((p) => {
  let id = p.id;
  let n = 0;
  while (seen.has(id)) id = p.id + '-' + (++n);
  seen.add(id);
  p.id = id;
  return true;
});
fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, JSON.stringify(unique, null, 0), 'utf8');
console.log('Wrote', unique.length, 'players to', outPath);
