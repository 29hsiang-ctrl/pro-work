import { Router } from 'express';
import { getDb } from '../db.js';

const router = Router();

function uid() { return Math.random().toString(36).slice(2, 10); }

router.get('/', async (req, res, next) => {
    try {
        const db = await getDb();
        const docs = await db.collection('storageFolders').find({}).toArray();
        docs.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
        res.json(docs.map(({ _id, ...rest }) => ({ id: _id, ...rest })));
    } catch (e) { next(e); }
});

router.post('/', async (req, res, next) => {
    try {
        const db = await getDb();
        const { name } = req.body || {};
        if (!name?.trim()) return res.status(400).json({ error: '缺少名稱' });
        const id = uid();
        const folder = { id, name: name.trim(), createdAt: new Date().toISOString() };
        await db.collection('storageFolders').insertOne({ _id: id, ...folder });
        res.json(folder);
    } catch (e) { next(e); }
});

router.put('/', async (req, res, next) => {
    try {
        const db = await getDb();
        const { id, name } = req.body || {};
        if (!id || !name?.trim()) return res.status(400).json({ error: '缺少欄位' });
        await db.collection('storageFolders').updateOne({ _id: id }, { $set: { name: name.trim() } });
        res.json({ ok: true });
    } catch (e) { next(e); }
});

router.delete('/', async (req, res, next) => {
    try {
        const db = await getDb();
        const id = req.query.id;
        if (!id) return res.status(400).json({ error: '缺少 id' });
        await db.collection('storageFolders').deleteOne({ _id: id });
        await db.collection('storageItems').updateMany({ folderId: id }, { $set: { folderId: null } });
        res.json({ ok: true });
    } catch (e) { next(e); }
});

export default router;
