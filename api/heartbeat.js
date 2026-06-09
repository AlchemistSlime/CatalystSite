// api/heartbeat.js
// Лёгкий heartbeat для статистики и онлайна

// Хранилище активных пользователей
let activeUsers = new Map();

// Удаляем неактивных (нет пинга > 2 минут)
setInterval(() => {
  const now = Date.now();
  for (const [userId, data] of activeUsers) {
    if (now - data.lastPing > 120000) {
      activeUsers.delete(userId);
    }
  }
}, 30000);

// Вспомогательные функции для админки
export function getActiveUsers() {
  const users = [];
  for (const [userId, data] of activeUsers) {
    users.push({
      userId,
      placeId: data.placeId,
      gameName: data.gameName,
      rank: data.rank,
      keyType: data.keyType,
      lastPing: data.lastPing,
    });
  }
  return users;
}

export function getOnlineCount() {
  return activeUsers.size;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { action, userId, placeId, gameName, rank, keyType } = req.query;

  try {
    // Запуск или пинг от клиента
    if (action === 'start' || action === 'ping') {
      if (!userId) return res.status(400).send('missing userId');

      activeUsers.set(userId, {
        placeId: placeId || 'unknown',
        gameName: gameName || 'Unknown Game',
        rank: rank || 'Standard',
        keyType: keyType || 'Free',
        lastPing: Date.now(),
      });

      return res.status(200).send('ok');
    }

    // Получить список активных (для админки)
    if (action === 'list') {
      const users = getActiveUsers();
      return res.status(200).json({ users, count: users.length });
    }

    return res.status(400).send('Invalid action');
  } catch (e) {
    return res.status(500).send('error');
  }
}
