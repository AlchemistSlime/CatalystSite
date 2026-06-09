// api/loader.js
// Загрузчик Catalyst Hub — отдаёт ваш Lua-скрипт ТОЛЬКО для Roblox

// Это ваш скрипт-загрузчик (хранится здесь, можно менять через админку)
let loaderScript = `-- ========================================================
-- CATALYST HUB - UNIVERSAL LOADER
-- ========================================================
local MarketplaceService = game:GetService("MarketplaceService")
local Players = game:GetService("Players")
local LP = Players.LocalPlayer

-- Список поддерживаемых игр (PlaceId -> GitHub Raw URL)
local SupportedGames = {
    [286090429] = "https://raw.githubusercontent.com/AlchemistSlime/Catalyst/refs/heads/main/CatalystArsenal.lua",
    [142823291] = "https://raw.githubusercontent.com/AlchemistSlime/Catalyst/refs/heads/main/CatalystMM2.lua",
    [17625359962] = "https://raw.githubusercontent.com/AlchemistSlime/Catalyst/refs/heads/main/CatalystRivals.lua"
}

-- Определение игры
local currentPlaceId = game.PlaceId
local currentGameId = game.GameId

-- Фикс для MM2 (GameId 504917579)
if currentGameId == 504917579 then
    currentPlaceId = 142823291
end

local scriptURL = SupportedGames[currentPlaceId]

if scriptURL then
    -- Загружаем скрипт с GitHub
    local success, content = pcall(function()
        return game:HttpGet(scriptURL)
    end)
    
    if success and content and content ~= "" then
        -- Выполняем скрипт (внутри уже есть система ключей и GUI)
        local execSuccess, execResult = pcall(function()
            loadstring(content)()
        end)
        
        if not execSuccess then
            -- Ошибка выполнения
            pcall(function()
                LP:Kick("[Catalyst Hub] Script execution error. Please try again.")
            end)
        end
    else
        -- Ошибка загрузки
        pcall(function()
            LP:Kick("[Catalyst Hub] Failed to load script for this game.")
        end)
    end
else
    -- Игра не поддерживается
    local success, info = pcall(function()
        return MarketplaceService:GetProductInfo(currentPlaceId)
    end)
    local gameName = success and info and info.Name or "Unknown Game"
    
    pcall(function()
        LP:Kick("[Catalyst Hub] Game not supported: " .. gameName .. " (PlaceId: " .. tostring(currentPlaceId) .. ")")
    end)
end`;

// Экспорт функций для admin.js
export function getLoaderScript() {
  return loaderScript;
}

export function updateLoaderScript(newScript) {
  if (newScript && newScript.trim().length > 0) {
    loaderScript = newScript;
    return true;
  }
  return false;
}

// Хранилище данных об играх (для админки)
const gamesInfo = {
  '286090429': { name: 'Arsenal', status: 'Undetected' },
  '142823291': { name: 'Murder Mystery 2', status: 'Undetected' },
  '17625359962': { name: 'Rivals', status: 'Undetected' },
};

export function getGamesInfo() {
  return gamesInfo;
}

export function updateGameInfo(gameId, data) {
  if (gamesInfo[gameId]) {
    if (data.name) gamesInfo[gameId].name = data.name;
    if (data.status) gamesInfo[gameId].status = data.status;
  }
}

export function addGameInfo(gameId, name, status) {
  gamesInfo[gameId] = { name: name || 'Unknown', status: status || 'Undetected' };
}

export function deleteGameInfo(gameId) {
  delete gamesInfo[gameId];
}

function sendLog(game, gameName, ip, host) {
  fetch(`https://${host}/api/admin`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      action: 'log',
      game,
      gameName,
      ip,
    }),
  }).catch(() => {});
}

export default async function handler(req, res) {
  const ua = req.headers['user-agent'] || '';

  // СТРОГАЯ ПРОВЕРКА: только Roblox
  if (!ua.includes('Roblox')) {
    return res.status(403).send('Access Denied: Roblox client required\n\nOnly Roblox game clients can access this endpoint.');
  }

  const clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown';
  
  // Логируем запуск
  sendLog('universal_loader', 'Universal Loader', clientIp, req.headers.host);

  // Отдаём загрузчик
  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  return res.status(200).send(loaderScript);
}
