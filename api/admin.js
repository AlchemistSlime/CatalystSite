// api/admin.js
// Единый обработчик: и админка, и загрузчик, и статусы

const ADMIN_PASSWORD = 'admin123';

// Хранилище игр (редактируется через админку)
let gamesInfo = {
  '286090429': { name: 'Arsenal', status: 'Undetected' },
  '142823291': { name: 'Murder Mystery 2', status: 'Undetected' },
  '17625359962': { name: 'Rivals', status: 'Undetected' },
};

// Генерация Lua-скрипта с актуальным списком игр
function buildLoaderScript(games) {
  const entries = Object.entries(games);
  const gameTableLines = entries.map(([id, data]) => {
    const cleanName = data.name.replace(/ /g, '');
    return `    [${id}] = "https://raw.githubusercontent.com/AlchemistSlime/Catalyst/main/Catalyst${cleanName}.lua"`;
  }).join(',\n');

  return `-- ========================================================
-- CATALYST HUB - LOADER (auto‑generated)
-- ========================================================

local MarketplaceService = game:GetService("MarketplaceService")
local Players = game:GetService("Players")
local LP = Players.LocalPlayer

local Fluent = loadstring(game:HttpGet("https://github.com/dawid-scripts/Fluent/releases/latest/download/main.lua"))()
local Junkie = loadstring(game:HttpGet("https://jnkie.com/sdk/library.lua"))()
Junkie.identifier = 1042993
Junkie.provider = "Alchemist Hub"

local KeyFileName = "Catalyst_Key.txt"

local SupportedGames = {
${gameTableLines}
}

_G.CatalystKeyType = "Unknown"
_G.CatalystRank = "Standard"
_G.ScriptURL = nil
_G.GameName = "Unknown Game"

local function Log(msg) print("[Catalyst] " .. tostring(msg)) end

local function CheckKeyInAllServices(key)
    if type(key) == "string" then key = key:gsub("%s+", "") end
    if not key or #key < 5 then return false, nil, nil end
    local services = {
        { name = "Free",     keyType = "Free",     rank = "Standard" },
        { name = "Premium",  keyType = "Premium",  rank = "Premium" },
        { name = "Ultimate", keyType = "Ultimate", rank = "Ultimate" }
    }
    for _, svc in ipairs(services) do
        Junkie.service = svc.name
        local s, r = pcall(function() return Junkie.check_key(key) end)
        if s and r and type(r) == "table" and r.valid then
            pcall(function() if writefile then writefile(KeyFileName, key) end end)
            Log("Key: " .. svc.keyType .. " | " .. svc.rank)
            return true, svc.keyType, svc.rank
        end
    end
    return false, nil, nil
end

local function LaunchCheatDirectly()
    Log("Loading " .. _G.GameName .. " | " .. _G.CatalystKeyType .. " | " .. _G.CatalystRank)
    if not _G.ScriptURL then Log("ERROR: No URL") return end
    local s, content = pcall(game.HttpGet, game, _G.ScriptURL)
    if s and content and #content > 10 then loadstring(content)() else Log("ERROR: Download failed") end
end

local currentPlaceId = game.PlaceId
_G.ScriptURL = SupportedGames[currentPlaceId]

local s, info = pcall(function() return MarketplaceService:GetProductInfo(currentPlaceId) end)
if s and info and info.Name ~= "" then _G.GameName = info.Name end
if not _G.ScriptURL and (currentPlaceId == 142823291 or game.GameId == 504917579) then
    _G.ScriptURL = SupportedGames[142823291]
    _G.GameName = "Murder Mystery 2"
end
Log("Place: " .. currentPlaceId .. " | Game: " .. _G.GameName)
if not _G.ScriptURL then pcall(function() LP:Kick("[Catalyst]\\nGame not supported") end) return end

local savedKey = ""
pcall(function()
    if isfile and isfile(KeyFileName) then
        local c = readfile(KeyFileName)
        if c and c ~= "" then savedKey = c:gsub("%s+", "") end
    end
end)
if savedKey ~= "" and #savedKey >= 5 then
    local valid, kt, rank = CheckKeyInAllServices(savedKey)
    if valid then
        _G.CatalystKeyType = kt
        _G.CatalystRank = rank
        LaunchCheatDirectly()
        return
    end
end
pcall(function() if delfile and isfile(KeyFileName) then delfile(KeyFileName) end end)

local KeyWindow = Fluent:CreateWindow({
    Title = "Catalyst", SubTitle = "Key System", TabWidth = 120,
    Size = UDim2.fromOffset(450, 240), Acrylic = false, Theme = "Dark",
    MinimizeKey = Enum.KeyCode.RightControl
})
local KeyTab = KeyWindow:AddTab({ Title = "Verification", Icon = "shield-check" })
local Options = Fluent.Options
KeyTab:AddInput("KeyInput", { Title = "Activation Key", Default = "", Placeholder = "Enter your key..." })
KeyTab:AddButton({
    Title = "Verify Key",
    Callback = function()
        local key = Options.KeyInput.Value
        Fluent:Notify({ Title = "Catalyst", Content = "Checking...", Duration = 1 })
        task.wait(0.3)
        local valid, kt, rank = CheckKeyInAllServices(key)
        if valid then
            _G.CatalystKeyType = kt
            _G.CatalystRank = rank
            Fluent:Notify({ Title = "Success", Content = kt .. " | " .. rank, Duration = 2 })
            task.wait(0.5)
            KeyWindow:Destroy()
            task.wait(0.1)
            LaunchCheatDirectly()
        else
            Fluent:Notify({ Title = "Denied", Content = "Invalid key", Duration = 3 })
        end
    end
})
KeyTab:AddButton({
    Title = "Get Free Key",
    Callback = function()
        Junkie.service = "Free"
        local s, link = pcall(Junkie.get_key_link)
        if s and link then setclipboard(link) Fluent:Notify({ Title = "Copied", Content = "Link in clipboard", Duration = 2 }) end
    end
})
KeyWindow:SelectTab(1)
Log("Ready")`;
}

// Текущий загрузочный скрипт
let currentLoader = buildLoaderScript(gamesInfo);

// Логи
let launchLogs = [];
let adminLogs = [];

function isAdmin(password) { return password === ADMIN_PASSWORD; }

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown';

  try {
    // ======================= GET =======================
    if (req.method === 'GET') {
      const { action, password } = req.query;

      // === Публичные ===
      if (action === 'status') {
        return res.status(200).json({ games: Object.entries(gamesInfo).map(([id, d]) => ({ game: id, ...d })) });
      }

      if (action === 'loader') {
        // Проверка User-Agent для скрипта
        const ua = req.headers['user-agent'] || '';
        if (!ua.includes('Roblox')) {
          return res.status(403).send('Access Denied: Roblox client required');
        }
        // Логируем запуск
        launchLogs.push({ timestamp: new Date().toISOString(), ip: clientIp, game: 'loader', gameName: 'Universal Loader' });
        res.setHeader('Content-Type', 'text/plain; charset=utf-8');
        return res.status(200).send(currentLoader);
      }

      // === Требуют пароль ===
      if (!isAdmin(password)) return res.status(401).json({ error: 'Unauthorized' });

      if (action === 'logs') {
        return res.status(200).json({ launchLogs, adminLogs });
      }
      if (action === 'getGames') {
        return res.status(200).json({ games: gamesInfo });
      }
      return res.status(400).json({ error: 'Invalid action' });
    }

    // ======================= POST =======================
    if (req.method === 'POST') {
      const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
      const { action, password, game, name, status, loaderScript } = body;

      // Логирование запусков (публично, вызывается из loader'а)
      if (action === 'log') {
        launchLogs.push({ timestamp: new Date().toISOString(), ip: clientIp, game, gameName: name || '' });
        return res.status(200).json({ success: true });
      }

      if (!isAdmin(password)) return res.status(401).json({ error: 'Unauthorized' });

      switch (action) {
        case 'addGame':
          if (!game || !name) return res.status(400).json({ error: 'Missing fields' });
          gamesInfo[game] = { name, status: status || 'Undetected' };
          currentLoader = buildLoaderScript(gamesInfo);
          adminLogs.push({ timestamp: new Date().toISOString(), action: 'addGame', details: game, ip: clientIp });
          return res.status(200).json({ success: true });

        case 'deleteGame':
          delete gamesInfo[game];
          currentLoader = buildLoaderScript(gamesInfo);
          adminLogs.push({ timestamp: new Date().toISOString(), action: 'deleteGame', details: game, ip: clientIp });
          return res.status(200).json({ success: true });

        case 'updateGame':
          if (gamesInfo[game]) {
            if (name !== undefined) gamesInfo[game].name = name;
            if (status !== undefined) gamesInfo[game].status = status;
            currentLoader = buildLoaderScript(gamesInfo);
            adminLogs.push({ timestamp: new Date().toISOString(), action: 'updateGame', details: `${game}: ${name} ${status}`, ip: clientIp });
          }
          return res.status(200).json({ success: true });

        case 'updateLoader':
          if (loaderScript && loaderScript.trim().length > 0) {
            currentLoader = loaderScript;
            adminLogs.push({ timestamp: new Date().toISOString(), action: 'updateLoader', details: 'manual update', ip: clientIp });
            return res.status(200).json({ success: true });
          }
          return res.status(400).json({ error: 'Empty script' });

        default:
          return res.status(400).json({ error: 'Invalid action' });
      }
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
