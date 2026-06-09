// api/admin.js
// Админ-панель Catalyst Hub

const ADMIN_PASSWORD = 'admin123';

// Логи
let launchLogs = [];
let adminLogs = [];

function isAdmin(p) {
  return p === ADMIN_PASSWORD;
}

function addLog(game, gameName, ip) {
  launchLogs.push({
    timestamp: new Date().toISOString(),
    ip,
    game,
    gameName: gameName || '',
  });
}

function addAdminLog(action, details, ip) {
  adminLogs.push({
    timestamp: new Date().toISOString(),
    action,
    details,
    ip,
  });
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown';

  try {
    // Динамический импорт loader.js
    const loaderModule = await import('./loader.js');

    // ========== GET ==========
    if (req.method === 'GET') {
      const { action, password } = req.query;

      // Публичные эндпоинты
      if (action === 'status') {
        const games = loaderModule.getGamesInfo();
        return res.status(200).json({
          games: Object.entries(games).map(([id, data]) => ({
            game: id,
            ...data,
          })),
        });
      }

      if (action === 'loader') {
        // Отдаём текущий загрузчик (публично)
        res.setHeader('Content-Type', 'text/plain; charset=utf-8');
        return res.status(200).send(loaderModule.getLoaderScript());
      }

      // Требуют пароль
      if (!isAdmin(password)) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      if (action === 'logs') {
        return res.status(200).json({ launchLogs, adminLogs });
      }

      if (action === 'getGames') {
        return res.status(200).json({ games: loaderModule.getGamesInfo() });
      }

      return res.status(400).json({ error: 'Invalid action' });
    }

    // ========== POST ==========
    if (req.method === 'POST') {
      const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
      const { action, password, game, name, status, loaderScript, ip, gameName } = body;

      // Логирование запусков (без пароля)
      if (action === 'log') {
        addLog(game, gameName, ip);
        return res.status(200).json({ success: true });
      }

      // Требуют пароль
      if (!isAdmin(password)) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      switch (action) {
        case 'updateGame':
          loaderModule.updateGameInfo(game, { name, status });
          addAdminLog('updateGame', `Game: ${game}, Name: ${name}, Status: ${status}`, clientIp);
          return res.status(200).json({ success: true });

        case 'addGame':
          loaderModule.addGameInfo(game, name, status);
          addAdminLog('addGame', `Game: ${game}, Name: ${name}`, clientIp);
          return res.status(200).json({ success: true });

        case 'deleteGame':
          loaderModule.deleteGameInfo(game);
          addAdminLog('deleteGame', `Game: ${game}`, clientIp);
          return res.status(200).json({ success: true });

        case 'updateLoader':
          const updated = loaderModule.updateLoaderScript(loaderScript);
          if (updated) {
            addAdminLog('updateLoader', 'Universal loader updated', clientIp);
            return res.status(200).json({ success: true });
          }
          return res.status(400).json({ error: 'Empty loader script' });

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
