// api/loader.js
// Serverless функция для выдачи Lua-скриптов клиентам Roblox

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

function minifyLua(code) {
  let minified = code
    .replace(/--\[\[.*?]]/gs, '')
    .replace(/--.*$/gm, '')
    .replace(/\n\s*\n/g, '\n')
    .replace(/[ \t]+/g, ' ')
    .trim();
  return minified;
}

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
    if (data.success && data.license?.product_id === process.env.SELLAUTH_PRODUCT_ID) {
      return 'premium';
    }
    return null;
  } catch (e) {
    console.error('SellAuth verification error:', e);
    return null;
  }
}

function sendLog(game, tier, ip, host) {
  const url = `https://${host}/api/admin`;
  const body = JSON.stringify({
    action: 'log',
    game,
    tier,
    ip,
  });

  fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body,
  }).catch(() => {});
}

export default async function handler(req, res) {
  const ua = req.headers['user-agent'] || '';
  if (!ua.includes('Roblox')) {
    return res.status(403).send('Access Denied: Roblox client required');
  }

  const { game, tier = 'free', key } = req.query;

  if (!game || !GAME_SCRIPTS[game]) {
    return res.status(400).send('Invalid or missing game parameter');
  }

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

  const rawCode = GAME_SCRIPTS[game][accessTier];
  const luaCode = minifyLua(rawCode);

  const clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown';
  sendLog(game, accessTier, clientIp, req.headers.host);

  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  return res.status(200).send(luaCode);
}
