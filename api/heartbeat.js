// api/heartbeat.js
// Heartbeat модуль — загружается ОТДЕЛЬНО через loadstring

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123';

// Активные пользователи
let activeUsers = new Map();
let bannedUsers = new Set();

// Очистка неактивных каждые 5 минут
setInterval(() => {
  const now = Date.now();
  for (const [userId, data] of activeUsers) {
    if (now - data.lastHeartbeat > 300000) {
      activeUsers.delete(userId);
    }
  }
}, 60000);

function isAdmin(p) { return p === ADMIN_PASSWORD; }

function generateHash(userId, timestamp) {
  let hash = '';
  const chars = 'abcdef0123456789';
  const seed = userId + timestamp;
  for (let i = 0; i < 64; i++) {
    const idx = (seed.charCodeAt(i % seed.length) + i) % chars.length;
    hash += chars[idx];
  }
  return hash;
}

// ==================== ГЕНЕРАЦИЯ LUA-МОДУЛЯ ====================
function generateHeartbeatModule(host) {
  const moduleCode = `-- ========================================================
-- CATALYST HEARTBEAT MODULE
-- ========================================================
local API_BASE = "https://${HOST}"
local UserId = game:GetService("Players").LocalPlayer.UserId
local PlaceId = game.PlaceId
local GameId = game.GameId
local RunService = game:GetService("RunService")

-- ========================================================
-- 🔐 ВАЛИДАЦИЯ МОДУЛЯ
-- ========================================================
local ModuleValid = false
local ValidationHash = nil

local function ValidateModule()
    local success, result = pcall(function()
        return game:HttpGet(API_BASE .. "/api/heartbeat?action=validate&userId=" .. tostring(UserId))
    end)
    
    if success and result and result:find("VALID:") then
        ValidationHash = result:gsub("VALID:", ""):gsub("%s+", "")
        ModuleValid = true
        
        -- Устанавливаем глобальные переменные для проверки
        _G.Catalyst_HeartbeatActive = true
        _G.Catalyst_ValidationHash = ValidationHash
        
        return true
    end
    
    return false
end

-- Проверяем модуль
if not ValidateModule() then
    return nil
end

-- ========================================================
-- 💓 HEARTBEAT
-- ========================================================
local HeartbeatRunning = false
local HeartbeatCount = 0

local function SendHeartbeat(keyType, rank, status)
    if not ModuleValid then return end
    
    status = status or "active"
    keyType = keyType or _G.CatalystKeyType or "Unknown"
    rank = rank or _G.CatalystRank or "Standard"
    HeartbeatCount = HeartbeatCount + 1
    
    local url = API_BASE .. "/api/heartbeat"
    local query = "?action=heartbeat"
        .. "&userId=" .. tostring(UserId)
        .. "&placeId=" .. tostring(PlaceId)
        .. "&gameId=" .. tostring(GameId)
        .. "&status=" .. status
        .. "&keyType=" .. keyType
        .. "&rank=" .. rank
        .. "&hash=" .. (ValidationHash or "none")
        .. "&count=" .. tostring(HeartbeatCount)
    
    pcall(function()
        local response = game:HttpGet(url .. query)
        
        if response == "banned" then
            pcall(function()
                game:GetService("Players").LocalPlayer:Kick("[Catalyst Hub] Access revoked.")
            end)
        elseif response == "invalid" then
            ModuleValid = false
            HeartbeatRunning = false
        end
    end)
end

-- Запуск heartbeat
if not HeartbeatRunning then
    HeartbeatRunning = true
    SendHeartbeat(nil, nil, "active")
    
    spawn(function()
        while HeartbeatRunning and ModuleValid do
            wait(45)
            SendHeartbeat(nil, nil, "active")
        end
    end)
end

-- Остановка при выходе
game:GetService("Players").PlayerRemoving:Connect(function(player)
    if player == game:GetService("Players").LocalPlayer then
        HeartbeatRunning = false
        if ModuleValid then
            SendHeartbeat(nil, nil, "inactive")
        end
    end
end)

-- ========================================================
-- 🛡️ ЗАЩИТА ОТ ПОДМЕНЫ
-- ========================================================
spawn(function()
    while ModuleValid do
        wait(10)
        
        if not _G.Catalyst_HeartbeatActive then
            ModuleValid = false
            break
        end
        
        if _G.Catalyst_ValidationHash ~= ValidationHash then
            ModuleValid = false
            break
        end
    end
    
    if not ModuleValid then
        pcall(function()
            _G.Catalyst_Shutdown = true
            game:GetService("Players").LocalPlayer:Kick("[Catalyst Hub] Security check failed.")
        end)
    end
end)

-- Возвращаем API
return {
    IsValid = function() return ModuleValid end,
    GetHash = function() return ValidationHash end,
    SendHeartbeat = SendHeartbeat,
}`;

  return moduleCode.replace(/\$\{HOST\}/g, host);
}

// ==================== ОБРАБОТЧИК ====================
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') return res.status(200).end();

  const host = req.headers.host;
  
  try {
    if (req.method === 'GET') {
      const { action, userId, placeId, gameId, status, keyType, rank, hash, count, password, targetUserId } = req.query;

      // Отдача модуля (публичный)
      if (action === 'module') {
        const moduleCode = generateHeartbeatModule(host);
        res.setHeader('Content-Type', 'text/plain; charset=utf-8');
        return res.status(200).send(moduleCode);
      }

      // Валидация модуля (публичный)
      if (action === 'validate') {
        if (!userId || bannedUsers.has(userId)) {
          return res.status(200).send('INVALID');
        }
        
        const validationHash = generateHash(userId, Date.now().toString());
        
        activeUsers.set(userId, {
          validationHash,
          placeId: placeId || 'unknown',
          gameId: gameId || 'unknown',
          status: 'validated',
          lastHeartbeat: Date.now(),
          heartbeatCount: 0,
        });
        
        return res.status(200).send('VALID:' + validationHash);
      }
      
      // Heartbeat (публичный)
      if (action === 'heartbeat') {
        if (!userId) return res.status(200).send('invalid');
        
        if (bannedUsers.has(userId)) {
          return res.status(200).send('banned');
        }
        
        const userData = activeUsers.get(userId);
        
        if (!userData || userData.validationHash !== hash) {
          return res.status(200).send('invalid');
        }
        
        userData.lastHeartbeat = Date.now();
        userData.heartbeatCount = parseInt(count) || 0;
        userData.status = status || 'active';
        userData.keyType = keyType || 'Unknown';
        userData.rank = rank || 'Standard';
        if (placeId) userData.placeId = placeId;
        
        activeUsers.set(userId, userData);
        
        return res.status(200).send('keep alive');
      }
      
      // Админские действия
      if (action === 'list') {
        if (!isAdmin(password)) return res.status(401).json({ error: 'Unauthorized' });
        
        const users = [];
        for (const [id, data] of activeUsers) {
          users.push({ userId: id, ...data, lastHeartbeat: data.lastHeartbeat });
        }
        return res.status(200).json({ users, banned: Array.from(bannedUsers) });
      }
      
      if (action === 'ban') {
        if (!isAdmin(password)) return res.status(401).json({ error: 'Unauthorized' });
        bannedUsers.add(targetUserId);
        activeUsers.delete(targetUserId);
        return res.status(200).json({ success: true, banned: targetUserId });
      }
      
      if (action === 'unban') {
        if (!isAdmin(password)) return res.status(401).json({ error: 'Unauthorized' });
        bannedUsers.delete(targetUserId);
        return res.status(200).json({ success: true, unbanned: targetUserId });
      }
      
      return res.status(400).send('Invalid action');
    }
    
    return res.status(405).send('Method not allowed');
  } catch (e) {
    console.error('Heartbeat error:', e);
    return res.status(500).send('error');
  }
}
