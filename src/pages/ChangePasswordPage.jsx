import { useState, useRef, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';

function drawCaptcha(canvas, text) {
    const ctx = canvas.getContext('2d');
    const W = canvas.width;
    const H = canvas.height;
    ctx.clearRect(0, 0, W, H);

    // 背景
    ctx.fillStyle = '#f8f9fa';
    ctx.fillRect(0, 0, W, H);

    // 干擾線
    for (let i = 0; i < 4; i++) {
        ctx.strokeStyle = `hsl(${Math.random()*360},40%,70%)`;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(Math.random() * W, Math.random() * H);
        ctx.lineTo(Math.random() * W, Math.random() * H);
        ctx.stroke();
    }

    // 文字
    const colors = ['#374151','#1d4ed8','#047857','#b45309','#7c3aed'];
    text.split('').forEach((ch, i) => {
        ctx.save();
        ctx.font = `bold ${22 + Math.floor(Math.random()*6)}px monospace`;
        ctx.fillStyle = colors[i % colors.length];
        ctx.translate(14 + i * 26, H / 2 + 6);
        ctx.rotate((Math.random() - 0.5) * 0.4);
        ctx.fillText(ch, 0, 0);
        ctx.restore();
    });

    // 干擾點
    for (let i = 0; i < 30; i++) {
        ctx.fillStyle = `rgba(0,0,0,${Math.random()*0.15})`;
        ctx.beginPath();
        ctx.arc(Math.random()*W, Math.random()*H, 1, 0, Math.PI*2);
        ctx.fill();
    }
}

function genCode() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
    return Array.from({ length: 4 }, () => chars[Math.floor(Math.random()*chars.length)]).join('');
}

export function ChangePasswordPage() {
    const { user, updateUser } = useAuth();
    const canvasRef = useRef(null);
    const [captchaCode, setCaptchaCode] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [captchaInput, setCaptchaInput] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const refreshCaptcha = useCallback(() => {
        const code = genCode();
        setCaptchaCode(code);
        setCaptchaInput('');
        if (canvasRef.current) drawCaptcha(canvasRef.current, code);
    }, []);

    useEffect(() => {
        refreshCaptcha();
    }, [refreshCaptcha]);

    useEffect(() => {
        if (canvasRef.current && captchaCode) {
            drawCaptcha(canvasRef.current, captchaCode);
        }
    }, [captchaCode]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');

        if (newPassword.length < 6) { setError('密碼至少 6 碼'); return; }
        if (newPassword !== confirmPassword) { setError('兩次密碼不一致'); return; }
        if (captchaInput.toLowerCase() !== captchaCode.toLowerCase()) {
            setError('驗證碼錯誤');
            refreshCaptcha();
            return;
        }

        setLoading(true);
        try {
            const res = await fetch('/api/auth?action=changePassword', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId: user.id, newPassword }),
            });
            const data = await res.json();
            if (!res.ok) { setError(data.error || '修改失敗'); refreshCaptcha(); return; }
            updateUser({ mustChangePassword: false });
        } catch {
            setError('伺服器連線失敗，請稍後再試');
            refreshCaptcha();
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center px-4 font-sans">
            <div className="w-full max-w-sm">
                <div className="text-center mb-8">
                    <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Pro Work</h1>
                    <p className="text-sm text-gray-400 mt-1">請設定新密碼</p>
                </div>

                <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 mb-4 text-xs text-amber-700">
                    您是首次登入，請先設定您的專屬密碼。
                </div>

                <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 space-y-4">
                    <div>
                        <label className="block text-xs font-medium text-gray-500 mb-1.5">新密碼（至少 6 碼）</label>
                        <input
                            type="password"
                            value={newPassword}
                            onChange={e => setNewPassword(e.target.value)}
                            placeholder="••••••"
                            required
                            autoComplete="new-password"
                            className="w-full px-4 py-2.5 text-sm rounded-xl border border-gray-200 outline-none focus:border-gray-400 transition-colors bg-gray-50"
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-medium text-gray-500 mb-1.5">確認新密碼</label>
                        <input
                            type="password"
                            value={confirmPassword}
                            onChange={e => setConfirmPassword(e.target.value)}
                            placeholder="••••••"
                            required
                            autoComplete="new-password"
                            className="w-full px-4 py-2.5 text-sm rounded-xl border border-gray-200 outline-none focus:border-gray-400 transition-colors bg-gray-50"
                        />
                    </div>

                    <div>
                        <label className="block text-xs font-medium text-gray-500 mb-1.5">驗證碼</label>
                        <div className="flex gap-2 items-center mb-2">
                            <canvas
                                ref={canvasRef}
                                width={130}
                                height={44}
                                onClick={refreshCaptcha}
                                className="rounded-lg border border-gray-200 cursor-pointer select-none"
                                title="點擊刷新驗證碼"
                            />
                            <button type="button" onClick={refreshCaptcha}
                                className="text-xs text-gray-400 hover:text-gray-600 underline">
                                刷新
                            </button>
                        </div>
                        <input
                            type="text"
                            value={captchaInput}
                            onChange={e => setCaptchaInput(e.target.value)}
                            placeholder="請輸入上方驗證碼"
                            required
                            maxLength={4}
                            autoComplete="off"
                            className="w-full px-4 py-2.5 text-sm rounded-xl border border-gray-200 outline-none focus:border-gray-400 transition-colors bg-gray-50 tracking-widest"
                        />
                    </div>

                    {error && <p className="text-xs text-red-500">{error}</p>}

                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full py-2.5 bg-gray-900 text-white text-sm font-semibold rounded-xl hover:bg-gray-700 transition-colors disabled:opacity-60"
                    >
                        {loading ? '設定中...' : '確認修改密碼'}
                    </button>
                </form>
            </div>
        </div>
    );
}
