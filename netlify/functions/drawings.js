import { getDb, ok, err } from './lib/mongodb.js';

export const handler = async (event) => {
    if (event.httpMethod === 'OPTIONS') return ok({});
    try {
        const db = await getDb();
        const col = db.collection('drawings');
        const q = event.queryStringParameters || {};

        switch (event.httpMethod) {
            case 'GET': {
                const docs = await col.find({}, { projection: { _id: 0 } }).toArray();
                return ok(docs);
            }
            case 'POST': {
                const doc = JSON.parse(event.body);
                await col.insertOne({ _id: doc.id, ...doc });
                return ok(doc);
            }
            case 'PUT': {
                const { id, ...fields } = JSON.parse(event.body);
                await col.updateOne({ id }, { $set: fields });
                return ok({ ok: true });
            }
            case 'DELETE': {
                await col.deleteOne({ id: q.id });
                return ok({ ok: true });
            }
            default: return err(405, 'Method Not Allowed');
        }
    } catch (e) {
        console.error(e);
        return err(500, e.message);
    }
};
