// api/heartbeat-module.js
// Отдаёт Lua-код Heartbeat модуля для загрузчика

export default async function handler(req, res) {
  // Разрешаем запросы от Roblox (без проверки User-Agent, т.к. это модуль)
  const host = req.headers.host || 'catalyst-sites.vercel.app';
  
  const luaCode = `-- ========================================================
-- CATALYST HEARTBEAT MODULE (Vercel)
-- ========================================================
local API = "https://${HOST}"
local LP = game:GetService("Players").LocalPlayer
local UID = LP.UserId
local PID = game.PlaceId

local valid = false
local hash = nil
local running = false
local count = 0

local function validate()
    local s, r = pcall(function()
        return game:HttpGet(API .. "/api/heartbeat?action=validate&userId=" .. UID .. "&placeId=" .. PID)
    end)
    if s and r and r:find("OK:") then
        hash = r:gsub("OK:", ""):gsub("%s+", "")
        valid = true
        _G.Catalyst_HeartbeatActive = true
        _G.Catalyst_SessionHash = hash
        return true
    end
    return false
end

if not validate() then return nil end

local function beat(status)
    if not valid then return end
    status = status or "active"
    count = count + 1
    pcall(function()
        local r = game:HttpGet(API .. "/api/heartbeat?action=heartbeat&userId=" .. UID .. "&placeId=" .. PID .. "&status=" .. status .. "&hash=" .. (hash or "") .. "&count=" .. count)
        if r == "banned" then valid = false running = false _G.Catalyst_Shutdown = true LP:Kick("[Catalyst] Banned") end
        if r == "invalid" then valid = false running = false _G.Catalyst_Shutdown = true end
    end)
end

if not running then
    running = true
    beat("active")
    spawn(function() while running and valid do wait(45) beat("active") end end)
end

game:GetService("Players").PlayerRemoving:Connect(function(p)
    if p == LP then running = false if valid then beat("inactive") end end
end)

spawn(function()
    while valid do
        wait(15)
        if not _G.Catalyst_HeartbeatActive or _G.Catalyst_SessionHash ~= hash then
            valid = false _G.Catalyst_Shutdown = true running = false break
        end
    end
end)

return {
    IsValid = function() return valid end,
    GetHash = function() return hash end,
    SendHeartbeat = beat,
    Stop = function() running = false beat("inactive") end,
}`;

  // Подставляем реальный хост
  const finalCode = luaCode.replace(/\$\{HOST\}/g, host);
  
  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store'); // Не кешируем
  return res.status(200).send(finalCode);
}
