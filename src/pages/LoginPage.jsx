import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';

const SAVED_ACCOUNT_KEY = 'pw_saved_account';
const SAVED_PW_KEY = 'pw_saved_pw';
const REMEMBER_KEY = 'pw_remember';

const GOOGLE_CLIENT_ID = '343315337087-g0p1bbhuocrj7au9t271emgvfjmfof5r.apps.googleusercontent.com';

export function LoginPage() {
    const { login, googleLogin } = useAuth();
    const [mode, setMode] = useState('login'); // 'login' | 'register'
    const [account, setAccount] = useState('');
    const [password, setPassword] = useState('');
    const [remember, setRemember] = useState(() => localStorage.getItem(REMEMBER_KEY) !== 'false');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const googleBtnRef = useRef(null);

    useEffect(() => {
        if (localStorage.getItem(REMEMBER_KEY) !== 'false') {
            const savedAccount = localStorage.getItem(SAVED_ACCOUNT_KEY) || '';
            const savedPw = localStorage.getItem(SAVED_PW_KEY) || '';
            if (savedAccount) setAccount(savedAccount);
            if (savedPw) setPassword(savedPw);
        }
    }, []);

    useEffect(() => {
        if (!GOOGLE_CLIENT_ID || !googleBtnRef.current || mode !== 'login') return;
        const initBtn = () => {
            if (!window.google?.accounts?.id) return false;
            window.google.accounts.id.initialize({
                client_id: GOOGLE_CLIENT_ID,
                callback: async (response) => {
                    setError('');
                    setLoading(true);
                    const result = await googleLogin(response.credential, remember);
                    setLoading(false);
                    if (!result.ok) {
                        setError(result.needLink
                            ? `此 Google 帳號（${result.googleEmail}）尚未綁定，請先用帳號密碼登入後至設定頁綁定`
                            : result.error || 'Google 登入失敗'
                        );
                    }
                },
            });
            window.google.accounts.id.renderButton(googleBtnRef.current, {
                type: 'standard', shape: 'rectangular', theme: 'outline',
                text: 'signin_with', size: 'large', locale: 'zh-TW',
                width: googleBtnRef.current.offsetWidth || 340,
            });
            return true;
        };
        if (!initBtn()) {
            const t = setInterval(() => { if (initBtn()) clearInterval(t); }, 200);
            return () => clearInterval(t);
        }
    }, [mode, remember]);

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

    if (mode === 'register') return <RegisterView onBack={() => { setMode('login'); setError(''); }} />;

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

                    <div className="flex items-center">
                        <label className="flex items-center gap-2 cursor-pointer select-none">
                            <input
                                type="checkbox"
                                checked={remember}
                                onChange={e => setRemember(e.target.checked)}
                                className="w-4 h-4 rounded accent-gray-900"
                            />
                            <span className="text-xs text-gray-500">記住帳號密碼</span>
                        </label>
                    </div>

                    {error && <p className="text-xs text-red-500">{error}</p>}

                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full py-2.5 bg-gray-900 text-white text-sm font-semibold rounded-xl hover:bg-gray-700 transition-colors disabled:opacity-60"
                    >
                        {loading ? '登入中...' : '登入'}
                    </button>

                    {GOOGLE_CLIENT_ID && (
                        <>
                            <div className="flex items-center gap-3">
                                <div className="flex-1 h-px bg-gray-100" />
                                <span className="text-xs text-gray-300">或</span>
                                <div className="flex-1 h-px bg-gray-100" />
                            </div>
                            <div ref={googleBtnRef} className="w-full flex justify-center min-h-[44px]" />
                            <p className="text-center text-xs text-gray-400">
                                尚無帳號？
                                <button
                                    type="button"
                                    onClick={() => { setMode('register'); setError(''); }}
                                    className="ml-1 text-gray-600 underline hover:text-gray-900 transition-colors"
                                >
                                    使用 Google 申請帳號
                                </button>
                            </p>
                        </>
                    )}
                </form>
            </div>
        </div>
    );
}

function RegisterView({ onBack }) {
    const [status, setStatus] = useState('idle'); // 'idle' | 'loading' | 'done' | 'exists'
    const [regInfo, setRegInfo] = useState(null);
    const [error, setError] = useState('');
    const googleBtnRef = useRef(null);

    useEffect(() => {
        if (!GOOGLE_CLIENT_ID || !googleBtnRef.current) return;
        const initBtn = () => {
            if (!window.google?.accounts?.id) return false;
            window.google.accounts.id.initialize({
                client_id: GOOGLE_CLIENT_ID,
                callback: async (response) => {
                    setError('');
                    setStatus('loading');
                    try {
                        const res = await fetch('/api/auth?action=register', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ googleToken: response.credential }),
                        });
                        const data = await res.json();
                        if (data.alreadyExists) {
                            setStatus('exists');
                        } else if (res.ok) {
                            setRegInfo(data);
                            setStatus('done');
                        } else {
                            setError(data.error || '申請失敗，請稍後再試');
                            setStatus('idle');
                        }
                    } catch {
                        setError('連線失敗，請稍後再試');
                        setStatus('idle');
                    }
                },
            });
            window.google.accounts.id.renderButton(googleBtnRef.current, {
                type: 'standard', shape: 'rectangular', theme: 'outline',
                text: 'signup_with', size: 'large', locale: 'zh-TW',
                width: googleBtnRef.current.offsetWidth || 340,
            });
            return true;
        };
        if (!initBtn()) {
            const t = setInterval(() => { if (initBtn()) clearInterval(t); }, 200);
            return () => clearInterval(t);
        }
    }, []);

    return (
        <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center px-4 font-sans">
            <div className="w-full max-w-sm">
                <div className="text-center mb-8">
                    <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Pro Work</h1>
                    <p className="text-sm text-gray-400 mt-1">申請帳號</p>
                </div>
                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 space-y-4">
                    {status === 'done' && (
                        <div className="text-center space-y-3 py-2">
                            <div className="text-4xl">✅</div>
                            <p className="text-sm font-semibold text-gray-800">申請成功！</p>
                            <p className="text-xs text-gray-500">
                                <span className="font-medium text-gray-700">{regInfo?.email}</span> 已送出申請，<br />
                                請等待管理員分配使用權限後再登入。
                            </p>
                            <button onClick={onBack} className="w-full py-2.5 mt-2 border border-gray-200 rounded-xl text-sm text-gray-500 hover:bg-gray-50 transition-colors">
                                返回登入
                            </button>
                        </div>
                    )}
                    {status === 'exists' && (
                        <div className="text-center space-y-3 py-2">
                            <div className="text-4xl">ℹ️</div>
                            <p className="text-sm font-semibold text-gray-800">此帳號已申請過</p>
                            <p className="text-xs text-gray-500">此 Google 帳號已有申請紀錄，請直接使用 Google 登入。</p>
                            <button onClick={onBack} className="w-full py-2.5 mt-2 border border-gray-200 rounded-xl text-sm text-gray-500 hover:bg-gray-50 transition-colors">
                                返回登入
                            </button>
                        </div>
                    )}
                    {(status === 'idle' || status === 'loading') && (
                        <>
                            <p className="text-xs text-gray-500">使用 Google 帳號申請，管理員審核後即可使用系統。</p>
                            {error && <p className="text-xs text-red-500">{error}</p>}
                            {status === 'loading'
                                ? <div className="text-center text-sm text-gray-400 py-3">申請中...</div>
                                : <div ref={googleBtnRef} className="w-full flex justify-center min-h-[44px]" />
                            }
                            <button type="button" onClick={onBack} className="w-full py-2 text-xs text-gray-400 hover:text-gray-600 transition-colors">
                                返回登入
                            </button>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}
