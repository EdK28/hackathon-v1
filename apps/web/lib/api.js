// Client-side fetch helper. Calls go to /api/* on this Next.js server, which
// proxies them to Express (see next.config.mjs), so cookies just work.
export class ApiError extends Error {
  constructor(status, body) {
    super(body?.error || `Request failed (${status})`);
    this.status = status;
    this.details = body?.details;
    this.body = body;
  }
}

export async function api(path, { method = 'GET', body, headers } = {}) {
  const isForm = typeof FormData !== 'undefined' && body instanceof FormData;
  const res = await fetch(`/api${path}`, {
    method,
    headers: isForm ? headers : { 'Content-Type': 'application/json', ...headers },
    body: body === undefined ? undefined : isForm ? body : JSON.stringify(body),
    credentials: 'same-origin',
  });
  const text = await res.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = { error: text };
  }
  if (!res.ok) {
    // The Next.js proxy returns a bare "Internal Server Error" when the API isn't running
    if (res.status >= 500 && (!data || typeof data.error !== 'string' || /internal server error/i.test(data.error))) {
      data = { error: "Can't reach the server. Check that the API is running (look for [api] errors in the terminal)." };
    }
    throw new ApiError(res.status, data);
  }
  return data;
}

/** Human-readable message from an ApiError, including field-level details. */
export function errorMessage(err) {
  if (!err) return '';
  const details = Array.isArray(err.details) ? err.details.map((d) => d.message || d.reason).filter(Boolean) : [];
  return [err.message, ...details].join(' · ');
}
