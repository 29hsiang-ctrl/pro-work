import { getDb, ok, err } from './lib/mongodb.js';

export const handler = async (event) => {
    if (event.httpMethod === 'OPTIONS') return ok({});
    try {
        const db = await getDb();
        const col = db.collection('calendarEntries');

        switch (event.httpMethod) {
            case 'GET': {
                const projectId = event.queryStringParameters?.projectId;
                const query = projectId ? { projectId } : {};
                const entries = await col.find(query).toArray();
                entries.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
                return ok(entries.map(({ _id, ...r }) => ({ id: _id, ...r })));
            }
            case 'POST': {
                const entry = JSON.parse(event.body || '{}');
                if (!entry.id) return err(400, '缺少 id');
                await col.replaceOne({ _id: entry.id }, { _id: entry.id, ...entry }, { upsert: true });
                return ok({ ok: true });
            }
            case 'DELETE': {
                const rawId = event.queryStringParameters?.id;
                if (!rawId) return err(400, '缺少 id');
                const id = rawId && !isNaN(rawId) ? Number(rawId) : rawId;
                await col.deleteOne({ _id: id });
                return ok({ ok: true });
            }
            default: return err(405, 'Method Not Allowed');
        }
    } catch (e) {
        console.error(e);
        return err(500, e.message);
    }
};
