import { getDb, ok, err } from './lib/mongodb.js';
import bcrypt from 'bcryptjs';

function uid() { return Math.random().toString(36).slice(2, 10); }

const INIT_PASSWORD = '123456';

export const handler = async (event) => {
    if (event.httpMethod === 'OPTIONS') return ok({});
    try {
        const db = await getDb();
        const col = db.collection('users');

        switch (event.httpMethod) {
            case 'GET': {
                const users = await col.find({}, { projection: { passwordHash: 0 } }).toArray();
                return ok(users.map(({ _id, ...rest }) => ({ id: _id, ...rest })));
            }
            case 'POST': {
                const { name, account, role } = JSON.parse(event.body || '{}');
                if (!name?.trim() || !account?.trim() || !role) return err(400, '請填入姓名、帳號與角色');
                const existing = await col.findOne({ account: account.trim() });
                if (existing) return err(409, '此帳號已存在');
                const passwordHash = await bcrypt.hash(INIT_PASSWORD, 10);
                const id = uid();
                await col.insertOne({
                    _id: id,
                    name: name.trim(),
                    account: account.trim(),
                    passwordHash,
                    role,
                    mustChangePassword: true,
                    createdAt: new Date().toISOString(),
                });
                return ok({ id });
            }
            case 'PUT': {
                const action = event.queryStringParameters?.action;
                const body = JSON.parse(event.body || '{}');
                if (!body.id) return err(400, '缺少 id');

                if (action === 'resetPassword') {
                    const passwordHash = await bcrypt.hash(INIT_PASSWORD, 10);
                    await col.updateOne({ _id: body.id }, { $set: { passwordHash, mustChangePassword: true } });
                    return ok({ ok: true });
                }

                const fields = {};
                if (body.name !== undefined) fields.name = body.name;
                if (body.role !== undefined) fields.role = body.role;
                if (body.account !== undefined) fields.account = body.account;
                await col.updateOne({ _id: body.id }, { $set: fields });
                return ok({ ok: true });
            }
            case 'DELETE': {
                const id = event.queryStringParameters?.id;
                if (!id) return err(400, '缺少 id');
                await col.deleteOne({ _id: id });
                return ok({ ok: true });
            }
            default: return err(405, 'Method Not Allowed');
        }
    } catch (e) {
        console.error(e);
        return err(500, e.message);
    }
};
