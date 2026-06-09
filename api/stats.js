// api/stats.js
// Публичная статистика для index.html

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 'no-cache');

  try {
    const loaderModule = await import('./loader.js');
    const stats = loaderModule.getStats();
    const games = loaderModule.getGamesInfo();

    const response = {
      totalLoads: stats.totalLoads,
      activeUsers: stats.activeUsers,
      loadsByGame: Object.entries(stats.loadsByGame).map(([placeId, count]) => ({
        placeId,
        name: games[placeId]?.name || 'Unknown',
        count,
      })),
      loadsByRank: stats.loadsByRank,
      games: Object.entries(games).map(([id, data]) => ({
        id,
        ...data,
      })),
    };

    return res.status(200).json(response);
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
