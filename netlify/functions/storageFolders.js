import { getDb, ok, err } from './lib/mongodb.js';

function uid() { return Math.random().toString(36).slice(2, 10); }

export const handler = async (event) => {
    if (event.httpMethod === 'OPTIONS') return ok({});
    try {
        const db = await getDb();
        const folders = db.collection('storageFolders');
        const items   = db.collection('storageItems');
        const q = event.queryStringParameters || {};

        switch (event.httpMethod) {
            case 'GET': {
                const docs = await folders.find({}).sort({ name: 1 }).toArray();
                return ok(docs.map(({ _id, ...rest }) => ({ id: _id, ...rest })));
            }
            case 'POST': {
                const { name } = JSON.parse(event.body);
                if (!name?.trim()) return err(400, '缺少名稱');
                const id = uid();
                const folder = { id, name: name.trim(), createdAt: new Date().toISOString() };
                await folders.insertOne({ _id: id, ...folder });
                return ok(folder);
            }
            case 'PUT': {
                const { id, name } = JSON.parse(event.body);
                if (!id || !name?.trim()) return err(400, '缺少欄位');
                await folders.updateOne({ _id: id }, { $set: { name: name.trim() } });
                return ok({ ok: true });
            }
            case 'DELETE': {
                if (!q.id) return err(400, '缺少 id');
                await folders.deleteOne({ _id: q.id });
                await items.updateMany({ folderId: q.id }, { $set: { folderId: null } });
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
