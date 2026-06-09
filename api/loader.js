// api/loader.js
// Временный загрузчик с фиксированными играми

export default async function handler(req, res) {
  const ua = req.headers['user-agent'] || '';
  if (!ua.includes('Roblox')) {
    return res.status(403).send('Access Denied: Roblox client required');
  }

  // Lua-скрипт (можно заменить через админку, изменив этот файл)
  const loaderScript = `-- ========================================================
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

-- 🌐 База игр (редактируйте в этом файле)
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

  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  return res.status(200).send(loaderScript);
}
