// api/loader.js
// Catalyst Hub — оптимизированный загрузчик

let stats = {
  totalLoads: 0,
};

let loaderScript = `-- ========================================================
-- CATALYST HUB - OPTIMIZED LOADER
-- ========================================================

-- ========================================================
-- 🛡️ ЗАЩИТА: Анти-дамп
-- ========================================================
local function AntiDump()
    pcall(function()
        local hidden = {}
        local mt = {
            __index = function(t, k)
                if hidden[k] then return hidden[k] end
                return rawget(t, k)
            end,
            __newindex = function(t, k, v)
                if type(k) == "string" and (k:find("Catalyst") or k:find("HB_")) then
                    hidden[k] = v
                    return
                end
                rawset(t, k, v)
            end
        }
        setmetatable(_G, mt)
    end)
end

-- ========================================================
-- 🛡️ ЗАЩИТА: Анти-декомпиляция
-- ========================================================
local function AntiDecompile()
    if game:GetService("RunService"):IsStudio() then
        while true do end
    end
    
    local bad = {"dex", "Decompiler", "Dumper", "SaveInstance", "DarkDex", "ScriptDumper", "RemoteSpy"}
    for _, name in ipairs(bad) do
        pcall(function()
            local obj = game:GetService("CoreGui"):FindFirstChild(name)
            if obj then obj:Destroy() end
        end)
    end
    
    return false
end

AntiDump()
if AntiDecompile() then return end

-- ========================================================
-- 🔐 ЗАГРУЗКА HEARTBEAT МОДУЛЯ С GITHUB
-- ========================================================
local HeartbeatModule = nil

pcall(function()
    local code = game:HttpGet("https://raw.githubusercontent.com/AlchemistSlime/Catalyst/main/CatalystHeartbeat.lua")
    if code and #code > 100 then
        local result = loadstring(code)()
        if type(result) == "table" and result.IsValid and result.IsValid() then
            HeartbeatModule = result
        end
    end
end)

if not HeartbeatModule then return end

-- ========================================================
-- 📦 СЕРВИСЫ
-- ========================================================
local MarketplaceService = game:GetService("MarketplaceService")
local Players = game:GetService("Players")
local LP = Players.LocalPlayer
local RunService = game:GetService("RunService")
local HttpService = game:GetService("HttpService")

-- ========================================================
-- 🔥 БИБЛИОТЕКИ
-- ========================================================
local Fluent = loadstring(game:HttpGet("https://github.com/dawid-scripts/Fluent/releases/latest/download/main.lua"))()
local Junkie = loadstring(game:HttpGet("https://jnkie.com/sdk/library.lua"))()

Junkie.identifier = 1042993
Junkie.provider = "Alchemist Hub"

local KeyFileName = "Catalyst_Key.txt"

-- ========================================================
-- 🌐 БАЗА ИГР
-- ========================================================
local SupportedGames = {
    [286090429] = "https://raw.githubusercontent.com/AlchemistSlime/Catalyst/refs/heads/main/CatalystArsenal.lua",
    [142823291] = "https://raw.githubusercontent.com/AlchemistSlime/Catalyst/refs/heads/main/CatalystMM2.lua",
    [17625359962] = "https://raw.githubusercontent.com/AlchemistSlime/Catalyst/refs/heads/main/CatalystRivals.lua"
}

-- ========================================================
-- 🏆 ГЛОБАЛЬНЫЕ ПЕРЕМЕННЫЕ
-- ========================================================
_G.CatalystKeyType = "Unknown"
_G.CatalystRank = "Standard"
_G.ScriptURL = nil
_G.GameName = "Unknown Game"
_G.Catalyst_Loaded = os.time()

-- ========================================================
-- 📝 LOGGING
-- ========================================================
local function Log(msg)
    print("[Catalyst] " .. tostring(msg))
end

-- ========================================================
-- 🔑 ПРОВЕРКА КЛЮЧА
-- ========================================================
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
            Log("Key: " .. svc.name .. " | " .. svc.keyType .. " | " .. svc.rank)
            
            -- Отправляем heartbeat
            if HeartbeatModule and HeartbeatModule.SendHeartbeat then
                HeartbeatModule.SendHeartbeat("key_verified")
            end
            
            return true, svc.keyType, svc.rank
        end
    end
    
    return false, nil, nil
end

-- ========================================================
-- ✅ ПРОВЕРКА БЕЗОПАСНОСТИ ПЕРЕД ЗАПУСКОМ
-- ========================================================
local function SecurityCheck()
    -- Проверяем heartbeat модуль
    if not HeartbeatModule or not HeartbeatModule.IsValid() then
        return false
    end
    
    -- Проверяем что глобальные переменные не подменили
    if not _G.Catalyst_HeartbeatActive then
        return false
    end
    
    -- Проверяем что скрипт не был отключён
    if _G.Catalyst_Shutdown then
        return false
    end
    
    -- Проверяем что мы в игре (не в студии)
    if RunService:IsStudio() then
        return false
    end
    
    return true
end

-- ========================================================
-- 🚀 ЗАПУСК СКРИПТА ИГРЫ
-- ========================================================
local function LaunchCheatDirectly()
    if not SecurityCheck() then
        Log("Security check failed")
        return
    end
    
    Log("Loading " .. _G.GameName)
    Log("Key: " .. _G.CatalystKeyType .. " | Rank: " .. _G.CatalystRank)
    
    if not _G.ScriptURL then
        Log("ERROR: No script URL")
        return
    end
    
    -- Обфусцированная загрузка (затрудняет перехват)
    local func = loadstring
    local http = game.HttpGet
    
    local s, content = pcall(http, game, _G.ScriptURL)
    if s and content and #content > 10 then
        -- Проверка целостности перед выполнением
        if not content:find("Catalyst") and not content:find("loadstring") then
            Log("WARNING: Script content seems invalid")
        end
        
        -- Оборачиваем в проверку безопасности
        local safeCode = [[
if not _G.Catalyst_HeartbeatActive then return end
if _G.Catalyst_Shutdown then return end
]] .. content
        
        local execFunc, execErr = func(safeCode)
        if execFunc then
            execFunc()
        else
            Log("Compile error: " .. tostring(execErr))
        end
    else
        Log("Failed to download script")
    end
end

-- ========================================================
-- 🕵️ ОПРЕДЕЛЕНИЕ ИГРЫ
-- ========================================================
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

-- ========================================================
-- 🔑 АВТО-ВХОД
-- ========================================================
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

pcall(function()
    if delfile and isfile(KeyFileName) then delfile(KeyFileName) end
end)

-- ========================================================
-- 🖥️ GUI
-- ========================================================
local KeyWindow = Fluent:CreateWindow({
    Title = "Catalyst",
    SubTitle = "Key System",
    TabWidth = 120,
    Size = UDim2.fromOffset(450, 240),
    Acrylic = false,
    Theme = "Dark",
    MinimizeKey = Enum.KeyCode.RightControl
})

local Tabs = {
    Verify = KeyWindow:AddTab({ Title = "Verification", Icon = "shield-check" })
}

local Options = Fluent.Options

Tabs.Verify:AddInput("KeyInput", {
    Title = "Activation Key",
    Default = "",
    Placeholder = "Enter your key..."
})

Tabs.Verify:AddButton({
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

Tabs.Verify:AddButton({
    Title = "Get Free Key",
    Callback = function()
        Junkie.service = "Free"
        local s, link = pcall(Junkie.get_key_link)
        if s and link then
            setclipboard(link)
            Fluent:Notify({ Title = "Copied", Content = "Link in clipboard", Duration = 2 })
        else
            Fluent:Notify({ Title = "Error", Content = "Try again later", Duration = 2 })
        end
    end
})

KeyWindow:SelectTab(1)
Log("Ready")`;

// ==================== ЭКСПОРТЫ ====================
export function getLoaderScript() { return loaderScript; }

export function updateLoaderScript(newScript) {
  if (newScript && newScript.trim().length > 0) {
    loaderScript = newScript;
    return true;
  }
  return false;
}

const gamesInfo = {
  '286090429': { name: 'Arsenal', status: 'Undetected' },
  '142823291': { name: 'Murder Mystery 2', status: 'Undetected' },
  '17625359962': { name: 'Rivals', status: 'Undetected' },
};

export function getGamesInfo() { return gamesInfo; }
export function updateGameInfo(gameId, data) {
  if (gamesInfo[gameId]) {
    if (data.name) gamesInfo[gameId].name = data.name;
    if (data.status) gamesInfo[gameId].status = data.status;
  }
}
export function addGameInfo(gameId, name, status) {
  gamesInfo[gameId] = { name: name || 'Unknown', status: status || 'Undetected' };
}
export function deleteGameInfo(gameId) { delete gamesInfo[gameId]; }

export default async function handler(req, res) {
  const ua = req.headers['user-agent'] || '';
  if (!ua.includes('Roblox')) {
    return res.status(403).send('Access Denied: Roblox client required');
  }
  stats.totalLoads++;
  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  return res.status(200).send(loaderScript);
}
