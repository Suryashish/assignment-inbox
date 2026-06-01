/**
 * The atomic claim — the correctness core of the whole system.
 *
 * Redis is single-threaded, so this entire script runs atomically: no other
 * command can interleave. That's what serializes simultaneous claims on the
 * same tile and keeps the leaderboard consistent WITHOUT any app-level locking.
 *
 * KEYS[1] grid hash        field=tileId -> json{owner,color,seq}
 * KEYS[2] leaderboard zset member=userId -> tiles owned
 * KEYS[3] cooldown key     cd:<userId>   (TTL = remaining cooldown)
 * KEYS[4] seq counter      monotonic version source
 * KEYS[5] lock key         lock:<tileId> (TTL = remaining shield)
 *
 * ARGV[1] tileId   ARGV[2] userId   ARGV[3] color
 * ARGV[4] cooldownMs   ARGV[5] lockMs
 *
 * Returns: {1, seq} on success, or {0, reason, remainingMs} on rejection.
 */
export const CLAIM_LUA = `
local grid    = KEYS[1]
local lb      = KEYS[2]
local cdKey   = KEYS[3]
local seqKey  = KEYS[4]
local lockKey = KEYS[5]

local tileId     = ARGV[1]
local userId     = ARGV[2]
local color      = ARGV[3]
local cooldownMs = tonumber(ARGV[4])
local lockMs     = tonumber(ARGV[5])

-- 1. Cooldown is checked FIRST, before any mutation, and returns the exact TTL.
local cdttl = redis.call('PTTL', cdKey)
if cdttl and cdttl > 0 then
  return {0, 'cooldown', cdttl}
end

-- 2. Read the current owner (if any).
local prevOwner = false
local prevRaw = redis.call('HGET', grid, tileId)
if prevRaw then
  local ok, decoded = pcall(cjson.decode, prevRaw)
  if ok and decoded and decoded.owner then prevOwner = decoded.owner end
end

-- 3. A freshly captured tile is shielded — but only against OTHER users.
local lkttl = redis.call('PTTL', lockKey)
if lkttl and lkttl > 0 and prevOwner ~= userId then
  return {0, 'locked', lkttl}
end

-- 4. Allocate a fresh monotonic version (immune to clock skew).
local s = redis.call('INCR', seqKey)

-- 5. Write the tile.
redis.call('HSET', grid, tileId, cjson.encode({owner = userId, color = color, seq = s}))

-- 6. Adjust leaderboard ONLY on a real ownership transfer.
--    (self-overwrite => no score change; unclaimed => no phantom decrement)
if prevOwner ~= userId then
  if prevOwner then
    local ns = redis.call('ZINCRBY', lb, -1, prevOwner)
    if tonumber(ns) <= 0 then redis.call('ZREM', lb, prevOwner) end
  end
  redis.call('ZINCRBY', lb, 1, userId)
end

-- 7. Arm the per-user cooldown and the per-tile shield.
redis.call('SET', cdKey, '1', 'PX', cooldownMs)
if lockMs > 0 then
  redis.call('SET', lockKey, '1', 'PX', lockMs)
end

return {1, s}
`;

/**
 * Claim a LIST of tiles for one user at once (used by power-up effects). No
 * cooldown/lock checks — it's a bonus. Atomic, keeps the leaderboard consistent.
 *
 * KEYS[1] grid   KEYS[2] leaderboard   KEYS[3] seq
 * ARGV[1] userId   ARGV[2] color   ARGV[3..] tileIds
 * Returns a flat list: {tileId, seq, tileId, seq, ...}
 */
export const CLAIM_MANY_LUA = `
local grid = KEYS[1]
local lb   = KEYS[2]
local userId = ARGV[1]
local color  = ARGV[2]
local out = {}
for i = 3, #ARGV do
  local tileId = ARGV[i]
  local prevOwner = false
  local prevRaw = redis.call('HGET', grid, tileId)
  if prevRaw then
    local ok, d = pcall(cjson.decode, prevRaw)
    if ok and d and d.owner then prevOwner = d.owner end
  end
  local s = redis.call('INCR', KEYS[3])
  redis.call('HSET', grid, tileId, cjson.encode({owner = userId, color = color, seq = s}))
  if prevOwner ~= userId then
    if prevOwner then
      local ns = redis.call('ZINCRBY', lb, -1, prevOwner)
      if tonumber(ns) <= 0 then redis.call('ZREM', lb, prevOwner) end
    end
    redis.call('ZINCRBY', lb, 1, userId)
  end
  out[#out + 1] = tileId
  out[#out + 1] = s
end
return out
`;
