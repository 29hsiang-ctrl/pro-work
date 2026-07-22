import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { getDb } from '../db.js';

const router = Router();

function uid() { return Math.random().toString(36).slice(2, 10); }

const INIT_PASSWORD = '123456';

router.get('/', async (req, res, next) => {
    try {
        const db = await getDb();
        const users = await db.collection('users')
            .find({}, { projection: { passwordHash: 0 } }).toArray();
        res.json(users.map(({ _id, ...rest }) => ({ id: _id, ...rest })));
    } catch (e) { next(e); }
});

router.post('/', async (req, res, next) => {
    try {
        const db = await getDb();
        const col = db.collection('users');
        const { name, account, role, email } = req.body || {};
        if (!name?.trim() || !account?.trim() || !role)
            return res.status(400).json({ error: '請填入姓名、帳號與角色' });
        const existing = await col.findOne({ account: account.trim() });
        if (existing) return res.status(409).json({ error: '此帳號已存在' });
        const passwordHash = await bcrypt.hash(INIT_PASSWORD, 10);
        const id = uid();
        await col.insertOne({
            _id: id,
            name: name.trim(),
            account: account.trim(),
            email: email?.trim() || '',
            passwordHash,
            role,
            mustChangePassword: true,
            createdAt: new Date().toISOString(),
        });
        res.json({ id });
    } catch (e) { next(e); }
});

router.put('/', async (req, res, next) => {
    try {
        const db = await getDb();
        const col = db.collection('users');
        const action = req.query.action;
        const body = req.body || {};
        if (!body.id) return res.status(400).json({ error: '缺少 id' });

        if (action === 'resetPassword') {
            const passwordHash = await bcrypt.hash(INIT_PASSWORD, 10);
            await col.updateOne({ _id: body.id }, { $set: { passwordHash, mustChangePassword: true } });
            return res.json({ ok: true });
        }

        const fields = {};
        if (body.name !== undefined) fields.name = body.name;
        if (body.role !== undefined) fields.role = body.role;
        if (body.account !== undefined) fields.account = body.account;
        if (body.email !== undefined) fields.email = body.email;
        if (body.googleId !== undefined) fields.googleId = body.googleId;
        await col.updateOne({ _id: body.id }, { $set: fields });
        res.json({ ok: true });
    } catch (e) { next(e); }
});

router.delete('/', async (req, res, next) => {
    try {
        const db = await getDb();
        const id = req.query.id;
        if (!id) return res.status(400).json({ error: '缺少 id' });
        await db.collection('users').deleteOne({ _id: id });
        res.json({ ok: true });
    } catch (e) { next(e); }
});

export default router;
