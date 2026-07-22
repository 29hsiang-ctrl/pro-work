import { MongoClient } from 'mongodb';

let client = null;
let db = null;

export async function getDb() {
    if (db) return db;
    if (!process.env.MONGODB_URI) throw new Error('MONGODB_URI not set');
    client = new MongoClient(process.env.MONGODB_URI, {
        serverSelectionTimeoutMS: 10000,
        connectTimeoutMS: 10000,
        maxPoolSize: 10,
    });
    await client.connect();
    db = client.db('prowork');
    return db;
}
