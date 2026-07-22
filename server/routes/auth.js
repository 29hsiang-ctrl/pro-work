import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { getDb } from '../db.js';

const router = Router();

function uid() { return Math.random().toString(36).slice(2, 10); }

async function seedAdmin(col) {
    const count = await col.countDocuments();
    if (count === 0) {
        const passwordHash = await bcrypt.hash('Zx132465', 10);
        await col.insertOne({
            _id: uid(),
            name: '管理員',
            account: 'atw45649',
            passwordHash,
            role: 'admin',
            mustChangePassword: false,
            createdAt: new Date().toISOString(),
        });
    }
}

function safeUser(user) {
    const { passwordHash: _, _id, ...rest } = user;
    return { id: _id, ...rest };
}

async function verifyGoogleToken(googleToken) {
    const res = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${googleToken}`);
    if (!res.ok) throw new Error('Google token 驗證失敗');
    const payload = await res.json();
    const clientId = process.env.GOOGLE_CLIENT_ID || '343315337087-g0p1bbhuocrj7au9t271emgvfjmfof5r.apps.googleusercontent.com';
    if (payload.aud !== clientId) throw new Error('Google token aud 不符');
    return payload;
}

router.post('/', async (req, res, next) => {
    try {
        const db = await getDb();
        const users = db.collection('users');
        await seedAdmin(users);

        const action = req.query.action;
        const body = req.body || {};

        if (action === 'login') {
            const { account, password } = body;
            if (!account || !password) return res.status(400).json({ error: '請填入帳號與密碼' });
            const user = await users.findOne({ account });
            if (!user) return res.status(401).json({ error: '帳號或密碼錯誤' });
            const match = await bcrypt.compare(password, user.passwordHash);
            if (!match) return res.status(401).json({ error: '帳號或密碼錯誤' });
            return res.json(safeUser(user));
        }

        if (action === 'changePassword') {
            const { userId, newPassword } = body;
            if (!userId || !newPassword) return res.status(400).json({ error: '缺少必要欄位' });
            if (newPassword.length < 6) return res.status(400).json({ error: '密碼至少 6 碼' });
            const passwordHash = await bcrypt.hash(newPassword, 10);
            const result = await users.updateOne(
                { _id: userId },
                { $set: { passwordHash, mustChangePassword: false } }
            );
            if (result.matchedCount === 0) return res.status(404).json({ error: '找不到使用者' });
            return res.json({ ok: true });
        }

        if (action === 'googleLogin') {
            const { googleToken } = body;
            if (!googleToken) return res.status(400).json({ error: '缺少 googleToken' });
            const payload = await verifyGoogleToken(googleToken);
            const user = await users.findOne({ googleId: payload.sub });
            if (!user) return res.json({ needLink: true, googleEmail: payload.email });
            return res.json(safeUser(user));
        }

        if (action === 'register') {
            const { googleToken, displayName } = body;
            if (!googleToken) return res.status(400).json({ error: '缺少 googleToken' });
            const payload = await verifyGoogleToken(googleToken);
            const existing = await users.findOne({ googleId: payload.sub });
            if (existing) return res.json({ alreadyExists: true });
            const id = uid();
            const name = displayName?.trim() || payload.name || payload.email.split('@')[0];
            await users.insertOne({
                _id: id,
                name,
                account: payload.email,
                email: payload.email,
                googleId: payload.sub,
                passwordHash: '',
                role: 'pending',
                mustChangePassword: false,
                createdAt: new Date().toISOString(),
            });
            return res.json({ id, name, email: payload.email });
        }

        if (action === 'linkGoogle') {
            const { userId, googleToken } = body;
            if (!userId || !googleToken) return res.status(400).json({ error: '缺少必要欄位' });
            const payload = await verifyGoogleToken(googleToken);
            const conflict = await users.findOne({ googleId: payload.sub, _id: { $ne: userId } });
            if (conflict) return res.status(409).json({ error: '此 Google 帳號已綁定其他使用者' });
            await users.updateOne(
                { _id: userId },
                { $set: { googleId: payload.sub, email: payload.email } }
            );
            const updated = await users.findOne({ _id: userId });
            return res.json(safeUser(updated));
        }

        res.status(400).json({ error: `未知的 action: ${action}` });
    } catch (e) { next(e); }
});

export default router;
