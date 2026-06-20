import { createContext, useContext, useState, useEffect } from 'react';
import { api } from '../lib/api';

const DEFAULT_SETTINGS = {
    vendors: [],
    users: [
        { id: '1', name: '管理員',   email: 'admin@prowork.com',    role: 'admin',      active: true },
        { id: '2', name: '繪圖員A',  email: 'drawing@prowork.com',  role: 'drawing',    active: true },
        { id: '3', name: '採購員A',  email: 'purchase@prowork.com', role: 'purchasing', active: true },
        { id: '4', name: '工地員A',  email: 'site@prowork.com',     role: 'site',       active: true },
        { id: '5', name: '業主A',    email: 'owner@prowork.com',    role: 'owner',      active: true },
    ],
    customSteps: {},
    customTypes: [],
};

const SettingsContext = createContext(null);

export function SettingsProvider({ children }) {
    const [settings, setSettings] = useState(DEFAULT_SETTINGS);
    const [settingsLoading, setSettingsLoading] = useState(true);

    useEffect(() => {
        api.get('/settings')
            .then(data => {
                if (data && Object.keys(data).length > 0) {
                    setSettings(prev => ({ ...prev, ...data }));
                }
            })
            .catch(console.error)
            .finally(() => setSettingsLoading(false));
    }, []);

    const updateSettings = async (next) => {
        setSettings(next);
        await api.post('/settings', next);
    };

    return (
        <SettingsContext.Provider value={{ settings, updateSettings, settingsLoading }}>
            {children}
        </SettingsContext.Provider>
    );
}

export function useSettings() {
    return useContext(SettingsContext);
}
