// api/heartbeat.js
// Heartbeat эндпоинт — скрипты сообщают "я жив"

export default async function handler(req, res) {
  const { userId, placeId, status, keyType, rank } = req.query;

  if (!userId) {
    return res.status(400).send('missing userId');
  }

  try {
    // Импортируем loader.js для доступа к stats
    const loaderModule = await import('./loader.js');
    const stats = loaderModule.getStats();

    // Обновляем heartbeat пользователя
    stats.activeUsers.set(userId, {
      placeId: placeId || 'unknown',
      gameName: 'Unknown',
      rank: rank || 'Standard',
      keyType: keyType || 'Free',
      lastHeartbeat: Date.now(),
    });

    // Считаем по играм
    if (placeId) {
      stats.loadsByGame[placeId] = (stats.loadsByGame[placeId] || 0) + 1;
    }

    // Считаем по рангам
    if (rank) {
      stats.loadsByRank[rank] = (stats.loadsByRank[rank] || 0) + 1;
    }

    // Отвечаем "keep alive"
    res.setHeader('Content-Type', 'text/plain');
    return res.status(200).send('keep alive');
  } catch (e) {
    console.error('Heartbeat error:', e);
    return res.status(500).send('error');
  }
}
