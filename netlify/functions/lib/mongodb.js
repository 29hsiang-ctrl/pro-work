import { MongoClient } from 'mongodb';

let cached = null;

export async function getDb() {
    if (cached) return cached;
    if (!process.env.MONGODB_URI) throw new Error('MONGODB_URI not set');
    const client = new MongoClient(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 5000 });
    await client.connect();
    cached = client.db('prowork');
    return cached;
}

export const ok = (body) => ({
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
});

export const err = (status, msg) => ({
    statusCode: status,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ error: msg }),
});
