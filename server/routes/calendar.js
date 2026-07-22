import { Router } from 'express';
import { getDb } from '../db.js';

const router = Router();

router.get('/', async (req, res, next) => {
    try {
        const db = await getDb();
        const col = db.collection('calendarEntries');
        const query = req.query.projectId ? { projectId: req.query.projectId } : {};
        const entries = await col.find(query).toArray();
        entries.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
        res.json(entries.map(({ _id, ...r }) => ({ id: _id, ...r })));
    } catch (e) { next(e); }
});

router.post('/', async (req, res, next) => {
    try {
        const db = await getDb();
        const entry = req.body || {};
        if (!entry.id) return res.status(400).json({ error: '缺少 id' });
        await db.collection('calendarEntries').replaceOne(
            { _id: entry.id },
            { _id: entry.id, ...entry },
            { upsert: true }
        );
        res.json({ ok: true });
    } catch (e) { next(e); }
});

router.delete('/', async (req, res, next) => {
    try {
        const db = await getDb();
        const rawId = req.query.id;
        if (!rawId) return res.status(400).json({ error: '缺少 id' });
        const id = !isNaN(rawId) ? Number(rawId) : rawId;
        await db.collection('calendarEntries').deleteOne({ _id: id });
        res.json({ ok: true });
    } catch (e) { next(e); }
});

export default router;
