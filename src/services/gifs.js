/**
 * src/services/gifs.js
 *
 * GIF provider service using Klipy API.
 * All provider-specific logic lives here; swap the provider by editing only this file.
 *
 * Klipy API docs: https://docs.klipy.com
 *   Trending : GET https://api.klipy.com/api/v1/{app_key}/gifs/trending?page=1&per_page=20
 *   Search   : GET https://api.klipy.com/api/v1/{app_key}/gifs/search?q={q}&page=1&per_page=20
 *
 * Auth: app_key embedded in URL path (not a header).
 * Attribution: use "Search KLIPY" as search input placeholder (REQUIRED per Klipy docs).
 *
 * Normalized item shape: { id, previewUrl, url, width, height }
 *   previewUrl ? xs/sm webp/gif for fast thumbnail display
 *   url        ? hd/md gif for sending (stored in Firestore)
 */

const BASE = "https://api.klipy.com/api/v1";
const KEY = process.env.REACT_APP_GIF_API_KEY || "";

/** Parse a single Klipy GIF item into normalized shape. */
function parseItem(item) {
  const file = item.file || {};
  const previewSrc =
    file.xs?.webp || file.xs?.gif ||
    file.sm?.webp || file.sm?.gif ||
    file.md?.gif || file.hd?.gif || {};
  const fullSrc =
    file.hd?.gif || file.md?.gif || file.sm?.gif || {};
  return {
    id: String(item.id ?? item.slug ?? Math.random()),
    previewUrl: previewSrc.url || "",
    url: fullSrc.url || previewSrc.url || "",
    width: fullSrc.width || previewSrc.width || 320,
    height: fullSrc.height || previewSrc.height || 240,
  };
}

/** Parse Klipy API response: { result, data: { data: [...], pagination: { next_page } } } */
function parseResponse(json) {
  const outerData = json?.data || {};
  const items = (outerData.data || []).map(parseItem).filter((g) => g.url);
  const pagination = outerData.pagination || {};
  const nextPage = pagination.next_page ?? null;
  return { items, nextPage };
}

/**
 * Fetch trending GIFs from Klipy.
 * @param {{ limit?: number, page?: number, signal?: AbortSignal }} opts
 * @returns {Promise<{ items: {id,previewUrl,url,width,height}[], nextPage: number|null }>}
 */
export async function trendingGifs({ limit = 20, page = 1, signal } = {}) {
  if (!KEY) throw new Error("REACT_APP_GIF_API_KEY is not set");
  const url = `${BASE}/${KEY}/gifs/trending?page=${page}&per_page=${Math.min(limit, 50)}`;
  const res = await fetch(url, { signal });
  if (!res.ok) throw new Error(`Klipy trending: HTTP ${res.status}`);
  const json = await res.json();
  return parseResponse(json);
}

/**
 * Search Klipy GIFs by keyword.
 * @param {string} query
 * @param {{ limit?: number, page?: number, signal?: AbortSignal }} opts
 * @returns {Promise<{ items: {id,previewUrl,url,width,height}[], nextPage: number|null }>}
 */
export async function searchGifs(query, { limit = 20, page = 1, signal } = {}) {
  if (!KEY) throw new Error("REACT_APP_GIF_API_KEY is not set");
  const q = encodeURIComponent(query.trim());
  const url = `${BASE}/${KEY}/gifs/search?q=${q}&page=${page}&per_page=${Math.min(limit, 50)}`;
  const res = await fetch(url, { signal });
  if (!res.ok) throw new Error(`Klipy search: HTTP ${res.status}`);
  const json = await res.json();
  return parseResponse(json);
}
