// api/admin.js
// Админ-панель: управление играми, скриптами, статусами, описаниями, логами

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123';

// Хранилище игр
let gamesData = {
  mm2: {
    name: 'Murder Mystery 2',
    description: 'Auto farm, ESP, God mode, instant kill.',
    status: 'Undetected',
  },
  bloxfruits: {
    name: 'Blox Fruits',
    description: 'Auto farm, teleports, devil fruit sniper, raid helper.',
    status: 'On Update',
  },
  adoptme: {
    name: 'Adopt Me',
    description: 'Auto money farm, pet dupe, trade helper.',
    status: 'Undetected',
  },
};

// Хранилище скриптов
let scriptVersions = {
  mm2: {
    free: { current: `print("[Catalyst] MM2 Free loaded!")`, history: [] },
    premium: { current: `print("[Catalyst] MM2 Premium loaded!")`, history: [] },
  },
  bloxfruits: {
    free: { current: `print("[Catalyst] Blox Fruits Free loaded!")`, history: [] },
    premium: { current: `print("[Catalyst] Blox Fruits Premium loaded!")`, history: [] },
  },
  adoptme: {
    free: { current: `print("[Catalyst] Adopt Me Free loaded!")`, history: [] },
    premium: { current: `print("[Catalyst] Adopt Me Premium loaded!")`, history: [] },
  },
};

// Универсальный загрузчик (клиентский скрипт)
let universalLoader = `--[[ Catalyst Universal Loader ]]
local placeId = game.PlaceId
local url = "https://YOUR_DOMAIN/api/loader?placeId="..placeId

-- Premium: url = url .. "&key=YOUR_KEY"
loadstring(game:HttpGet(url))()`;

// Логи запусков и действий админа
let launchLogs = [];
let adminLogs = [];

// ==================== ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ====================

function isAdmin(password) {
  return password === ADMIN_PASSWORD;
}

function addLog(ip, game, tier) {
  launchLogs.push({ timestamp: new Date().toISOString(), ip, game, tier });
}

function addAdminLog(action, details, ip) {
  adminLogs.push({
    timestamp: new Date().toISOString(),
    action,
    details,
    ip,
  });
}

function getPublicStatus() {
  return Object.entries(gamesData).map(([id, data]) => ({
    game: id,
    name: data.name,
    description: data.description,
    status: data.status,
  }));
}

function getScriptCode(game, tier) {
  return scriptVersions[game]?.[tier]?.current || null;
}

function updateScript(game, tier, newCode) {
  if (!scriptVersions[game]?.[tier]) throw new Error('Game or tier not found');
  scriptVersions[game][tier].history.push(scriptVersions[game][tier].current);
  scriptVersions[game][tier].current = newCode;
}

function rollbackScript(game, tier) {
  const entry = scriptVersions[game]?.[tier];
  if (!entry) throw new Error('Game or tier not found');
  if (entry.history.length === 0) throw new Error('No history');
  entry.current = entry.history.pop();
  return entry.current;
}

function updateGameStatus(game, status) {
  if (!['Undetected', 'On Update', 'Patched'].includes(status)) throw new Error('Invalid status');
  if (!gamesData[game]) throw new Error('Game not found');
  gamesData[game].status = status;
}

function updateGameInfo(game, name, description) {
  if (!gamesData[game]) throw new Error('Game not found');
  if (name) gamesData[game].name = name;
  if (description) gamesData[game].description = description;
}

function addGame(gameId, name, description) {
  if (gamesData[gameId]) throw new Error('Game already exists');
  gamesData[gameId] = { name, description, status: 'Undetected' };
  scriptVersions[gameId] = {
    free: { current: `print("[Catalyst] ${name} Free loaded!")`, history: [] },
    premium: { current: `print("[Catalyst] ${name} Premium loaded!")`, history: [] },
  };
}

function deleteGame(gameId) {
  if (!gamesData[gameId]) throw new Error('Game not found');
  delete gamesData[gameId];
  delete scriptVersions[gameId];
}

function updateUniversalLoader(newLoader) {
  universalLoader = newLoader;
}

function getUniversalLoader() {
  return universalLoader;
}

// ==================== ОБРАБОТЧИК ====================

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown';

  try {
    // ========== GET ==========
    if (req.method === 'GET') {
      const { action, password, game, tier } = req.query;

      // Публичный статус
      if (action === 'status') {
        return res.status(200).json({ games: getPublicStatus() });
      }

      // Универсальный загрузчик (публичный)
      if (action === 'loader') {
        res.setHeader('Content-Type', 'text/plain; charset=utf-8');
        return res.status(200).send(getUniversalLoader());
      }

      // Всё ниже требует пароль
      if (!isAdmin(password)) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      if (action === 'logs') {
        return res.status(200).json({ launchLogs, adminLogs });
      }

      if (action === 'getScript') {
        const code = getScriptCode(game, tier);
        if (!code) return res.status(404).json({ error: 'Not found' });
        return res.status(200).json({ game, tier, code });
      }

      if (action === 'getLoader') {
        return res.status(200).json({ loader: getUniversalLoader() });
      }

      if (action === 'getGames') {
        return res.status(200).json({ games: gamesData });
      }

      return res.status(400).json({ error: 'Invalid action' });
    }

    // ========== POST ==========
    if (req.method === 'POST') {
      const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
      const { action, password, game, tier, status, code, name, description, ip, loader } = body;

      // Логирование запусков (без пароля)
      if (action === 'log') {
        if (!game || !ip) return res.status(400).json({ error: 'Missing fields' });
        addLog(ip, game, tier || 'free');
        return res.status(200).json({ success: true });
      }

      // Всё ниже требует пароль
      if (!isAdmin(password)) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      switch (action) {
        case 'updateStatus':
          updateGameStatus(game, status);
          addAdminLog('updateStatus', `Game: ${game}, Status: ${status}`, clientIp);
          return res.status(200).json({ success: true });

        case 'updateGameInfo':
          updateGameInfo(game, name, description);
          addAdminLog('updateGameInfo', `Game: ${game}, Name: ${name}, Desc: ${description}`, clientIp);
          return res.status(200).json({ success: true });

        case 'addGame':
          addGame(game, name, description);
          addAdminLog('addGame', `Game: ${game}, Name: ${name}`, clientIp);
          return res.status(200).json({ success: true });

        case 'deleteGame':
          deleteGame(game);
          addAdminLog('deleteGame', `Game: ${game}`, clientIp);
          return res.status(200).json({ success: true });

        case 'updateScript':
          updateScript(game, tier, code);
          addAdminLog('updateScript', `Game: ${game}, Tier: ${tier}`, clientIp);
          return res.status(200).json({ success: true });

        case 'rollback':
          const restored = rollbackScript(game, tier);
          addAdminLog('rollback', `Game: ${game}, Tier: ${tier}`, clientIp);
          return res.status(200).json({ success: true, code: restored });

        case 'updateLoader':
          updateUniversalLoader(loader);
          addAdminLog('updateLoader', 'Universal loader updated', clientIp);
          return res.status(200).json({ success: true });

        default:
          return res.status(400).json({ error: 'Invalid action' });
      }
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    console.error('Admin error:', error);
    return res.status(500).json({ error: error.message });
  }
}
