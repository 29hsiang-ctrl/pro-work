import { Router } from 'express';
import { getDb } from '../db.js';

const router = Router();

function parseId(raw) {
    return raw && !isNaN(raw) ? Number(raw) : raw;
}

router.get('/', async (req, res, next) => {
    try {
        const db = await getDb();
        const col = db.collection('calendarEntries');
        const docs = await col.find({ 'images.0': { $exists: true } }).toArray();
        docs.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
        res.json(docs.map(({ _id, images, ...rest }) => ({
            id: _id,
            projectId: rest.projectId,
            date: rest.date,
            floor: rest.floor,
            direction: rest.direction,
            item: rest.item,
            content: rest.content,
            images: (images || []).map(img => ({ preview: img.preview })),
        })));
    } catch (e) { next(e); }
});

router.delete('/', async (req, res, next) => {
    try {
        const db = await getDb();
        const col = db.collection('calendarEntries');
        const entryId = parseId(req.query.entryId);
        const imageIdx = parseInt(req.query.imageIdx, 10);
        if (!entryId || isNaN(imageIdx)) return res.status(400).json({ error: '缺少參數' });
        const doc = await col.findOne({ _id: entryId });
        if (!doc) return res.status(404).json({ error: '找不到記錄' });
        const images = (doc.images || []).filter((_, i) => i !== imageIdx);
        await col.replaceOne({ _id: entryId }, { ...doc, images });
        res.json({ ok: true, remaining: images.length });
    } catch (e) { next(e); }
});

export default router;
