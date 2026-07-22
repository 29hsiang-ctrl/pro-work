import { Router } from 'express';
import { getDb } from '../db.js';

const router = Router();

function uid() { return Math.random().toString(36).slice(2, 10); }

router.get('/', async (req, res, next) => {
    try {
        const db = await getDb();
        const docs = await db.collection('storageItems').find({}).toArray();
        docs.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        res.json(docs.map(({ _id, ...rest }) => ({ id: _id, ...rest })));
    } catch (e) { next(e); }
});

router.post('/', async (req, res, next) => {
    try {
        const db = await getDb();
        const doc = req.body || {};
        const id = doc.id || uid();
        const now = new Date().toISOString();
        const item = {
            id,
            title: doc.title || '未命名',
            category: doc.category || '',
            content: doc.content || '',
            createdAt: now,
            updatedAt: now,
        };
        await db.collection('storageItems').insertOne({ _id: id, ...item });
        res.json(item);
    } catch (e) { next(e); }
});

router.put('/', async (req, res, next) => {
    try {
        const db = await getDb();
        const { id, title, category, content, folderId } = req.body || {};
        if (!id) return res.status(400).json({ error: '缺少 id' });
        const updatedAt = new Date().toISOString();
        const patch = { updatedAt };
        if (title    !== undefined) patch.title    = title;
        if (category !== undefined) patch.category = category;
        if (content  !== undefined) patch.content  = content;
        if (folderId !== undefined) patch.folderId = folderId;
        await db.collection('storageItems').updateOne({ _id: id }, { $set: patch });
        res.json({ ok: true, updatedAt });
    } catch (e) { next(e); }
});

router.delete('/', async (req, res, next) => {
    try {
        const db = await getDb();
        if (!req.query.id) return res.status(400).json({ error: '缺少 id' });
        await db.collection('storageItems').deleteOne({ _id: req.query.id });
        res.json({ ok: true });
    } catch (e) { next(e); }
});

export default router;
