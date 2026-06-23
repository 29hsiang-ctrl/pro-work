import { getDb, ok, err } from './lib/mongodb.js';

export const handler = async (event) => {
    if (event.httpMethod === 'OPTIONS') return ok({});
    if (event.httpMethod !== 'GET') return err(405, 'Method Not Allowed');
    try {
        const db = await getDb();
        const [projects, groups, drawings, factorySteps, settings] = await Promise.all([
            db.collection('projects').find({}).toArray(),
            db.collection('groups').find({}).toArray(),
            db.collection('drawings').find({}).toArray(),
            db.collection('factorySteps').find({}).toArray(),
            db.collection('settings').findOne({ _id: 'global' }),
        ]);
        return ok({
            projects:     projects.map(({ _id, ...r }) => ({ id: _id, ...r })),
            groups:       groups.map(({ _id, ...r }) => ({ id: _id, ...r })),
            drawings:     drawings.map(({ _id, ...r }) => ({ id: _id, ...r })),
            factorySteps: factorySteps.map(({ _id, ...r }) => ({ id: _id, ...r })),
            settings:     settings || {},
        });
    } catch (e) {
        console.error(e);
        return err(500, e.message);
    }
};
