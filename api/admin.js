// api/admin.js
// Админ-панель для управления статусами, скриптами и просмотра логов

const ADMIN_PASSWORD = 'admin123';

const gameStatuses = {
  mm2: 'Undetected',
  bloxfruits: 'On Update',
  adoptme: 'Undetected',
};

const scriptVersions = {
  mm2: {
    free: {
      current: `print("[Catalyst] MM2 Free script loaded!")\n-- Auto farm, basic ESP`,
      history: [],
    },
    premium: {
      current: `print("[Catalyst] MM2 Premium script loaded!")\n-- Aimbot, ESP, God mode, Instant kill`,
      history: [],
    },
  },
  bloxfruits: {
    free: {
      current: `print("[Catalyst] Blox Fruits Free script loaded!")\n-- Basic auto farm`,
      history: [],
    },
    premium: {
      current: `print("[Catalyst] Blox Fruits Premium script loaded!")\n-- Auto farm, Teleports, Devil fruit sniper, Raid helper`,
      history: [],
    },
  },
  adoptme: {
    free: {
      current: `print("[Catalyst] Adopt Me Free script loaded!")\n-- Basic money farm`,
      history: [],
    },
    premium: {
      current: `print("[Catalyst] Adopt Me Premium script loaded!")\n-- Auto money farm, Pet dupe, Trade helper`,
      history: [],
    },
  },
};

const launchLogs = [];

function isAdminAuthorized(password) {
  return password === ADMIN_PASSWORD;
}

function addLog(ip, game, tier) {
  launchLogs.push({
    timestamp: new Date().toISOString(),
    ip,
    game,
    tier,
  });
}

function updateGameStatus(game, status) {
  if (!['Undetected', 'On Update', 'Patched'].includes(status)) {
    throw new Error('Invalid status');
  }
  if (!gameStatuses.hasOwnProperty(game)) {
    throw new Error('Game not found');
  }
  gameStatuses[game] = status;
  return gameStatuses[game];
}

function updateScript(game, tier, newCode) {
  if (!scriptVersions[game] || !scriptVersions[game][tier]) {
    throw new Error('Game or tier not found');
  }
  const entry = scriptVersions[game][tier];
  entry.history.push(entry.current);
  entry.current = newCode;
  return entry.current;
}

function rollbackScript(game, tier) {
  const entry = scriptVersions[game]?.[tier];
  if (!entry) throw new Error('Game or tier not found');
  if (entry.history.length === 0) throw new Error('No previous version to rollback');

  const previous = entry.history.pop();
  entry.current = previous;
  return entry.current;
}

function getPublicStatus() {
  return Object.entries(gameStatuses).map(([game, status]) => ({ game, status }));
}

function getLogs() {
  return launchLogs;
}

function getScriptCode(game, tier) {
  if (scriptVersions[game] && scriptVersions[game][tier]) {
    return scriptVersions[game][tier].current;
  }
  return null;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    if (req.method === 'GET') {
      const { action, password, game, tier } = req.query;

      if (action === 'status') {
        const statuses = getPublicStatus();
        return res.status(200).json({ games: statuses });
      }

      if (action === 'logs') {
        if (!isAdminAuthorized(password)) {
          return res.status(401).json({ error: 'Unauthorized' });
        }
        const logs = getLogs();
        return res.status(200).json({ logs });
      }

      if (action === 'getScript') {
        if (!isAdminAuthorized(password)) {
          return res.status(401).json({ error: 'Unauthorized' });
        }
        if (!game || !tier) {
          return res.status(400).json({ error: 'Missing game or tier' });
        }
        const code = getScriptCode(game, tier);
        if (code === null) {
          return res.status(404).json({ error: 'Script not found' });
        }
        return res.status(200).json({ game, tier, code });
      }

      return res.status(400).json({ error: 'Invalid action' });
    }

    if (req.method === 'POST') {
      const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
      const { action, password, game, tier, status, code, ip } = body;

      if (action === 'log') {
        if (!game || !ip) {
          return res.status(400).json({ error: 'Missing game or ip' });
        }
        addLog(ip, game, tier || 'free');
        return res.status(200).json({ success: true });
      }

      if (!isAdminAuthorized(password)) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      if (action === 'updateStatus') {
        if (!game || !status) {
          return res.status(400).json({ error: 'Missing game or status' });
        }
        const newStatus = updateGameStatus(game, status);
        return res.status(200).json({ success: true, game, status: newStatus });
      }

      if (action === 'updateScript') {
        if (!game || !tier || !code) {
          return res.status(400).json({ error: 'Missing game, tier or code' });
        }
        const newCode = updateScript(game, tier, code);
        return res.status(200).json({ success: true, game, tier, code: newCode });
      }

      if (action === 'rollback') {
        if (!game || !tier) {
          return res.status(400).json({ error: 'Missing game or tier' });
        }
        const restoredCode = rollbackScript(game, tier);
        return res.status(200).json({ success: true, game, tier, code: restoredCode });
      }

      return res.status(400).json({ error: 'Invalid action' });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    console.error('Admin error:', error);
    return res.status(500).json({ error: error.message });
  }
}
