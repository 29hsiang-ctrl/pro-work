const BASE = '/api';

async function request(method, path, body) {
    const res = await fetch(`${BASE}${path}`, {
        method,
        headers: body !== undefined ? { 'Content-Type': 'application/json' } : {},
        body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    if (!res.ok) {
        const text = await res.text();
        throw new Error(`API ${method} ${path} → ${res.status}: ${text}`);
    }
    return res.json();
}

export const api = {
    get:    (path)        => request('GET',    path),
    post:   (path, body)  => request('POST',   path, body),
    put:    (path, body)  => request('PUT',    path, body),
    delete: (path)        => request('DELETE', path),
};
