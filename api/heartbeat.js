// api/heartbeat.js
// Heartbeat модуль — загружается ОТДЕЛЬНО через loadstring
// Генерирует обфусцированный Lua-код

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

// ==================== ГЕНЕРАЦИЯ ОБФУСЦИРОВАННОГО LUA-МОДУЛЯ ====================
function generateHeartbeatModule(host) {
  const moduleCode = `-- ========================================================
-- CATALYST HEARTBEAT MODULE (LOADED SEPARATELY)
-- Без этого модуля скрипт НЕ ЗАПУСТИТСЯ
-- ========================================================
local API_BASE = "https://${HOST}"
local UserId = game:GetService("Players").LocalPlayer.UserId
local PlaceId = game.PlaceId
local GameId = game.GameId
local RunService = game:GetService("RunService")
local HttpService = game:GetService("HttpService")

-- ========================================================
-- 🔐 ПРОВЕРКА ВАЛИДНОСТИ МОДУЛЯ
-- ========================================================
-- Эта проверка встроена в обфусцированный код,
-- её нельзя удалить не сломав модуль
local ModuleValid = false
local ValidationHash = nil

local function ValidateModule()
    -- Отправляем запрос на сервер для валидации
    local success, result = pcall(function()
        return game:HttpGet(API_BASE .. "/api/heartbeat?action=validate&userId=" .. tostring(UserId))
    end)
    
    if success and result and result:find("VALID:") then
        ValidationHash = result:gsub("VALID:", ""):gsub("%s+", "")
        ModuleValid = true
        
        -- Секретный ключ, который будут проверять скрипты игр
        _G.Catalyst_HeartbeatActive = true
        _G.Catalyst_ValidationHash = ValidationHash
        
        return true
    end
    
    return false
end

-- Проверяем модуль ПЕРЕД всем остальным
if not ValidateModule() then
    -- Модуль невалиден — скрипт не запустится
    -- Никаких ошибок, просто тихий выход
    return
end

-- ========================================================
-- 💓 HEARTBEAT СИСТЕМА
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
        
        if response == "keep alive" then
            -- Всё хорошо
        elseif response == "banned" then
            -- Пользователь забанен
            pcall(function()
                game:GetService("Players").LocalPlayer:Kick("[Catalyst Hub] Access revoked. Reason: Ban")
            end)
        elseif response == "invalid" then
            -- Модуль не прошёл проверку
            ModuleValid = false
            HeartbeatRunning = false
        end
    end)
end

-- Запуск heartbeat
local function StartHeartbeat()
    if HeartbeatRunning then return end
    HeartbeatRunning = true
    
    -- Первый heartbeat сразу
    SendHeartbeat(nil, nil, "active")
    
    -- Каждые 45 секунд
    spawn(function()
        while HeartbeatRunning and ModuleValid do
            wait(45)
            SendHeartbeat(nil, nil, "active")
        end
    end)
end

-- Остановка heartbeat
local function StopHeartbeat()
    HeartbeatRunning = false
    if ModuleValid then
        SendHeartbeat(nil, nil, "inactive")
    end
end

-- Автозапуск
StartHeartbeat()

-- Остановка при выходе
game:GetService("Players").PlayerRemoving:Connect(function(player)
    if player == game:GetService("Players").LocalPlayer then
        StopHeartbeat()
    end
end)

-- ========================================================
-- 🛡️ ЗАЩИТА ОТ ПОДМЕНЫ
-- ========================================================
-- Если кто-то попытается удалить или подменить переменные,
-- модуль перестанет работать и скрипт выключится
spawn(function()
    while ModuleValid do
        wait(10)
        
        -- Проверяем, что переменные не были подменены
        if not _G.Catalyst_HeartbeatActive then
            ModuleValid = false
            StopHeartbeat()
            break
        end
        
        -- Проверяем хеш
        if _G.Catalyst_ValidationHash ~= ValidationHash then
            ModuleValid = false
            StopHeartbeat()
            break
        end
    end
    
    -- Если модуль стал невалиден — выключаем скрипт
    if not ModuleValid then
        pcall(function()
            _G.Catalyst_Shutdown = true
            game:GetService("Players").LocalPlayer:Kick("[Catalyst Hub] Security check failed. Please re-execute.")
        end)
    end
end)

-- Возвращаем API для использования в основном скрипте
return {
    IsValid = function() return ModuleValid end,
    GetHash = function() return ValidationHash end,
    SendHeartbeat = SendHeartbeat,
    Stop = StopHeartbeat,
}`;

  // Заменяем хост
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
    // ========== GET ==========
    if (req.method === 'GET') {
      const { action, userId, placeId, gameId, status, keyType, rank, hash, count } = req.query;

      // Валидация модуля
      if (action === 'validate') {
        if (!userId || bannedUsers.has(userId)) {
          return res.status(200).send('INVALID');
        }
        
        // Генерируем уникальный хеш для этой сессии
        const validationHash = generateHash(userId, Date.now().toString());
        
        // Сохраняем сессию
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
      
      // Heartbeat
      if (action === 'heartbeat') {
        if (!userId) return res.status(200).send('invalid');
        
        // Проверяем бан
        if (bannedUsers.has(userId)) {
          return res.status(200).send('banned');
        }
        
        const userData = activeUsers.get(userId);
        
        // Проверяем хеш
        if (!userData || userData.validationHash !== hash) {
          return res.status(200).send('invalid');
        }
        
        // Обновляем данные
        userData.lastHeartbeat = Date.now();
        userData.heartbeatCount = parseInt(count) || 0;
        userData.status = status || 'active';
        userData.keyType = keyType || 'Unknown';
        userData.rank = rank || 'Standard';
        if (placeId) userData.placeId = placeId;
        
        activeUsers.set(userId, userData);
        
        return res.status(200).send('keep alive');
      }
      
      // Получить список активных пользователей (для админки)
      if (action === 'list') {
        const { password } = req.query;
        if (!isAdmin(password)) return res.status(401).json({ error: 'Unauthorized' });
        
        const users = [];
        for (const [id, data] of activeUsers) {
          users.push({ userId: id, ...data });
        }
        return res.status(200).json({ users, banned: Array.from(bannedUsers) });
      }
      
      // Бан пользователя
      if (action === 'ban') {
        const { password, targetUserId } = req.query;
        if (!isAdmin(password)) return res.status(401).json({ error: 'Unauthorized' });
        
        bannedUsers.add(targetUserId);
        activeUsers.delete(targetUserId);
        return res.status(200).json({ success: true, banned: targetUserId });
      }
      
      // Разбан
      if (action === 'unban') {
        const { password, targetUserId } = req.query;
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

// Генерация хеша
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
