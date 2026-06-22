import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';

const SAVED_ACCOUNT_KEY = 'pw_saved_account';
const SAVED_PW_KEY = 'pw_saved_pw';
const REMEMBER_KEY = 'pw_remember';

export function LoginPage() {
    const { login } = useAuth();
    const [account, setAccount] = useState('');
    const [password, setPassword] = useState('');
    const [remember, setRemember] = useState(() => localStorage.getItem(REMEMBER_KEY) !== 'false');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (localStorage.getItem(REMEMBER_KEY) !== 'false') {
            const savedAccount = localStorage.getItem(SAVED_ACCOUNT_KEY) || '';
            const savedPw = localStorage.getItem(SAVED_PW_KEY) || '';
            if (savedAccount) setAccount(savedAccount);
            if (savedPw) setPassword(savedPw);
        }
    }, []);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        if (remember) {
            localStorage.setItem(SAVED_ACCOUNT_KEY, account.trim());
            localStorage.setItem(SAVED_PW_KEY, password);
            localStorage.setItem(REMEMBER_KEY, 'true');
        } else {
            localStorage.removeItem(SAVED_ACCOUNT_KEY);
            localStorage.removeItem(SAVED_PW_KEY);
            localStorage.setItem(REMEMBER_KEY, 'false');
        }

        const result = await login(account.trim(), password, remember);
        setLoading(false);
        if (!result.ok) setError(result.error || '帳號或密碼錯誤');
    };

    return (
        <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center px-4 font-sans">
            <div className="w-full max-w-sm">
                <div className="text-center mb-8">
                    <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Pro Work</h1>
                    <p className="text-sm text-gray-400 mt-1">專案管理系統</p>
                </div>

                <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 space-y-4">
                    <div>
                        <label className="block text-xs font-medium text-gray-500 mb-1.5">帳號</label>
                        <input
                            type="text"
                            value={account}
                            onChange={e => setAccount(e.target.value)}
                            placeholder="請輸入帳號"
                            required
                            autoComplete="username"
                            className="w-full px-4 py-2.5 text-sm rounded-xl border border-gray-200 outline-none focus:border-gray-400 transition-colors bg-gray-50"
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-medium text-gray-500 mb-1.5">密碼</label>
                        <input
                            type="password"
                            value={password}
                            onChange={e => setPassword(e.target.value)}
                            placeholder="••••••"
                            required
                            autoComplete="current-password"
                            className="w-full px-4 py-2.5 text-sm rounded-xl border border-gray-200 outline-none focus:border-gray-400 transition-colors bg-gray-50"
                        />
                    </div>

                    <label className="flex items-center gap-2 cursor-pointer select-none">
                        <input
                            type="checkbox"
                            checked={remember}
                            onChange={e => setRemember(e.target.checked)}
                            className="w-4 h-4 rounded accent-gray-900"
                        />
                        <span className="text-xs text-gray-500">記住帳號密碼</span>
                    </label>

                    {error && <p className="text-xs text-red-500">{error}</p>}

                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full py-2.5 bg-gray-900 text-white text-sm font-semibold rounded-xl hover:bg-gray-700 transition-colors disabled:opacity-60"
                    >
                        {loading ? '登入中...' : '登入'}
                    </button>
                </form>
            </div>
        </div>
    );
}
