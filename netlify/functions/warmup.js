import { getDb } from './lib/mongodb.js';

export const handler = async () => {
    try { await getDb(); } catch {}
    return { statusCode: 200, body: '' };
};
