function normalizeApiBase(value) {
  const text = String(value || '').trim();
  if (!text) return '/api/v01';
  const normalized = text.replace(/\/+$/, '');
  if (/\/api$/i.test(normalized)) {
    return `${normalized}/v01`;
  }
  return normalized;
}

const LOCAL_APP_PORTS = new Set(['3000', '4173', '5173', '5174']);

function buildOrigin(protocol, host, port) {
  const safeHost = host.includes(':') && !host.startsWith('[') ? `[${host}]` : host;
  return `${protocol}//${safeHost}:${port}`;
}

function resolveApiBase() {
  if (process.env.REACT_APP_API_BASE_URL) {
    return normalizeApiBase(process.env.REACT_APP_API_BASE_URL);
  }

  if (typeof window !== 'undefined') {
    const host = String(window.location.hostname || '').toLowerCase();
    const rawHost = String(window.location.hostname || '').trim();
    const port = String(window.location.port || '').trim();
    if (host === 'store.shadi.ps' || host === 'admin.shadi.ps') {
      return normalizeApiBase('https://store.shadi.ps/api/v01');
    }
    if (host === 'localhost' || host === '127.0.0.1' || host === '::1' || LOCAL_APP_PORTS.has(port)) {
      return normalizeApiBase(`${buildOrigin(window.location.protocol, rawHost || host, '4000')}/api/v01`);
    }
  }

  return normalizeApiBase('/api/v01');
}

function resolvePublicBase() {
  if (process.env.REACT_APP_PUBLIC_BASE_URL) {
    return String(process.env.REACT_APP_PUBLIC_BASE_URL).trim().replace(/\/+$/, '');
  }

  if (typeof window !== 'undefined') {
    const host = String(window.location.hostname || '').toLowerCase();
    const rawHost = String(window.location.hostname || '').trim();
    const port = String(window.location.port || '').trim();
    if (host === 'store.shadi.ps' || host === 'admin.shadi.ps') {
      return 'https://store.shadi.ps';
    }
    if (host === 'localhost' || host === '127.0.0.1' || host === '::1' || LOCAL_APP_PORTS.has(port)) {
      return buildOrigin(window.location.protocol, rawHost || host, '4000');
    }
    return window.location.origin.replace(/\/+$/, '');
  }

  return '';
}

export const API_BASE = resolveApiBase();
export const PUBLIC_BASE = resolvePublicBase();

async function request(path, options = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {})
    },
    ...options
  });

  if (!res.ok) {
    const text = await res.text();
    let message = text || `Request failed: ${res.status}`;
    try {
      const parsed = JSON.parse(text);
      if (parsed && typeof parsed === 'object' && parsed.error) {
        message = String(parsed.error);
      }
    } catch {
      // keep raw text when response is not JSON
    }
    throw new Error(message);
  }

  if (res.status === 204) return null;
  const contentType = res.headers.get('content-type') || '';
  if (!contentType.includes('application/json')) {
    const text = await res.text();
    throw new Error(text.startsWith('<!doctype') || text.startsWith('<html')
      ? 'API returned HTML instead of JSON. Check the API URL or server routing.'
      : 'API returned a non-JSON response.');
  }
  return res.json();
}

export const api = {
  get: (path, options = {}) => request(path, options),
  post: (path, body, options = {}) => request(path, { method: 'POST', body: JSON.stringify(body || {}), ...options }),
  put: (path, body, options = {}) => request(path, { method: 'PUT', body: JSON.stringify(body || {}), ...options }),
  del: (path, options = {}) => request(path, { method: 'DELETE', ...options })
};
