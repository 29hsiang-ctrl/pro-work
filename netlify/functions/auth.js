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

export const handler = async (event) => {
    if (event.httpMethod === 'OPTIONS') return ok({});
    const action = event.queryStringParameters?.action;

    try {
        const db = await getDb();
        const users = db.collection('users');
        await seedAdmin(users);

        if (event.httpMethod !== 'POST') return err(405, 'Method Not Allowed');

        const body = JSON.parse(event.body || '{}');

        if (action === 'login') {
            const { account, password } = body;
            if (!account || !password) return err(400, '請填入帳號與密碼');
            const user = await users.findOne({ account });
            if (!user) return err(401, '帳號或密碼錯誤');
            const match = await bcrypt.compare(password, user.passwordHash);
            if (!match) return err(401, '帳號或密碼錯誤');
            const { passwordHash: _, _id, ...rest } = user;
            return ok({ id: _id, ...rest });
        }

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

        return err(400, `未知的 action: ${action}`);
    } catch (e) {
        console.error(e);
        return err(500, e.message);
    }
};
