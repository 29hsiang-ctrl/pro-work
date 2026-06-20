import { getDb, ok, err } from './lib/mongodb.js';

export const handler = async (event) => {
    if (event.httpMethod === 'OPTIONS') return ok({});
    try {
        const db = await getDb();
        const col = db.collection('factorySteps');
        const q = event.queryStringParameters || {};

        switch (event.httpMethod) {
            case 'GET': {
                const docs = await col.find({}, { projection: { _id: 0 } }).toArray();
                return ok(docs);
            }
            case 'POST': {
                // 支援單筆或批次 (array)
                const body = JSON.parse(event.body);
                if (Array.isArray(body)) {
                    if (body.length > 0) await col.insertMany(body.map(d => ({ _id: d.id, ...d })));
                } else {
                    await col.insertOne({ _id: body.id, ...body });
                }
                return ok({ ok: true });
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
