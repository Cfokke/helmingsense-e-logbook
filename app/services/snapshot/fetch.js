// app/services/snapshot/fetch.js
// Fetches the Signal K "self" resource with a timeout, using Node 18+ global fetch.

export async function fetchSelf(baseUrl, timeoutSec) {
  const controller = new AbortController();
  const to = setTimeout(() => controller.abort(), Math.max(1, timeoutSec) * 1000);

  try {
    const res = await fetch(baseUrl, { signal: controller.signal });
    if (!res.ok) {
      throw new Error(`HTTP ${res.status} fetching ${baseUrl}`);
    }
    return await res.json();
  } catch (e) {
    if (e.name === "AbortError") throw new Error(`Timeout after ${timeoutSec}s fetching ${baseUrl}`);
    throw e;
  } finally {
    clearTimeout(to);
  }
}
