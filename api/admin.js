// api/admin.js
// Админ-панель: управление играми через редактирование loaderScript

const ADMIN_PASSWORD = '71676612Zz@332';

// Дефолтный список игр (используется при холодном старте)
let gamesInfo = {
  '286090429': { name: 'Arsenal', status: 'Undetected' },
  '142823291': { name: 'Murder Mystery 2', status: 'Undetected' },
  '17625359962': { name: 'Rivals', status: 'Undetected' },
};

// Функция генерации loaderScript с актуальным списком игр
function generateLoaderScript(games) {
  const gamesTable = Object.entries(games).map(([id, data]) => {
    return `    [${id}] = { name = "${data.name}", status = "${data.status}" }`;
  }).join(',\n');

  return `-- ========================================================
-- CATALYST HUB - LOADER
-- ========================================================

-- 📦 Сервисы
local MarketplaceService = game:GetService("MarketplaceService")
local Players = game:GetService("Players")
local LP = Players.LocalPlayer

-- 🔥 Библиотеки
local Fluent = loadstring(game:HttpGet("https://github.com/dawid-scripts/Fluent/releases/latest/download/main.lua"))()
local Junkie = loadstring(game:HttpGet("https://jnkie.com/sdk/library.lua"))()

Junkie.identifier = 1042993
Junkie.provider = "Alchemist Hub"

local KeyFileName = "Catalyst_Key.txt"

-- 🌐 База игр (редактируется в админке)
local SupportedGames = {
${gamesTable}
}

-- 🏆 Глобальные переменные
_G.CatalystKeyType = "Unknown"
_G.CatalystRank = "Standard"
_G.ScriptURL = nil
_G.GameName = "Unknown Game"

-- 📝 Логи
local function Log(msg)
    print("[Catalyst] " .. tostring(msg))
end

-- 🔑 Проверка ключа
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

-- 🚀 Запуск скрипта игры
local function LaunchCheatDirectly()
    Log("Launching " .. _G.GameName .. " | " .. _G.CatalystKeyType .. " | " .. _G.CatalystRank)
    
    if not _G.ScriptURL then
        Log("ERROR: Script URL not found")
        return
    end
    
    local success, content = pcall(game.HttpGet, game, _G.ScriptURL)
    if success and content and #content > 10 then
        loadstring(content)()
    else
        Log("ERROR: Failed to download script")
    end
end

-- 🕵️ Определение игры
local currentPlaceId = game.PlaceId

-- Ищем в SupportedGames по URL (если есть)
for placeId, data in pairs(SupportedGames) do
    if currentPlaceId == placeId then
        _G.ScriptURL = "https://raw.githubusercontent.com/AlchemistSlime/Catalyst/main/Catalyst" .. data.name:gsub(" ", "") .. ".lua"
        _G.GameName = data.name
        break
    end
end

-- Если не нашли, пробуем другие варианты
if not _G.ScriptURL then
    local s, info = pcall(function() return MarketplaceService:GetProductInfo(currentPlaceId) end)
    if s and info and info.Name ~= "" then _G.GameName = info.Name end

    -- Фикс для MM2
    if currentPlaceId == 142823291 or game.GameId == 504917579 then
        _G.ScriptURL = "https://raw.githubusercontent.com/AlchemistSlime/Catalyst/main/CatalystMM2.lua"
        _G.GameName = "Murder Mystery 2"
    end
end

Log("Place: " .. currentPlaceId .. " | Game: " .. _G.GameName)

if not _G.ScriptURL then
    pcall(function() LP:Kick("[Catalyst]\\nGame not supported") end)
    return
end

-- 🔑 Авто-вход
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

-- 🖥️ GUI
local KeyWindow = Fluent:CreateWindow({
    Title = "Catalyst",
    SubTitle = "Key System",
    TabWidth = 120,
    Size = UDim2.fromOffset(450, 240),
    Acrylic = false,
    Theme = "Dark",
    MinimizeKey = Enum.KeyCode.RightControl
})

local KeyTab = KeyWindow:AddTab({ Title = "Verification", Icon = "shield-check" })
local Options = Fluent.Options

KeyTab:AddInput("KeyInput", {
    Title = "Activation Key",
    Default = "",
    Placeholder = "Enter your key..."
})

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
        if s and link then
            setclipboard(link)
            Fluent:Notify({ Title = "Copied", Content = "Link in clipboard", Duration = 2 })
        end
    end
})

KeyWindow:SelectTab(1)
Log("Ready")`;
}

// Текущий loaderScript
let loaderScript = generateLoaderScript(gamesInfo);

// Логи
let launchLogs = [];
let adminLogs = [];

function isAdmin(p) { return p === ADMIN_PASSWORD; }

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown';

  try {
    if (req.method === 'GET') {
      const { action, password } = req.query;

      if (action === 'status') {
        return res.status(200).json({ games: Object.entries(gamesInfo).map(([id, d]) => ({ game: id, ...d })) });
      }

      if (action === 'loader') {
        res.setHeader('Content-Type', 'text/plain; charset=utf-8');
        return res.status(200).send(loaderScript);
      }

      if (!isAdmin(password)) return res.status(401).json({ error: 'Unauthorized' });

      if (action === 'logs') return res.status(200).json({ launchLogs, adminLogs });
      if (action === 'getGames') return res.status(200).json({ games: gamesInfo });

      return res.status(400).json({ error: 'Invalid action' });
    }

    if (req.method === 'POST') {
      const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
      const { action, password, game, name, status, loaderScript: newLoader } = body;

      if (action === 'log') {
        launchLogs.push({ timestamp: new Date().toISOString(), ip: clientIp, game, gameName: name });
        return res.status(200).json({ success: true });
      }

      if (!isAdmin(password)) return res.status(401).json({ error: 'Unauthorized' });

      switch (action) {
        case 'addGame':
          if (!game || !name) return res.status(400).json({ error: 'Missing game or name' });
          gamesInfo[game] = { name, status: status || 'Undetected' };
          loaderScript = generateLoaderScript(gamesInfo);
          adminLogs.push({ timestamp: new Date().toISOString(), action: 'addGame', details: game, ip: clientIp });
          return res.status(200).json({ success: true });

        case 'deleteGame':
          delete gamesInfo[game];
          loaderScript = generateLoaderScript(gamesInfo);
          adminLogs.push({ timestamp: new Date().toISOString(), action: 'deleteGame', details: game, ip: clientIp });
          return res.status(200).json({ success: true });

        case 'updateGame':
          if (gamesInfo[game]) {
            if (name) gamesInfo[game].name = name;
            if (status) gamesInfo[game].status = status;
            loaderScript = generateLoaderScript(gamesInfo);
            adminLogs.push({ timestamp: new Date().toISOString(), action: 'updateGame', details: `${game}: ${name} ${status}`, ip: clientIp });
          }
          return res.status(200).json({ success: true });

        case 'updateLoader':
          if (newLoader && newLoader.trim().length > 0) {
            loaderScript = newLoader;
            adminLogs.push({ timestamp: new Date().toISOString(), action: 'updateLoader', details: 'custom script', ip: clientIp });
            return res.status(200).json({ success: true });
          }
          return res.status(400).json({ error: 'Empty loader' });

        default:
          return res.status(400).json({ error: 'Invalid action' });
      }
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
