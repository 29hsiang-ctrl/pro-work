import { getDb, ok, err } from './lib/mongodb.js';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import nodemailer from 'nodemailer';

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
    const { passwordHash: _, _id, resetToken: __, resetTokenExpiry: ___, ...rest } = user;
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

async function sendResetEmail(toEmail, resetUrl) {
    const transporter = nodemailer.createTransport({
        host: 'smtp.gmail.com',
        port: 465,
        secure: true,
        auth: {
            user: process.env.GMAIL_USER,
            pass: (process.env.GMAIL_APP_PASSWORD || '').replace(/\s/g, ''),
        },
    });
    await transporter.sendMail({
        from: `"Pro Work" <${process.env.GMAIL_USER}>`,
        to: toEmail,
        subject: '【Pro Work】密碼重設連結',
        html: `
            <div style="font-family:sans-serif;max-width:480px;margin:0 auto">
                <h2 style="color:#111">Pro Work 密碼重設</h2>
                <p>請點擊下方連結重設密碼，連結將在 <strong>1 小時</strong>後失效：</p>
                <a href="${resetUrl}" style="display:inline-block;margin:16px 0;padding:12px 24px;background:#111;color:#fff;border-radius:8px;text-decoration:none">重設密碼</a>
                <p style="color:#888;font-size:12px">若你沒有申請重設密碼，請忽略此信。</p>
            </div>
        `,
    });
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

        // ── 忘記密碼：寄重設信 ────────────────────────
        if (action === 'forgotPassword') {
            try {
                const { account } = body;
                if (account) {
                    const user = await users.findOne({ account });
                    if (user?.email) {
                        const token = crypto.randomBytes(16).toString('hex');
                        const expiry = Date.now() + 60 * 60 * 1000;
                        await users.updateOne(
                            { _id: user._id },
                            { $set: { resetToken: token, resetTokenExpiry: expiry } }
                        );
                        const appUrl = process.env.APP_URL || 'http://localhost:8888';
                        const resetUrl = `${appUrl}/?reset_token=${token}`;
                        await sendResetEmail(user.email, resetUrl);
                    }
                }
            } catch (e) {
                console.error('forgotPassword error:', e.message);
            }
            return ok({ ok: true });
        }

        // ── 驗證重設 token ────────────────────────────
        if (action === 'verifyResetToken') {
            const { token } = body;
            if (!token) return ok({ ok: false });
            const user = await users.findOne({ resetToken: token });
            if (!user || !user.resetTokenExpiry || user.resetTokenExpiry < Date.now()) {
                return ok({ ok: false });
            }
            return ok({ ok: true });
        }

        // ── 用 token 重設密碼 ─────────────────────────
        if (action === 'resetPasswordByToken') {
            const { token, newPassword } = body;
            if (!token || !newPassword) return err(400, '缺少必要欄位');
            if (newPassword.length < 6) return err(400, '密碼至少 6 碼');
            const user = await users.findOne({ resetToken: token });
            if (!user || !user.resetTokenExpiry || user.resetTokenExpiry < Date.now()) {
                return err(400, '連結已失效或過期');
            }
            const passwordHash = await bcrypt.hash(newPassword, 10);
            await users.updateOne(
                { _id: user._id },
                { $set: { passwordHash, mustChangePassword: false }, $unset: { resetToken: '', resetTokenExpiry: '' } }
            );
            return ok({ ok: true });
        }

        return err(400, `未知的 action: ${action}`);
    } catch (e) {
        console.error(e);
        return err(500, e.message);
    }
};
