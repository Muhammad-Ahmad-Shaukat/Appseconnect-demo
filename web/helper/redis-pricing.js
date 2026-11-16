import Redis from 'ioredis';
import { PriceChangeDB } from '../price-change-db.js';

export async function getRedisConfigForShop(shop) {
  if (!shop) return null;
  try {
    const rows = await PriceChangeDB.Getsettings(shop);
    const row = rows && rows[0];
    if (!row) return null;
    const host = row.redis_host;
    const port = row.redis_port != null ? parseInt(String(row.redis_port), 10) : null;
    if (!host || !port || isNaN(port)) return null;
    return {
      host: String(host).trim(),
      port,
      password: row.redis_password != null ? String(row.redis_password) : undefined,
      username: row.redis_username != null ? String(row.redis_username) : undefined,
      retryStrategy: (times) => Math.min(times * 50, 2000),
      maxRetriesPerRequest: 3,
    };
  } catch (e) {
    console.error("[Proxy] getRedisConfigForShop error:", e.message);
    return null;
  }
}

export function createRedisClient(config) {
  return new Redis(config);
}

export async function getRedisPricesForSkus(redis, customerId, skuList) {
  const priceMap = {};
  if (!skuList || skuList.length === 0) {
    return { allFound: true, priceMap };
  }
  try {
    for (const sku of skuList) {
      let s = '';
      if (typeof sku === 'string') {
        s = sku.trim();
      } else if (sku && sku.sku) {
        s = sku.sku.trim();
      }
      if (!s) continue;
      const price = await redis.get(`${customerId}_${s}`);
      if (price !== null && price !== undefined && String(price).trim() !== "" && Number.isFinite(Number(price)) && Number(price) >= 0) {
        priceMap[s] = Number(price);
      }
    }

    const requested = skuList.map(sku => {
      if (typeof sku === 'string') return sku.trim();
      if (sku && sku.sku) return sku.sku.trim();
      return '';
    }).filter(Boolean);

    const allFound = requested.length > 0 && requested.every(s => priceMap[s] !== undefined);
    return { allFound, priceMap };
  } catch (error) {
    console.error(`[Redis] Error getting prices for customer ${customerId}:`, error.message);
    return { allFound: false, priceMap, error: error.message };
  }
}

