// api/admin.js
// Админ-панель для управления статусами, скриптами и просмотра логов.
// Все данные хранятся в оперативной памяти (только пока инстанс жив).
// Для продакшена замените на Vercel KV / базу данных.

// --- Хранилище (in-memory) ---
const gameStatuses = {
  mm2: 'Undetected',
  bloxfruits: 'On Update',
};

// Версионирование: для каждой игры храним текущий код и историю
const scriptVersions = {
  mm2: {
    free: {
      current: `print("[Catalyst] MM2 Free script loaded!")`,
      history: [],
    },
    premium: {
      current: `print("[Catalyst] MM2 Premium script loaded! Features: Aimbot, ESP")`,
      history: [],
    },
  },
  bloxfruits: {
    free: {
      current: `print("[Catalyst] Blox Fruits Free script loaded!")`,
      history: [],
    },
    premium: {
      current: `print("[Catalyst] Blox Fruits Premium script loaded! Auto Farm, Teleports")`,
      history: [],
    },
  },
};

// Логи запусков
const launchLogs = [];

// --- Вспомогательные функции ---

// Проверка пароля администратора
function isAdminAuthorized(password) {
  return password === process.env.ADMIN_PASSWORD;
}

// Добавление записи в лог
function addLog(ip, game, tier) {
  launchLogs.push({
    timestamp: new Date().toISOString(),
    ip,
    game,
    tier,
  });
}

// Получение текущего скрипта для игры и уровня доступа
function getCurrentScript(game, tier) {
  if (scriptVersions[game] && scriptVersions[game][tier]) {
    return scriptVersions[game][tier].current;
  }
  return null;
}

// Обновление статуса игры
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

// Обновление скрипта (с сохранением истории)
function updateScript(game, tier, newCode) {
  if (!scriptVersions[game] || !scriptVersions[game][tier]) {
    throw new Error('Game or tier not found');
  }
  const entry = scriptVersions[game][tier];
  entry.history.push(entry.current);
  entry.current = newCode;
  return entry.current;
}

// Откат на предыдущую версию
function rollbackScript(game, tier) {
  const entry = scriptVersions[game]?.[tier];
  if (!entry) throw new Error('Game or tier not found');
  if (entry.history.length === 0) throw new Error('No previous version to rollback');

  const previous = entry.history.pop();
  entry.current = previous;
  return entry.current;
}

// Получение публичного статуса игр
function getPublicStatus() {
  return Object.entries(gameStatuses).map(([game, status]) => ({ game, status }));
}

// Получение логов (только для админа)
function getLogs() {
  return launchLogs;
}

export default async function handler(req, res) {
  // CORS для удобства (можно убрать, если фронтенд на том же домене)
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    // --- GET запросы ---
    if (req.method === 'GET') {
      const { action } = req.query;

      // Публичный статус игр (без авторизации)
      if (action === 'status') {
        const statuses = getPublicStatus();
        return res.status(200).json({ games: statuses });
      }

      // Просмотр логов (требуется пароль)
      if (action === 'logs') {
        const { password } = req.query;
        if (!isAdminAuthorized(password)) {
          return res.status(401).json({ error: 'Unauthorized' });
        }
        const logs = getLogs();
        return res.status(200).json({ logs });
      }

      return res.status(400).json({ error: 'Invalid action' });
    }

    // --- POST запросы ---
    if (req.method === 'POST') {
      const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
      const { action, password, game, tier, status, code, ip } = body;

      // Логирование запусков (без авторизации, вызывается из loader.js)
      if (action === 'log') {
        if (!game || !ip) {
          return res.status(400).json({ error: 'Missing game or ip' });
        }
        addLog(ip, game, tier || 'free');
        return res.status(200).json({ success: true });
      }

      // Все остальные действия требуют пароль
      if (!isAdminAuthorized(password)) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      // Обновление статуса игры
      if (action === 'updateStatus') {
        if (!game || !status) {
          return res.status(400).json({ error: 'Missing game or status' });
        }
        const newStatus = updateGameStatus(game, status);
        return res.status(200).json({ success: true, game, status: newStatus });
      }

      // Обновление скрипта
      if (action === 'updateScript') {
        if (!game || !tier || !code) {
          return res.status(400).json({ error: 'Missing game, tier or code' });
        }
        const newCode = updateScript(game, tier, code);
        return res.status(200).json({ success: true, game, tier, code: newCode });
      }

      // Откат версии
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
