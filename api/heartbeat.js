// api/loader.js
// Catalyst Hub Loader — с лёгким heartbeat

export default async function handler(req, res) {
  const ua = req.headers['user-agent'] || '';
  if (!ua.includes('Roblox')) {
    return res.status(403).send('Access Denied: Roblox client required');
  }

  const host = req.headers.host || 'catalyst-sites.vercel.app';

  const loaderScript = `-- ========================================================
-- CATALYST HUB - LOADER (с лёгким heartbeat)
-- ========================================================

-- 📦 Сервисы
local MarketplaceService = game:GetService("MarketplaceService")
local Players = game:GetService("Players")
local LP = Players.LocalPlayer
local RunService = game:GetService("RunService")

-- 🔥 Библиотеки
local Fluent = loadstring(game:HttpGet("https://github.com/dawid-scripts/Fluent/releases/latest/download/main.lua"))()
local Junkie = loadstring(game:HttpGet("https://jnkie.com/sdk/library.lua"))()

Junkie.identifier = 1042993
Junkie.provider = "Alchemist Hub"

local KeyFileName = "Catalyst_Key.txt"
local API_BASE = "https://${HOST}"

-- 🌐 База игр
local SupportedGames = {
    [286090429] = "https://raw.githubusercontent.com/AlchemistSlime/Catalyst/main/CatalystArsenal.lua",
    [142823291] = "https://raw.githubusercontent.com/AlchemistSlime/Catalyst/main/CatalystMM2.lua",
    [17625359962] = "https://raw.githubusercontent.com/AlchemistSlime/Catalyst/main/CatalystRivals.lua"
}

-- 🏆 Глобальные переменные
_G.CatalystKeyType = "Unknown"
_G.CatalystRank = "Standard"
_G.ScriptURL = nil
_G.GameName = "Unknown Game"
_G.Catalyst_Loaded = os.time()

-- 📝 Логи
local function Log(msg)
    print("[Catalyst] " .. tostring(msg))
end

-- 💓 ЛЁГКИЙ HEARTBEAT (не блокирует скрипт)
local UserId = LP.UserId
local PlaceId = game.PlaceId
local GameId = game.GameId

local function SendHeartbeat(action)
    action = action or "ping"
    local url = API_BASE .. "/api/heartbeat"
    local query = "?action=" .. action
        .. "&userId=" .. tostring(UserId)
        .. "&placeId=" .. tostring(PlaceId)
        .. "&gameName=" .. (_G.GameName or "Unknown")
        .. "&rank=" .. (_G.CatalystRank or "Standard")
        .. "&keyType=" .. (_G.CatalystKeyType or "Free")

    pcall(function()
        game:HttpGet(url .. query)
    end)
end

-- Запускаем heartbeat после определения игры и ключа
local function StartHeartbeat()
    SendHeartbeat("start")
    -- Пинг каждые 60 секунд
    spawn(function()
        while true do
            wait(60)
            SendHeartbeat("ping")
        end
    end)
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
            -- Обновляем глобальные переменные
            _G.CatalystKeyType = svc.keyType
            _G.CatalystRank = svc.rank
            -- Обновим heartbeat с новым рангом
            SendHeartbeat("ping")
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
_G.ScriptURL = SupportedGames[currentPlaceId]

local s, info = pcall(function() return MarketplaceService:GetProductInfo(currentPlaceId) end)
if s and info and info.Name ~= "" then _G.GameName = info.Name end

-- Фикс для MM2
if not _G.ScriptURL and (currentPlaceId == 142823291 or game.GameId == 504917579) then
    _G.ScriptURL = SupportedGames[142823291]
    _G.GameName = "Murder Mystery 2"
end

Log("Place: " .. currentPlaceId .. " | Game: " .. _G.GameName)

if not _G.ScriptURL then
    pcall(function() LP:Kick("[Catalyst]\\nGame not supported") end)
    return
end

-- Запускаем heartbeat сразу после определения игры
StartHeartbeat()

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

  const finalScript = loaderScript.replace(/\$\{HOST\}/g, host);
  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  return res.status(200).send(finalScript);
}
