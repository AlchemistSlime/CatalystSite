// api/loader.js
// Универсальный загрузчик Catalyst Hub

// Хранилище скриптов (в реальном проекте — база данных)
// Здесь храним URL скриптов для каждой игры
const GAME_SCRIPTS = {
  '286090429': {
    name: 'Arsenal',
    free: `print("[Catalyst] Arsenal Free loaded!")`,
    premium: `print("[Catalyst] Arsenal Premium loaded!")`,
    ultimate: `print("[Catalyst] Arsenal Ultimate loaded!")`,
  },
  '142823291': {
    name: 'Murder Mystery 2',
    free: `print("[Catalyst] MM2 Free loaded!")`,
    premium: `print("[Catalyst] MM2 Premium loaded!")`,
    ultimate: `print("[Catalyst] MM2 Ultimate loaded!")`,
  },
  '17625359962': {
    name: 'Rivals',
    free: `print("[Catalyst] Rivals Free loaded!")`,
    premium: `print("[Catalyst] Rivals Premium loaded!")`,
    ultimate: `print("[Catalyst] Rivals Ultimate loaded!")`,
  },
};

// Маппинг game.GameId → PlaceId (для определения игры)
const GAME_ID_MAP = {
  '504917579': '142823291', // MM2 GameId → PlaceId
};

function minifyLua(code) {
  return code
    .replace(/--\[\[.*?]]/gs, '')
    .replace(/--.*$/gm, '')
    .replace(/\n\s*\n/g, '\n')
    .replace(/[ \t]+/g, ' ')
    .trim();
}

async function verifyKey(key, service) {
  // Проверка через ваш API ключей (Junkie/SellAuth)
  // Пока возвращаем заглушку
  if (!key || key.length < 5) return null;
  
  // Здесь должна быть реальная проверка через ваш бэкенд
  // Например:
  // const response = await fetch(`https://your-api.com/verify?key=${key}&service=${service}`);
  
  // Для теста: любой ключ длиннее 5 символов считается валидным Free
  return {
    valid: true,
    keyType: 'Free',
    rank: 'Standard'
  };
}

function sendLog(gameId, gameName, tier, ip, host) {
  fetch(`https://${host}/api/admin`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ 
      action: 'log', 
      game: gameId,
      gameName: gameName,
      tier, 
      ip 
    }),
  }).catch(() => {});
}

export default async function handler(req, res) {
  const ua = req.headers['user-agent'] || '';
  
  console.log('Loader called. UA:', ua, 'Query:', req.query);

  // Проверка User-Agent (только Roblox)
  if (!ua.includes('Roblox')) {
    return res.status(403).send('-- Access Denied: Roblox client required');
  }

  const { placeId, gameId, key } = req.query;
  
  // Определяем PlaceId
  let resolvedPlaceId = placeId;
  if (gameId && GAME_ID_MAP[gameId]) {
    resolvedPlaceId = GAME_ID_MAP[gameId];
  }
  
  if (!resolvedPlaceId || !GAME_SCRIPTS[resolvedPlaceId]) {
    // Возвращаем универсальный загрузчик, который сам определит игру
    const loaderCode = generateLoaderScript(req.headers.host);
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    return res.status(200).send(loaderCode);
  }

  // Проверяем ключ (если есть)
  let tier = 'free';
  if (key) {
    const verification = await verifyKey(key, 'Free');
    if (verification && verification.valid) {
      tier = verification.keyType.toLowerCase();
    }
  }

  const gameData = GAME_SCRIPTS[resolvedPlaceId];
  const rawCode = gameData[tier] || gameData['free'];
  const luaCode = minifyLua(rawCode);

  const clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown';
  sendLog(resolvedPlaceId, gameData.name, tier, clientIp, req.headers.host);

  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  return res.status(200).send(luaCode);
}

// Генерация универсального загрузчика (Lua-скрипт для Roblox)
function generateLoaderScript(host) {
  return `--[[ Catalyst Hub Universal Loader ]]
-- Автоматически определяет игру и загружает нужный скрипт

local MarketplaceService = game:GetService("MarketplaceService")
local Players = game:GetService("Players")
local LP = Players.LocalPlayer

local currentPlaceId = game.PlaceId
local currentGameId = game.GameId

-- Базовый URL API
local baseURL = "https://${host}/api/loader"

-- Функция загрузки скрипта
local function loadScript(placeId, key)
    local url = baseURL .. "?placeId=" .. tostring(placeId)
    if key and key ~= "" then
        url = url .. "&key=" .. key
    end
    
    local success, result = pcall(function()
        return game:HttpGet(url)
    end)
    
    if success and result and result ~= "" and not result:find("Error") then
        local loadSuccess, loadResult = pcall(function()
            loadstring(result)()
        end)
        if not loadSuccess then
            print("[Catalyst] Failed to execute script: " .. tostring(loadResult))
        end
    else
        print("[Catalyst] Failed to load script for PlaceId: " .. tostring(placeId))
        print("[Catalyst] Response: " .. tostring(result))
    end
end

-- Пытаемся загрузить скрипт для текущей игры
loadScript(currentPlaceId, nil)

-- Если игра не найдена по PlaceId, пробуем GameId
if currentGameId == 504917579 then
    -- MM2
    loadScript(142823291, nil)
end`
}
