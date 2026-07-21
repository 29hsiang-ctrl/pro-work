import { getDb, ok, err } from './lib/mongodb.js';

function parseId(raw) {
    return raw && !isNaN(raw) ? Number(raw) : raw;
}

export const handler = async (event) => {
    if (event.httpMethod === 'OPTIONS') return ok({});
    const q = event.queryStringParameters || {};
    try {
        const db = await getDb();
        const col = db.collection('calendarEntries');

        if (event.httpMethod === 'GET') {
            const docs = await col.find({ 'images.0': { $exists: true } }).toArray();
            docs.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
            return ok(docs.map(({ _id, images, ...rest }) => ({
                id: _id,
                projectId: rest.projectId,
                date: rest.date,
                floor: rest.floor,
                direction: rest.direction,
                item: rest.item,
                content: rest.content,
                images: (images || []).map(img => ({ preview: img.preview })),
            })));
        }

        if (event.httpMethod === 'DELETE') {
            const entryId = parseId(q.entryId);
            const imageIdx = parseInt(q.imageIdx, 10);
            if (!entryId || isNaN(imageIdx)) return err(400, '缺少參數');
            const doc = await col.findOne({ _id: entryId });
            if (!doc) return err(404, '找不到記錄');
            const images = (doc.images || []).filter((_, i) => i !== imageIdx);
            await col.replaceOne({ _id: entryId }, { ...doc, images });
            return ok({ ok: true, remaining: images.length });
        }

        return err(405, 'Method Not Allowed');
    } catch (e) {
        console.error(e);
        return err(500, e.message);
    }
};
