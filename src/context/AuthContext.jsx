import { createContext, useState, useContext } from 'react';

export const ROLES = {
    admin:      { label: '管理員',   pages: ['dashboard','drawing','site','factory','calendar','settings'] },
    drawing:    { label: '繪圖員',   pages: ['drawing','calendar'] },
    purchasing: { label: '採購人員', pages: ['factory','calendar'] },
    site:       { label: '工地人員', pages: ['site','calendar'] },
    owner:      { label: '業主',     pages: ['calendar'], readonly: true },
};

// 開發期暫用假帳號，串接 Supabase 後換掉
const MOCK_USERS = [
    { id: 1, name: '管理員',   email: 'admin@prowork.com',    password: '123456', role: 'admin' },
    { id: 2, name: '繪圖員A',  email: 'drawing@prowork.com',  password: '123456', role: 'drawing' },
    { id: 3, name: '採購員A',  email: 'purchase@prowork.com', password: '123456', role: 'purchasing' },
    { id: 4, name: '工地員A',  email: 'site@prowork.com',     password: '123456', role: 'site' },
    { id: 5, name: '業主A',    email: 'owner@prowork.com',    password: '123456', role: 'owner' },
];

export const AuthContext = createContext(null);

export function AuthProvider({ children }) {
    const [user, setUser] = useState(() => {
        try {
            const saved = localStorage.getItem('auth_user');
            return saved ? JSON.parse(saved) : null;
        } catch { return null; }
    });

    const login = (email, password) => {
        const found = MOCK_USERS.find(u => u.email === email && u.password === password);
        if (!found) return false;
        const { password: _omit, ...safeUser } = found;
        setUser(safeUser);
        localStorage.setItem('auth_user', JSON.stringify(safeUser));
        return true;
    };

    const logout = () => {
        setUser(null);
        localStorage.removeItem('auth_user');
    };

    return (
        <AuthContext.Provider value={{ user, login, logout, ROLES }}>
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    return useContext(AuthContext);
}
