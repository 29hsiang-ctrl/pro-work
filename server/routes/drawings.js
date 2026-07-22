import { Router } from 'express';
import { getDb } from '../db.js';

const router = Router();

router.get('/', async (req, res, next) => {
    try {
        const db = await getDb();
        const filter = req.query.groupId ? { groupId: req.query.groupId } : {};
        const docs = await db.collection('drawings').find(filter, { projection: { _id: 0 } }).toArray();
        res.json(docs);
    } catch (e) { next(e); }
});

router.post('/', async (req, res, next) => {
    try {
        const db = await getDb();
        const doc = req.body;
        await db.collection('drawings').insertOne({ _id: doc.id, ...doc });
        res.json(doc);
    } catch (e) { next(e); }
});

router.put('/', async (req, res, next) => {
    try {
        const db = await getDb();
        const { id, ...fields } = req.body;
        await db.collection('drawings').updateOne({ id }, { $set: fields });
        res.json({ ok: true });
    } catch (e) { next(e); }
});

router.delete('/', async (req, res, next) => {
    try {
        const db = await getDb();
        await db.collection('drawings').deleteOne({ id: req.query.id });
        res.json({ ok: true });
    } catch (e) { next(e); }
});

export default router;
