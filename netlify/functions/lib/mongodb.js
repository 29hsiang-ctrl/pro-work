import { MongoClient } from 'mongodb';

let client = null;
let db = null;

export async function getDb() {
    if (client && db) {
        try {
            await db.command({ ping: 1 });
            return db;
        } catch {
            client = null;
            db = null;
        }
    }
    if (!process.env.MONGODB_URI) throw new Error('MONGODB_URI not set');
    client = new MongoClient(process.env.MONGODB_URI, {
        serverSelectionTimeoutMS: 10000,
        connectTimeoutMS: 10000,
        maxPoolSize: 1,
    });
    await client.connect();
    db = client.db('prowork');
    return db;
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
