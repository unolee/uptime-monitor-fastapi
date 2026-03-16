const BASE_URL = "http://localhost:4001";

export function getBaseUrl(): string {
  return BASE_URL;
}

export function createApi() {
  async function request(method: string, path: string, body?: unknown) {
    const res = await fetch(`${BASE_URL}${path}`, {
      method,
      headers: body ? { "Content-Type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
    return res.json();
  }

  return {
    get: (path: string) => request("GET", path),
    post: (path: string, body?: unknown) => request("POST", path, body),
    put: (path: string, body: unknown) => request("PUT", path, body),
    del: (path: string) => request("DELETE", path),
  };
}

export async function pingServer(): Promise<{ ok: boolean; ms: number }> {
  const start = Date.now();
  try {
    const res = await fetch(`${BASE_URL}/`, { signal: AbortSignal.timeout(5000) });
    return { ok: res.ok, ms: Date.now() - start };
  } catch {
    return { ok: false, ms: Date.now() - start };
  }
}
