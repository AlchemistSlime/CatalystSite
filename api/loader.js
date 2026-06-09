// api/loader.js
// Отдаёт скрипт-загрузчик, который подгружает основной Lua-файл с GitHub

// Базовые URL скриптов (меняются через админку)
const GAME_SCRIPTS = {
  '286090429': {
    name: 'Arsenal',
    url: 'https://raw.githubusercontent.com/AlchemistSlime/Catalyst/refs/heads/main/CatalystArsenal.lua',
    status: 'Undetected',
  },
  '142823291': {
    name: 'Murder Mystery 2',
    url: 'https://raw.githubusercontent.com/AlchemistSlime/Catalyst/refs/heads/main/CatalystMM2.lua',
    status: 'Undetected',
  },
  '17625359962': {
    name: 'Rivals',
    url: 'https://raw.githubusercontent.com/AlchemistSlime/Catalyst/refs/heads/main/CatalystRivals.lua',
    status: 'Undetected',
  },
};

// Универсальный загрузчик (Lua-код, который получают пользователи)
let loaderScript = `--[[ Catalyst Hub Universal Loader ]]
local currentPlaceId = game.PlaceId
local currentGameId = game.GameId

-- Ссылки на скрипты
local scripts = {
    ["286090429"] = "https://raw.githubusercontent.com/AlchemistSlime/Catalyst/refs/heads/main/CatalystArsenal.lua",
    ["142823291"] = "https://raw.githubusercontent.com/AlchemistSlime/Catalyst/refs/heads/main/CatalystMM2.lua",
    ["17625359962"] = "https://raw.githubusercontent.com/AlchemistSlime/Catalyst/refs/heads/main/CatalystRivals.lua",
}

-- MM2 через GameId
if currentGameId == 504917579 then
    currentPlaceId = 142823291
end

local scriptURL = scripts[tostring(currentPlaceId)]

if scriptURL then
    local success, content = pcall(function()
        return game:HttpGet(scriptURL)
    end)
    
    if success and content and content ~= "" then
        loadstring(content)()
    else
        print("[Catalyst] Failed to load script for PlaceId: " .. tostring(currentPlaceId))
    end
else
    print("[Catalyst] Game not supported. PlaceId: " .. tostring(currentPlaceId))
end`;

// Экспортируем для доступа из admin.js
export function getLoaderScript() {
  return loaderScript;
}

export function updateLoaderScript(newScript) {
  loaderScript = newScript;
}

export function getGameScripts() {
  return GAME_SCRIPTS;
}

export function updateGameScript(gameId, url, name, status) {
  if (GAME_SCRIPTS[gameId]) {
    if (url) GAME_SCRIPTS[gameId].url = url;
    if (name) GAME_SCRIPTS[gameId].name = name;
    if (status) GAME_SCRIPTS[gameId].status = status;
  }
}

export function addGameScript(gameId, name, url, status) {
  GAME_SCRIPTS[gameId] = {
    name: name || 'Unknown',
    url: url || '',
    status: status || 'Undetected',
  };
}

export function deleteGameScript(gameId) {
  delete GAME_SCRIPTS[gameId];
}

function minifyLua(code) {
  return code
    .replace(/--\[\[.*?]]/gs, '')
    .replace(/--.*$/gm, '')
    .replace(/\n\s*\n/g, '\n')
    .replace(/[ \t]+/g, ' ')
    .trim();
}

function sendLog(gameId, gameName, ip, host) {
  fetch(`https://${host}/api/admin`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      action: 'log',
      game: gameId,
      gameName: gameName,
      tier: 'loaded',
      ip,
    }),
  }).catch(() => {});
}

export default async function handler(req, res) {
  const ua = req.headers['user-agent'] || '';

  if (!ua.includes('Roblox')) {
    // Для браузеров показываем loader для отладки
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    return res.status(200).send(loaderScript);
  }

  const clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown';

  // Логируем любой запрос
  sendLog('loader', 'Universal Loader', clientIp, req.headers.host);

  // Отдаём универсальный загрузчик
  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  return res.status(200).send(minifyLua(loaderScript));
}
