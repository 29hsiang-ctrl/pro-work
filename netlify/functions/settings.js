import { getDb, ok, err } from './lib/mongodb.js';

const DOC_ID = 'global';

export const handler = async (event) => {
    if (event.httpMethod === 'OPTIONS') return ok({});
    try {
        const db = await getDb();
        const col = db.collection('settings');

        switch (event.httpMethod) {
            case 'GET': {
                const doc = await col.findOne({ _id: DOC_ID }, { projection: { _id: 0 } });
                return ok(doc || {});
            }
            case 'POST': {
                const body = JSON.parse(event.body);
                await col.updateOne(
                    { _id: DOC_ID },
                    { $set: body },
                    { upsert: true },
                );
                return ok({ ok: true });
            }
            default: return err(405, 'Method Not Allowed');
        }
    } catch (e) {
        console.error(e);
        return err(500, e.message);
    }
};
