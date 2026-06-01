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

export async function ensureSalesModules(request: APIRequestContext, auth: ApiAuth) {
  const me = await request.get(`${API_BASE}/vendors/me`, { headers: auth.headers });
  if (!me.ok()) throw new Error(`GET /vendors/me failed: ${await me.text()}`);
  const vendor = await me.json();
  const settings = {
    ...(vendor.settings || {}),
    pos_enabled: true,
  };
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
