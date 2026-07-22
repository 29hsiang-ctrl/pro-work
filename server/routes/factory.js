import { Router } from 'express';
import { getDb } from '../db.js';

const router = Router();

router.get('/', async (req, res, next) => {
    try {
        const db = await getDb();
        const docs = await db.collection('factorySteps').find({}, { projection: { _id: 0 } }).toArray();
        res.json(docs);
    } catch (e) { next(e); }
});

router.post('/', async (req, res, next) => {
    try {
        const db = await getDb();
        const col = db.collection('factorySteps');
        if (Array.isArray(req.body)) {
            if (req.body.length > 0)
                await col.insertMany(req.body.map(d => ({ _id: d.id, ...d })));
        } else {
            await col.insertOne({ _id: req.body.id, ...req.body });
        }
        res.json({ ok: true });
    } catch (e) { next(e); }
});

router.put('/', async (req, res, next) => {
    try {
        const db = await getDb();
        const { id, ...fields } = req.body;
        await db.collection('factorySteps').updateOne({ id }, { $set: fields });
        res.json({ ok: true });
    } catch (e) { next(e); }
});

router.delete('/', async (req, res, next) => {
    try {
        const db = await getDb();
        await db.collection('factorySteps').deleteOne({ id: req.query.id });
        res.json({ ok: true });
    } catch (e) { next(e); }
});

export default router;
