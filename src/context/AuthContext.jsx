import { createContext, useState, useContext } from 'react';

export const ROLES = {
    admin:      { label: '管理員',   pages: ['dashboard','drawing','site','factory','calendar','settings'] },
    drawing:    { label: '繪圖員',   pages: ['dashboard','drawing','calendar'] },
    purchasing: { label: '採購人員', pages: ['dashboard','factory','calendar'] },
    site:       { label: '工地人員', pages: ['dashboard','site','calendar'] },
    owner:      { label: '業主',     pages: ['dashboard','calendar'], readonly: true },
};

const AUTH_KEY = 'auth_user';

export const AuthContext = createContext(null);

export function AuthProvider({ children }) {
    const [user, setUser] = useState(() => {
        try {
            const saved = localStorage.getItem(AUTH_KEY) || sessionStorage.getItem(AUTH_KEY);
            return saved ? JSON.parse(saved) : null;
        } catch { return null; }
    });

    const login = async (account, password, remember = true) => {
        try {
            const res = await fetch('/api/auth?action=login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ account, password }),
            });
            const data = await res.json();
            if (!res.ok) return { ok: false, error: data.error || '帳號或密碼錯誤' };
            setUser(data);
            if (remember) {
                localStorage.setItem(AUTH_KEY, JSON.stringify(data));
                sessionStorage.removeItem(AUTH_KEY);
            } else {
                sessionStorage.setItem(AUTH_KEY, JSON.stringify(data));
                localStorage.removeItem(AUTH_KEY);
            }
            return { ok: true };
        } catch {
            return { ok: false, error: '伺服器連線失敗，請稍後再試' };
        }
    };

    const logout = () => {
        setUser(null);
        localStorage.removeItem(AUTH_KEY);
        sessionStorage.removeItem(AUTH_KEY);
    };

    const updateUser = (fields) => {
        setUser(prev => {
            const updated = { ...prev, ...fields };
            if (localStorage.getItem(AUTH_KEY)) localStorage.setItem(AUTH_KEY, JSON.stringify(updated));
            if (sessionStorage.getItem(AUTH_KEY)) sessionStorage.setItem(AUTH_KEY, JSON.stringify(updated));
            return updated;
        });
    };

    return (
        <AuthContext.Provider value={{ user, login, logout, updateUser, ROLES }}>
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    return useContext(AuthContext);
}
