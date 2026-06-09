// api/admin.js
// Админ-панель: управление играми, загрузчиком, логами

const ADMIN_PASSWORD = 'admin123';

// Импортируем функции из loader.js (работает в Vercel serverless)
let loaderModule = null;
async function getLoaderModule() {
  if (!loaderModule) {
    loaderModule = await import('./loader.js');
  }
  return loaderModule;
}

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
  const loader = await getLoaderModule();

  try {
    // ========== GET ==========
    if (req.method === 'GET') {
      const { action, password } = req.query;

      // Публичные эндпоинты
      if (action === 'status') {
        const scripts = loader.getGameScripts();
        return res.status(200).json({
          games: Object.entries(scripts).map(([id, data]) => ({
            game: id,
            name: data.name,
            url: data.url,
            status: data.status,
          })),
        });
      }

      if (action === 'loader') {
        res.setHeader('Content-Type', 'text/plain; charset=utf-8');
        return res.status(200).send(loader.getLoaderScript());
      }

      // Требуют пароль
      if (!isAdmin(password)) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      if (action === 'logs') {
        return res.status(200).json({ launchLogs, adminLogs });
      }

      if (action === 'getGames') {
        return res.status(200).json({ games: loader.getGameScripts() });
      }

      return res.status(400).json({ error: 'Invalid action' });
    }

    // ========== POST ==========
    if (req.method === 'POST') {
      const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
      const { action, password, game, name, url, status, loaderScript, ip, gameName } = body;

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
          loader.updateGameScript(game, url, name, status);
          addAdminLog('updateGame', `Game: ${game}, Name: ${name}, URL: ${url}, Status: ${status}`, clientIp);
          return res.status(200).json({ success: true });

        case 'addGame':
          loader.addGameScript(game, name, url, status);
          addAdminLog('addGame', `Game: ${game}, Name: ${name}`, clientIp);
          return res.status(200).json({ success: true });

        case 'deleteGame':
          loader.deleteGameScript(game);
          addAdminLog('deleteGame', `Game: ${game}`, clientIp);
          return res.status(200).json({ success: true });

        case 'updateLoader':
          loader.updateLoaderScript(loaderScript);
          addAdminLog('updateLoader', 'Universal loader updated', clientIp);
          return res.status(200).json({ success: true });

        case 'getLoader':
          return res.status(200).json({ loader: loader.getLoaderScript() });

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
