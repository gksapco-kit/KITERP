import type { APIRequestContext } from '@playwright/test';

const API_BASE = process.env.API_BASE_URL || 'http://127.0.0.1:8000/api/v1';

export const VENDOR_EMAIL = process.env.TEST_VENDOR_EMAIL || 'vendor@kiterp.com';
export const VENDOR_PASSWORD = process.env.TEST_VENDOR_PASSWORD || 'vendor123';

export type ApiAuth = { token: string; headers: Record<string, string> };

export async function apiLogin(request: APIRequestContext): Promise<ApiAuth> {
  const res = await request.post(`${API_BASE}/auth/login`, {
    data: { login: VENDOR_EMAIL, password: VENDOR_PASSWORD },
  });
  if (!res.ok()) {
    throw new Error(`Login failed (${res.status()}): ${await res.text()}`);
  }
  const body = await res.json();
  const token = body.access_token as string;
  return { token, headers: { Authorization: `Bearer ${token}` } };
}

export async function ensureRestaurantModules(request: APIRequestContext, auth: ApiAuth) {
  const me = await request.get(`${API_BASE}/vendors/me`, { headers: auth.headers });
  if (!me.ok()) throw new Error(`GET /vendors/me failed: ${await me.text()}`);
  const vendor = await me.json();
  const settings = { ...(vendor.settings || {}), restaurant_enabled: true, pos_enabled: true };
  const patch = await request.put(`${API_BASE}/vendors/me`, {
    headers: auth.headers,
    data: { settings },
  });
  if (!patch.ok()) throw new Error(`PUT /vendors/me failed: ${await patch.text()}`);
}

export async function ensureProduct(
  request: APIRequestContext,
  auth: ApiAuth,
  spec: { name: string; price: number; category: string },
): Promise<{ id: string; name: string; price: number }> {
  const list = await request.get(`${API_BASE}/vendors/me/products`, {
    headers: auth.headers,
    params: { search: spec.name, limit: '20', status: 'active' },
  });
  if (!list.ok()) throw new Error(`List products failed: ${await list.text()}`);
  const data = await list.json();
  const existing = (data.items || []).find((p: { name: string }) => p.name === spec.name);
  if (existing) {
    return { id: existing.id, name: existing.name, price: Number(existing.price ?? spec.price) };
  }

  const productData = JSON.stringify({
    name: spec.name,
    price: spec.price,
    category: spec.category,
    status: 'active',
    item_type: 'product',
    tax_rate: 0,
  });
  const created = await request.post(`${API_BASE}/vendors/me/products`, {
    headers: auth.headers,
    multipart: { product_data: productData },
  });
  if (!created.ok()) throw new Error(`Create product "${spec.name}" failed: ${await created.text()}`);
  const p = await created.json();
  return { id: p.id, name: p.name, price: Number(p.price ?? spec.price) };
}

export async function ensureRestaurantSetup(
  request: APIRequestContext,
  auth: ApiAuth,
): Promise<{ zoneId: string; tables: Record<string, { id: string; label: string }> }> {
  const zonesRes = await request.get(`${API_BASE}/vendors/me/restaurant/zones`, { headers: auth.headers });
  if (!zonesRes.ok()) throw new Error(`List zones failed: ${await zonesRes.text()}`);
  const zones = (await zonesRes.json()).items || [];
  let zone = zones.find((z: { name: string }) => z.name === 'Indoor');
  if (!zone) {
    const zc = await request.post(`${API_BASE}/vendors/me/restaurant/zones`, {
      headers: auth.headers,
      data: { name: 'Indoor', sort_order: 0 },
    });
    if (!zc.ok()) throw new Error(`Create zone failed: ${await zc.text()}`);
    zone = await zc.json();
  }

  const tablesRes = await request.get(`${API_BASE}/vendors/me/restaurant/tables`, { headers: auth.headers });
  if (!tablesRes.ok()) throw new Error(`List tables failed: ${await tablesRes.text()}`);
  const existing = (await tablesRes.json()).items || [];
  const tableMap: Record<string, { id: string; label: string }> = {};

  for (const label of ['T1', 'T2', 'T3']) {
    let t = existing.find((x: { label: string }) => x.label === label);
    if (!t) {
      const tc = await request.post(`${API_BASE}/vendors/me/restaurant/tables`, {
        headers: auth.headers,
        data: { label, zone_id: zone.id, capacity: label === 'T2' ? 2 : label === 'T3' ? 6 : 4 },
      });
      if (!tc.ok()) throw new Error(`Create table ${label} failed: ${await tc.text()}`);
      t = await tc.json();
    }
    tableMap[label] = { id: t.id, label: t.label };
  }

  return { zoneId: zone.id, tables: tableMap };
}

/** Void open/billed orders and reset table to free for a clean Scenario 1 run. */
export async function ensurePosSessionOpen(request: APIRequestContext, auth: ApiAuth) {
  const current = await request.get(`${API_BASE}/vendors/me/pos/sessions/current`, { headers: auth.headers });
  if (current.ok()) {
    const body = await current.json();
    if (body.session) return;
  }
  const opened = await request.post(`${API_BASE}/vendors/me/pos/sessions/open`, {
    headers: auth.headers,
    data: { opening_cash: 0 },
  });
  if (!opened.ok() && opened.status() !== 400) {
    throw new Error(`Open POS session failed: ${await opened.text()}`);
  }
}

export async function getVendorSlug(request: APIRequestContext, auth: ApiAuth): Promise<string> {
  const me = await request.get(`${API_BASE}/vendors/me`, { headers: auth.headers });
  if (!me.ok()) throw new Error(`GET /vendors/me failed: ${await me.text()}`);
  const vendor = await me.json();
  if (!vendor.slug) throw new Error('Vendor slug missing');
  return vendor.slug as string;
}

export async function ensureTableQrToken(
  request: APIRequestContext,
  auth: ApiAuth,
  tableId: string,
): Promise<string> {
  const tablesRes = await request.get(`${API_BASE}/vendors/me/restaurant/tables`, { headers: auth.headers });
  if (!tablesRes.ok()) throw new Error(`List tables failed: ${await tablesRes.text()}`);
  const items = (await tablesRes.json()).items || [];
  const table = items.find((t: { id: string }) => t.id === tableId);
  if (table?.qr_token) return table.qr_token as string;

  const gen = await request.post(`${API_BASE}/vendors/me/restaurant/tables/${tableId}/generate-qr`, {
    headers: auth.headers,
    data: {},
  });
  if (!gen.ok()) throw new Error(`Generate QR failed: ${await gen.text()}`);
  const body = await gen.json();
  return body.qr_token as string;
}

export function storefrontTableOrderUrl(slug: string, qrToken: string): string {
  const base = process.env.STOREFRONT_URL || 'http://127.0.0.1:3002';
  return `${base}/store/${encodeURIComponent(slug)}/table/${encodeURIComponent(qrToken)}`;
}

export function storefrontReserveUrl(slug: string): string {
  const base = process.env.STOREFRONT_URL || 'http://127.0.0.1:3002';
  return `${base}/store/${encodeURIComponent(slug)}/reserve`;
}

export function dateOffset(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

export async function resetTableForScenario(
  request: APIRequestContext,
  auth: ApiAuth,
  tableId: string,
) {
  const ordersRes = await request.get(`${API_BASE}/vendors/me/restaurant/orders`, { headers: auth.headers });
  if (!ordersRes.ok()) return;
  const orders = (await ordersRes.json()).items || [];
  for (const o of orders) {
    if (o.table_id !== tableId) continue;
    if (!['open', 'billed'].includes(o.status)) continue;
    await request.patch(`${API_BASE}/vendors/me/restaurant/orders/${o.id}/void`, {
      headers: auth.headers,
      data: {},
    });
  }
  await request.patch(`${API_BASE}/vendors/me/restaurant/tables/${tableId}/status`, {
    headers: auth.headers,
    data: { status: 'free' },
  });
}

export async function ensureRestaurant(
  request: APIRequestContext,
  auth: ApiAuth,
): Promise<{ id: string; name: string }> {
  const list = await request.get(`${API_BASE}/vendors/me/restaurants`, { headers: auth.headers });
  if (!list.ok()) throw new Error(`List restaurants failed: ${await list.text()}`);
  const items = (await list.json()).items || [];
  const existing = items.find((r: { is_default?: boolean }) => r.is_default) || items[0];
  if (existing) return { id: existing.id, name: existing.name };

  const stores = await request.get(`${API_BASE}/vendors/me/stores`, { headers: auth.headers });
  if (!stores.ok()) throw new Error(`List stores failed: ${await stores.text()}`);
  const storeItems = (await stores.json()).items || [];
  const store = storeItems[0];
  if (!store) throw new Error('No business unit store found for restaurant setup');

  const created = await request.post(`${API_BASE}/vendors/me/restaurants`, {
    headers: auth.headers,
    data: { store_id: store.id, name: 'Main Restaurant', is_default: true, is_active: true },
  });
  if (!created.ok()) throw new Error(`Create restaurant failed: ${await created.text()}`);
  const body = await created.json();
  return { id: body.id, name: body.name };
}

export async function ensureRestaurantZoneForOutlet(
  request: APIRequestContext,
  auth: ApiAuth,
  restaurantId: string,
  zoneName = 'Indoor',
): Promise<{ zoneId: string; zoneName: string }> {
  const zonesRes = await request.get(`${API_BASE}/vendors/me/restaurant/zones`, {
    headers: auth.headers,
    params: { restaurant_id: restaurantId },
  });
  if (!zonesRes.ok()) throw new Error(`List zones failed: ${await zonesRes.text()}`);
  const zones = (await zonesRes.json()).items || [];
  const existing = zones.find((z: { name: string }) => z.name === zoneName);
  if (existing) return { zoneId: existing.id, zoneName: existing.name };

  const created = await request.post(`${API_BASE}/vendors/me/restaurant/zones`, {
    headers: auth.headers,
    data: { name: zoneName, restaurant_id: restaurantId, sort_order: 0 },
  });
  if (!created.ok()) throw new Error(`Create zone failed: ${await created.text()}`);
  const body = await created.json();
  return { zoneId: body.id, zoneName: body.name };
}

export async function deleteMenuById(request: APIRequestContext, auth: ApiAuth, menuId: string) {
  await request.delete(`${API_BASE}/vendors/me/restaurant/menus/${menuId}`, { headers: auth.headers });
}
