import { Router } from 'express';
import { getDb } from '../db.js';

const router = Router();

router.get('/', async (req, res, next) => {
    try {
        const db = await getDb();
        const doc = await db.collection('settings').findOne({ _id: 'global' }, { projection: { _id: 0 } });
        res.json(doc || {});
    } catch (e) { next(e); }
});

router.post('/', async (req, res, next) => {
    try {
        const db = await getDb();
        await db.collection('settings').updateOne(
            { _id: 'global' },
            { $set: req.body },
            { upsert: true },
        );
        res.json({ ok: true });
    } catch (e) { next(e); }
});

export default router;
