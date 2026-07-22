import { Router } from 'express';
import { getDb } from '../db.js';

const router = Router();

router.get('/', async (req, res, next) => {
    try {
        const db = await getDb();
        const [projects, groups, drawings, factorySteps, settings] = await Promise.all([
            db.collection('projects').find({}).toArray(),
            db.collection('groups').find({}).toArray(),
            db.collection('drawings').find({}).toArray(),
            db.collection('factorySteps').find({}).toArray(),
            db.collection('settings').findOne({ _id: 'global' }),
        ]);
        res.set('Cache-Control', 'public, s-maxage=30, stale-while-revalidate=300');
        res.json({
            projects:     projects.map(({ _id, ...r }) => ({ id: _id, ...r })),
            groups:       groups.map(({ _id, ...r }) => ({ id: _id, ...r })),
            drawings:     drawings.map(({ _id, ...r }) => ({ id: _id, ...r })),
            factorySteps: factorySteps.map(({ _id, ...r }) => ({ id: _id, ...r })),
            settings:     settings || {},
        });
    } catch (e) { next(e); }
});

export default router;
