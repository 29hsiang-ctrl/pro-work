import { getDb, ok, err } from './lib/mongodb.js';
import bcrypt from 'bcryptjs';

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
    const clientId = process.env.GOOGLE_CLIENT_ID || process.env.VITE_GOOGLE_CLIENT_ID;
    if (payload.aud !== clientId) throw new Error('Google token aud 不符');
    return payload;
}


export const handler = async (event) => {
    if (event.httpMethod === 'OPTIONS') return ok({});
    const action = event.queryStringParameters?.action;

    try {
        const db = await getDb();
        const users = db.collection('users');
        await seedAdmin(users);

        if (event.httpMethod !== 'POST') return err(405, 'Method Not Allowed');

        const body = JSON.parse(event.body || '{}');

        // ── 帳號密碼登入 ──────────────────────────────
        if (action === 'login') {
            const { account, password } = body;
            if (!account || !password) return err(400, '請填入帳號與密碼');
            const user = await users.findOne({ account });
            if (!user) return err(401, '帳號或密碼錯誤');
            const match = await bcrypt.compare(password, user.passwordHash);
            if (!match) return err(401, '帳號或密碼錯誤');
            return ok(safeUser(user));
        }

        // ── 首次變更密碼 ──────────────────────────────
        if (action === 'changePassword') {
            const { userId, newPassword } = body;
            if (!userId || !newPassword) return err(400, '缺少必要欄位');
            if (newPassword.length < 6) return err(400, '密碼至少 6 碼');
            const passwordHash = await bcrypt.hash(newPassword, 10);
            const result = await users.updateOne(
                { _id: userId },
                { $set: { passwordHash, mustChangePassword: false } }
            );
            if (result.matchedCount === 0) return err(404, '找不到使用者');
            return ok({ ok: true });
        }

        // ── Google 登入 ───────────────────────────────
        if (action === 'googleLogin') {
            const { googleToken } = body;
            if (!googleToken) return err(400, '缺少 googleToken');
            const payload = await verifyGoogleToken(googleToken);
            const user = await users.findOne({ googleId: payload.sub });
            if (!user) return ok({ needLink: true, googleEmail: payload.email });
            return ok(safeUser(user));
        }

        // ── Google 帳號自助申請 ───────────────────────
        if (action === 'register') {
            const { googleToken, displayName } = body;
            if (!googleToken) return err(400, '缺少 googleToken');
            const payload = await verifyGoogleToken(googleToken);
            const existing = await users.findOne({ googleId: payload.sub });
            if (existing) return ok({ alreadyExists: true });
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
            return ok({ id, name, email: payload.email });
        }

        // ── 綁定 Google 帳號 ──────────────────────────
        if (action === 'linkGoogle') {
            const { userId, googleToken } = body;
            if (!userId || !googleToken) return err(400, '缺少必要欄位');
            const payload = await verifyGoogleToken(googleToken);
            const conflict = await users.findOne({ googleId: payload.sub, _id: { $ne: userId } });
            if (conflict) return err(409, '此 Google 帳號已綁定其他使用者');
            await users.updateOne(
                { _id: userId },
                { $set: { googleId: payload.sub, email: payload.email } }
            );
            const updated = await users.findOne({ _id: userId });
            return ok(safeUser(updated));
        }

        return err(400, `未知的 action: ${action}`);
    } catch (e) {
        console.error(e);
        return err(500, e.message);
    }
};
