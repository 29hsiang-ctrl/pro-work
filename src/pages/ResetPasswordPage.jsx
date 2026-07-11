import { useState, useEffect } from 'react';

export function ResetPasswordPage({ token }) {
    const [status, setStatus] = useState('checking'); // 'checking' | 'valid' | 'invalid' | 'done'
    const [password, setPassword] = useState('');
    const [confirm, setConfirm] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        fetch('/api/auth?action=verifyResetToken', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token }),
        })
            .then(r => r.json())
            .then(d => setStatus(d.ok ? 'valid' : 'invalid'))
            .catch(() => setStatus('invalid'));
    }, [token]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (password !== confirm) { setError('兩次密碼不一致'); return; }
        if (password.length < 6) { setError('密碼至少 6 碼'); return; }
        setError('');
        setLoading(true);
        try {
            const res = await fetch('/api/auth?action=resetPasswordByToken', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ token, newPassword: password }),
            });
            const data = await res.json();
            if (!res.ok) { setError(data.error || '重設失敗'); setLoading(false); return; }
            // 清除 URL query string，避免 token 外洩
            window.history.replaceState({}, '', window.location.pathname);
            setStatus('done');
        } catch {
            setError('連線失敗，請稍後再試');
        }
        setLoading(false);
    };

    return (
        <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center px-4 font-sans">
            <div className="w-full max-w-sm">
                <div className="text-center mb-8">
                    <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Pro Work</h1>
                    <p className="text-sm text-gray-400 mt-1">重設密碼</p>
                </div>
                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
                    {status === 'checking' && (
                        <p className="text-sm text-gray-400 text-center py-4">驗證中...</p>
                    )}
                    {status === 'invalid' && (
                        <div className="text-center space-y-3 py-4">
                            <div className="text-4xl">⏱️</div>
                            <p className="text-sm font-medium text-gray-700">連結已失效或過期</p>
                            <p className="text-xs text-gray-400">請重新申請密碼重設連結。</p>
                            <a href="/" className="inline-block mt-2 text-sm text-gray-500 hover:text-gray-700 border border-gray-200 rounded-xl px-4 py-2 transition-colors">
                                返回登入
                            </a>
                        </div>
                    )}
                    {status === 'done' && (
                        <div className="text-center space-y-3 py-4">
                            <div className="text-4xl">✅</div>
                            <p className="text-sm font-medium text-gray-700">密碼已重設成功</p>
                            <a href="/" className="inline-block mt-2 text-sm text-white bg-gray-900 hover:bg-gray-700 rounded-xl px-6 py-2.5 transition-colors">
                                前往登入
                            </a>
                        </div>
                    )}
                    {status === 'valid' && (
                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div>
                                <label className="block text-xs font-medium text-gray-500 mb-1.5">新密碼</label>
                                <input
                                    type="password"
                                    value={password}
                                    onChange={e => setPassword(e.target.value)}
                                    placeholder="至少 6 碼"
                                    required
                                    className="w-full px-4 py-2.5 text-sm rounded-xl border border-gray-200 outline-none focus:border-gray-400 transition-colors bg-gray-50"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-gray-500 mb-1.5">確認新密碼</label>
                                <input
                                    type="password"
                                    value={confirm}
                                    onChange={e => setConfirm(e.target.value)}
                                    placeholder="再輸入一次"
                                    required
                                    className="w-full px-4 py-2.5 text-sm rounded-xl border border-gray-200 outline-none focus:border-gray-400 transition-colors bg-gray-50"
                                />
                            </div>
                            {error && <p className="text-xs text-red-500">{error}</p>}
                            <button
                                type="submit"
                                disabled={loading}
                                className="w-full py-2.5 bg-gray-900 text-white text-sm font-semibold rounded-xl hover:bg-gray-700 transition-colors disabled:opacity-60"
                            >
                                {loading ? '重設中...' : '確認重設密碼'}
                            </button>
                        </form>
                    )}
                </div>
            </div>
        </div>
    );
}
