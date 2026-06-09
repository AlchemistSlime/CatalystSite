// api/loader.js
// При каждом запросе получает актуальный скрипт из admin.js

export default async function handler(req, res) {
  const ua = req.headers['user-agent'] || '';
  if (!ua.includes('Roblox')) {
    return res.status(403).send('Access Denied: Roblox client required');
  }

  try {
    const host = req.headers.host;
    const url = `https://${host}/api/admin?action=loader`;
    const adminRes = await fetch(url);
    const loaderScript = await adminRes.text();

    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    return res.status(200).send(loaderScript);
  } catch (e) {
    // Если admin.js не ответил, отдаём статический скрипт (можно заменить на свой)
    const fallback = `-- Fallback loader (admin unreachable)\nprint("[Catalyst] Admin API unreachable")`;
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    return res.status(200).send(fallback);
  }
}
