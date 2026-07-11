import { getDb, ok, err } from './lib/mongodb.js';

function uid() { return Math.random().toString(36).slice(2, 10); }

export const handler = async (event) => {
    if (event.httpMethod === 'OPTIONS') return ok({});
    try {
        const db = await getDb();
        const col = db.collection('storageItems');
        const q = event.queryStringParameters || {};

        switch (event.httpMethod) {
            case 'GET': {
                const docs = await col.find({}).sort({ createdAt: -1 }).toArray();
                return ok(docs.map(({ _id, ...rest }) => ({ id: _id, ...rest })));
            }
            case 'POST': {
                const doc = JSON.parse(event.body);
                const id = doc.id || uid();
                const now = new Date().toISOString();
                const item = { id, title: doc.title || '未命名', category: doc.category || '', content: doc.content || '', createdAt: now, updatedAt: now };
                await col.insertOne({ _id: id, ...item });
                return ok(item);
            }
            case 'PUT': {
                const { id, title, category, content, folderId } = JSON.parse(event.body);
                if (!id) return err(400, '缺少 id');
                const updatedAt = new Date().toISOString();
                const patch = { updatedAt };
                if (title     !== undefined) patch.title    = title;
                if (category  !== undefined) patch.category = category;
                if (content   !== undefined) patch.content  = content;
                if (folderId  !== undefined) patch.folderId = folderId;
                await col.updateOne({ _id: id }, { $set: patch });
                return ok({ ok: true, updatedAt });
            }
            case 'DELETE': {
                if (!q.id) return err(400, '缺少 id');
                await col.deleteOne({ _id: q.id });
                return ok({ ok: true });
            }
            default:
                return err(405, 'Method Not Allowed');
        }
    } catch (e) {
        console.error(e);
        return err(500, e.message);
    }
};
