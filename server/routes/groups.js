import { Router } from 'express';
import { getDb } from '../db.js';

const router = Router();

router.get('/', async (req, res, next) => {
    try {
        const db = await getDb();
        const filter = req.query.projectId ? { projectId: req.query.projectId } : {};
        const docs = await db.collection('groups').find(filter, { projection: { _id: 0 } }).toArray();
        res.json(docs);
    } catch (e) { next(e); }
});

router.post('/', async (req, res, next) => {
    try {
        const db = await getDb();
        const doc = req.body;
        await db.collection('groups').insertOne({ _id: doc.id, ...doc });
        res.json(doc);
    } catch (e) { next(e); }
});

router.put('/', async (req, res, next) => {
    try {
        const db = await getDb();
        const { id, ...fields } = req.body;
        await db.collection('groups').updateOne({ id }, { $set: fields });
        res.json({ ok: true });
    } catch (e) { next(e); }
});

router.delete('/', async (req, res, next) => {
    try {
        const db = await getDb();
        const id = req.query.id;
        await db.collection('drawings').deleteMany({ groupId: id });
        await db.collection('factorySteps').deleteMany({ groupId: id });
        await db.collection('groups').deleteOne({ id });
        res.json({ ok: true });
    } catch (e) { next(e); }
});

export default router;
