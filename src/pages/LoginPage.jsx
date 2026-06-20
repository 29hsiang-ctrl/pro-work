import { useState } from 'react';
import { useAuth } from '../context/AuthContext';

const DEMO_ACCOUNTS = [
    { label: '管理員',   email: 'admin@prowork.com',    password: '123456' },
    { label: '繪圖員',   email: 'drawing@prowork.com',  password: '123456' },
    { label: '採購人員', email: 'purchase@prowork.com', password: '123456' },
    { label: '工地人員', email: 'site@prowork.com',     password: '123456' },
    { label: '業主',     email: 'owner@prowork.com',    password: '123456' },
];

export function LoginPage() {
    const { login } = useAuth();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');

    const handleSubmit = (e) => {
        e.preventDefault();
        setError('');
        const ok = login(email.trim(), password);
        if (!ok) setError('帳號或密碼錯誤');
    };

    const quickLogin = (acc) => {
        const ok = login(acc.email, acc.password);
        if (!ok) setError('登入失敗');
    };

    return (
        <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center px-4 font-sans">
            <div className="w-full max-w-sm">
                {/* Logo */}
                <div className="text-center mb-8">
                    <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Pro Work</h1>
                    <p className="text-sm text-gray-400 mt-1">專案管理系統</p>
                </div>

                {/* 登入表單 */}
                <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 space-y-4">
                    <div>
                        <label className="block text-xs font-medium text-gray-500 mb-1.5">電子信箱</label>
                        <input
                            type="email"
                            value={email}
                            onChange={e => setEmail(e.target.value)}
                            placeholder="your@email.com"
                            required
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
                            className="w-full px-4 py-2.5 text-sm rounded-xl border border-gray-200 outline-none focus:border-gray-400 transition-colors bg-gray-50"
                        />
                    </div>
                    {error && <p className="text-xs text-red-500">{error}</p>}
                    <button
                        type="submit"
                        className="w-full py-2.5 bg-gray-900 text-white text-sm font-semibold rounded-xl hover:bg-gray-700 transition-colors"
                    >
                        登入
                    </button>
                </form>

                {/* 快速登入（開發用） */}
                <div className="mt-6">
                    <p className="text-xs text-gray-400 text-center mb-3">開發測試帳號（密碼均為 123456）</p>
                    <div className="flex flex-wrap gap-2 justify-center">
                        {DEMO_ACCOUNTS.map(acc => (
                            <button
                                key={acc.email}
                                onClick={() => quickLogin(acc)}
                                className="px-3 py-1.5 text-xs rounded-full border border-gray-200 text-gray-600 hover:bg-gray-100 transition-colors"
                            >
                                {acc.label}
                            </button>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}
