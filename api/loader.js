// api/loader.js
// Serverless функция для выдачи Lua-скриптов клиентам Roblox

// --- Заглушка для хранения скриптов (в реальном проекте – база данных) ---
// ВНИМАНИЕ: память живёт только пока "тёплая" функция, после холодного старта сбросится.
// Для продакшена используйте внешнее хранилище (Vercel KV, MongoDB и т.п.)
const GAME_SCRIPTS = {
  mm2: {
    free: `print("[Catalyst] MM2 Free script loaded!")`,
    premium: `print("[Catalyst] MM2 Premium script loaded! Features: Aimbot, ESP")`,
  },
  bloxfruits: {
    free: `print("[Catalyst] Blox Fruits Free script loaded!")`,
    premium: `print("[Catalyst] Blox Fruits Premium script loaded! Auto Farm, Teleports")`,
  },
  // Добавляйте другие игры по аналогии
};

// --- Простейший минификатор Lua ---
function minifyLua(code) {
  // Удаляем однострочные комментарии (--) и многострочные (--[[ ... ]])
  let minified = code
    .replace(/--\[\[.*?]]/gs, '')   // многострочные
    .replace(/--.*$/gm, '')         // однострочные
    .replace(/\n\s*\n/g, '\n')      // пустые строки
    .replace(/[ \t]+/g, ' ')        // лишние пробелы
    .trim();
  return minified;
}

// --- Проверка Premium-ключа через SellAuth API ---
async function verifySellAuthKey(key) {
  try {
    const response = await fetch('https://sellauth.com/api/v1/licenses/verify', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.SELLAUTH_API_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ license_key: key }),
    });

    if (!response.ok) return null;

    const data = await response.json();
    // Успешная лицензия и совпадает ID продукта Premium
    if (data.success && data.license?.product_id === process.env.SELLAUTH_PRODUCT_ID) {
      return 'premium';
    }
    return null;
  } catch (e) {
    console.error('SellAuth verification error:', e);
    return null;
  }
}

// --- Отправка лога в админ-панель (fire-and-forget) ---
function sendLog(game, tier, ip, host) {
  const url = `https://${host}/api/admin`;
  const body = JSON.stringify({
    action: 'log',
    game,
    tier,
    ip,
  });

  // Не ждём ответа, чтобы не задерживать загрузку скрипта
  fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body,
  }).catch(() => {});
}

export default async function handler(req, res) {
  // 1. Проверка User-Agent (только Roblox)
  const ua = req.headers['user-agent'] || '';
  if (!ua.includes('Roblox')) {
    return res.status(403).send('Access Denied: Roblox client required');
  }

  // 2. Параметры запроса
  const { game, tier = 'free', key } = req.query;

  if (!game || !GAME_SCRIPTS[game]) {
    return res.status(400).send('Invalid or missing game parameter');
  }

  // 3. Определение уровня доступа
  let accessTier = 'free';
  if (tier === 'premium') {
    if (!key) {
      return res.status(403).send('Premium key required');
    }
    const verifiedTier = await verifySellAuthKey(key);
    if (verifiedTier !== 'premium') {
      return res.status(403).send('Invalid or expired premium key');
    }
    accessTier = 'premium';
  }

  // 4. Получаем и минифицируем скрипт
  const rawCode = GAME_SCRIPTS[game][accessTier];
  const luaCode = minifyLua(rawCode);

  // 5. Отправляем лог (не ждём)
  const clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown';
  sendLog(game, accessTier, clientIp, req.headers.host);

  // 6. Ответ
  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  return res.status(200).send(luaCode);
}
