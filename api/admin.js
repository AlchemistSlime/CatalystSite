// api/admin.js
// Админ-панель Catalyst Hub

const ADMIN_PASSWORD = 'admin123';

let launchLogs = [];
let adminLogs = [];

function isAdmin(p) { return p === ADMIN_PASSWORD; }

function addLog(game, gameName, ip) {
  launchLogs.push({ timestamp: new Date().toISOString(), ip, game, gameName: gameName || '' });
}

function addAdminLog(action, details, ip) {
  adminLogs.push({ timestamp: new Date().toISOString(), action, details, ip });
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown';

  try {
    const loaderModule = await import('./loader.js');

    if (req.method === 'GET') {
      const { action, password } = req.query;

      if (action === 'status') {
        const games = loaderModule.getGamesInfo();
        return res.status(200).json({ games: Object.entries(games).map(([id, d]) => ({ game: id, ...d })) });
      }

      if (action === 'loader') {
        res.setHeader('Content-Type', 'text/plain; charset=utf-8');
        return res.status(200).send(loaderModule.getLoaderScript());
      }

      if (action === 'stats') {
        const stats = loaderModule.getStats();
        return res.status(200).json(stats);
      }

      if (!isAdmin(password)) return res.status(401).json({ error: 'Unauthorized' });

      if (action === 'logs') return res.status(200).json({ launchLogs, adminLogs });
      if (action === 'getGames') return res.status(200).json({ games: loaderModule.getGamesInfo() });
      if (action === 'activeUsers') {
        const stats = loaderModule.getStats();
        return res.status(200).json({ users: stats.activeUsersList || [] });
      }

      return res.status(400).json({ error: 'Invalid action' });
    }

    if (req.method === 'POST') {
      const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
      const { action, password, game, name, status, url, loaderScript, ip, gameName } = body;

      if (action === 'log') {
        addLog(game, gameName, ip);
        return res.status(200).json({ success: true });
      }

      if (!isAdmin(password)) return res.status(401).json({ error: 'Unauthorized' });

      switch (action) {
        case 'updateGame':
          loaderModule.updateGameInfo(game, { name, status });
          addAdminLog('updateGame', `${game}: name=${name}, status=${status}`, clientIp);
          return res.status(200).json({ success: true });

        case 'addGame':
          loaderModule.addGameInfo(game, name, status);
          addAdminLog('addGame', `${game}: ${name}`, clientIp);
          return res.status(200).json({ success: true });

        case 'deleteGame':
          loaderModule.deleteGameInfo(game);
          addAdminLog('deleteGame', game, clientIp);
          return res.status(200).json({ success: true });

        case 'updateLoader':
          const ok = loaderModule.updateLoaderScript(loaderScript);
          if (ok) {
            addAdminLog('updateLoader', 'Loader updated', clientIp);
            return res.status(200).json({ success: true });
          }
          return res.status(400).json({ error: 'Empty loader' });

        default:
          return res.status(400).json({ error: 'Invalid action' });
      }
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
