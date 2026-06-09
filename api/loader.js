// api/loader.js
// Универсальный загрузчик: сам определяет игру по PlaceId
// Использование: loadstring(game:HttpGet("https://your-domain/api/loader"))()

const GAME_SCRIPTS = {
  mm2: {
    free: `print("[Catalyst] MM2 Free script loaded!")
-- Auto farm, basic ESP`,
    premium: `print("[Catalyst] MM2 Premium script loaded!")
-- Aimbot, ESP, God mode, Instant kill`,
  },
  bloxfruits: {
    free: `print("[Catalyst] Blox Fruits Free script loaded!")
-- Basic auto farm`,
    premium: `print("[Catalyst] Blox Fruits Premium script loaded!")
-- Auto farm, Teleports, Devil fruit sniper, Raid helper`,
  },
  adoptme: {
    free: `print("[Catalyst] Adopt Me Free script loaded!")
-- Basic money farm`,
    premium: `print("[Catalyst] Adopt Me Premium script loaded!")
-- Auto money farm, Pet dupe, Trade helper`,
  },
};

// Маппинг PlaceId → game id (добавляйте свои)
const PLACE_ID_MAP = {
  '142823291': 'mm2',          // MM2
  '2753915549': 'bloxfruits',  // Blox Fruits
  '920587237': 'adoptme',      // Adopt Me
};

function minifyLua(code) {
  return code
    .replace(/--\[\[.*?]]/gs, '')
    .replace(/--.*$/gm, '')
    .replace(/\n\s*\n/g, '\n')
    .replace(/[ \t]+/g, ' ')
    .trim();
}

async function verifySellAuthKey(key) {
  if (!key || !process.env.SELLAUTH_API_TOKEN) return null;
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
    if (data.success && data.license?.product_id === process.env.SELLAUTH_PRODUCT_ID) {
      return 'premium';
    }
    return null;
  } catch (e) {
    console.error('SellAuth error:', e);
    return null;
  }
}

function sendLog(game, tier, ip, host) {
  fetch(`https://${host}/api/admin`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'log', game, tier, ip }),
  }).catch(() => {});
}

export default async function handler(req, res) {
  const ua = req.headers['user-agent'] || '';
  if (!ua.includes('Roblox')) {
    return res.status(403).send('-- Access Denied: Roblox client required');
  }

  const { game: queryGame, tier: queryTier, key, placeId } = req.query;

  // Определяем игру
  let game = queryGame;
  if (!game && placeId) {
    game = PLACE_ID_MAP[placeId] || null;
  }

  if (!game || !GAME_SCRIPTS[game]) {
    return res.status(400).send('-- Error: Unsupported game. PlaceId not recognized.');
  }

  // Определяем тир
  let accessTier = 'free';
  if (queryTier === 'premium' || key) {
    if (!key) {
      return res.status(403).send('-- Error: Premium key required');
    }
    const verified = await verifySellAuthKey(key);
    if (verified !== 'premium') {
      return res.status(403).send('-- Error: Invalid or expired premium key');
    }
    accessTier = 'premium';
  }

  const rawCode = GAME_SCRIPTS[game][accessTier];
  const luaCode = minifyLua(rawCode);

  const clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown';
  sendLog(game, accessTier, clientIp, req.headers.host);

  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  return res.status(200).send(luaCode);
}
