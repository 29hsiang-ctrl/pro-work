import { Router } from 'express';
import { getDb } from '../db.js';

const router = Router();

router.get('/', async (req, res, next) => {
    try {
        const db = await getDb();
        const docs = await db.collection('projects').find({}, { projection: { _id: 0 } }).toArray();
        res.json(docs);
    } catch (e) { next(e); }
});

router.post('/', async (req, res, next) => {
    try {
        const db = await getDb();
        const doc = req.body;
        await db.collection('projects').insertOne({ _id: doc.id, ...doc });
        res.json(doc);
    } catch (e) { next(e); }
});

router.put('/', async (req, res, next) => {
    try {
        const db = await getDb();
        const { id, ...fields } = req.body;
        await db.collection('projects').updateOne({ id }, { $set: fields });
        res.json({ ok: true });
    } catch (e) { next(e); }
});

router.delete('/', async (req, res, next) => {
    try {
        const db = await getDb();
        const id = req.query.id;
        const groupIds = (await db.collection('groups')
            .find({ projectId: id }, { projection: { id: 1 } }).toArray()).map(g => g.id);
        if (groupIds.length) {
            await db.collection('drawings').deleteMany({ groupId: { $in: groupIds } });
            await db.collection('factorySteps').deleteMany({ groupId: { $in: groupIds } });
            await db.collection('groups').deleteMany({ projectId: id });
        }
        await db.collection('projects').deleteOne({ id });
        res.json({ ok: true });
    } catch (e) { next(e); }
});

export default router;
