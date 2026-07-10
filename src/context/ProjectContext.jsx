import { createContext, useContext, useState, useEffect } from 'react';
import { api } from '../lib/api';
import { useSettings } from './SettingsContext';

export const ITEM_TYPES = [
    '包板', '格柵', '門框', '門扇', '窗框',
    '格柵欄杆', '玻璃欄杆', '玻璃上蓋', '景觀金屬',
];

export const FACTORY_STEPS_BY_TYPE = {
    '包板':     ['折板', '烤漆', '送達工地'],
    '格柵':     ['抽料', '加工', '烤漆', '組立', '送達工地'],
    '門框':     [],
    '門扇':     [],
    '窗框':     ['折板', '組立', '矽利康', '送達工地'],
    '格柵欄杆': ['抽料', '組立', '烤漆', '送達工地'],
    '玻璃欄杆': ['折板', '組立', '烤漆', '送達工地'],
    '玻璃上蓋': [],
    '景觀金屬': [],
};

export function getDrawingStatus(d) {
    if (!d) return { label: '—', cls: 'bg-gray-100 text-gray-400' };
    if (d.approveDate)    return { label: '已核准', cls: 'bg-green-100 text-green-700' };
    if (d.reviewDate)     return { label: '已簽回', cls: 'bg-orange-100 text-orange-700' };
    if (d.submitDate)     return { label: '已送審', cls: 'bg-blue-100 text-blue-700' };
    if (d.plannedSubmit)  return { label: '繪圖中', cls: 'bg-yellow-100 text-yellow-700' };
    return { label: '未開始', cls: 'bg-gray-100 text-gray-500' };
}

function uid() { return Math.random().toString(36).slice(2, 10); }

const ProjectContext = createContext(null);

function initFromCache() {
    try {
        const raw = localStorage.getItem('prowork_init_cache');
        if (raw) return JSON.parse(raw);
    } catch {}
    return null;
}

export function ProjectProvider({ children }) {
    const { settings } = useSettings();

    const cached = initFromCache();
    const [projects, setProjects]         = useState(cached?.projects ?? []);
    const [groups, setGroups]             = useState(cached?.groups ?? []);
    const [drawings, setDrawings]         = useState(cached?.drawings ?? []);
    const [factorySteps, setFactorySteps] = useState(cached?.factorySteps ?? []);
    const [hasCachedData]                 = useState(!!cached);
    const [loading, setLoading]           = useState(true);
    const [dbError, setDbError]           = useState(null);
    const [selectedProjectId, setSelectedProjectIdState] = useState(
        () => localStorage.getItem('prowork_selected_project') || null
    );

    const setSelectedProjectId = (id) => {
        localStorage.setItem('prowork_selected_project', id || '');
        setSelectedProjectIdState(id);
    };

    useEffect(() => {
        api.get('/init')
        .then(({ projects, groups, drawings, factorySteps }) => {
            setProjects(projects);
            setGroups(groups);
            setDrawings(drawings);
            setFactorySteps(factorySteps);
            localStorage.setItem('prowork_init_cache', JSON.stringify({ projects, groups, drawings, factorySteps }));
        })
        .catch(e => setDbError(e.message))
        .finally(() => setLoading(false));
    }, []);

    // ── Projects ──────────────────────────────────────────────
    const addProject = async (name, address = '', extras = {}) => {
        const p = { id: uid(), name, address, members: [], note: '', ...extras, createdAt: new Date().toISOString() };
        setProjects(prev => [...prev, p]);
        await api.post('/projects', p);
        return p.id;
    };

    const updateProject = async (id, fields) => {
        setProjects(prev => prev.map(p => p.id === id ? { ...p, ...fields } : p));
        await api.put('/projects', { id, ...fields });
    };

    const deleteProject = async (id) => {
        const gIds = groups.filter(g => g.projectId === id).map(g => g.id);
        setProjects(prev => prev.filter(p => p.id !== id));
        setGroups(prev => prev.filter(g => g.projectId !== id));
        setDrawings(prev => prev.filter(d => !gIds.includes(d.groupId)));
        setFactorySteps(prev => prev.filter(f => !gIds.includes(f.groupId)));
        await api.delete(`/projects?id=${id}`);
    };

    // ── Groups ────────────────────────────────────────────────
    const addGroup = async (projectId, name, type, extras = {}) => {
        const g = { id: uid(), projectId, name, type, ...extras };

        // 優先使用 SettingsContext 的自訂步驟
        const stepNames = settings.customSteps?.[type] ?? FACTORY_STEPS_BY_TYPE[type] ?? [];
        const defaultSteps = stepNames.map((stepName, i) => ({
            id: uid(), groupId: g.id, stepName, plannedDate: '', doneDate: '', order: i,
        }));
        const initDrawing = {
            id: uid(), groupId: g.id, rev: 'R1',
            plannedSubmit: '', submitDate: '', reviewDate: '', approveDate: '', note: '',
        };

        setGroups(prev => [...prev, g]);
        setDrawings(prev => [...prev, initDrawing]);
        setFactorySteps(prev => [...prev, ...defaultSteps]);

        await api.post('/groups', g);
        await api.post('/drawings', initDrawing);
        if (defaultSteps.length > 0) await api.post('/factory', defaultSteps);
    };

    const updateGroup = async (id, fields) => {
        setGroups(prev => prev.map(g => g.id === id ? { ...g, ...fields } : g));
        await api.put('/groups', { id, ...fields });
    };

    const deleteGroup = async (id) => {
        setGroups(prev => prev.filter(g => g.id !== id));
        setDrawings(prev => prev.filter(d => d.groupId !== id));
        setFactorySteps(prev => prev.filter(f => f.groupId !== id));
        await api.delete(`/groups?id=${id}`);
    };

    // ── Drawings ──────────────────────────────────────────────
    const addDrawingRevision = async (groupId, latestRev) => {
        const nextNum = parseInt((latestRev || 'R0').replace('R', '')) + 1;
        const dr = {
            id: uid(), groupId, rev: `R${nextNum}`,
            plannedSubmit: '', submitDate: '', reviewDate: '', approveDate: '', note: '',
        };
        setDrawings(prev => [...prev, dr]);
        await api.post('/drawings', dr);
        return dr.id;
    };

    const updateDrawing = async (id, fields) => {
        setDrawings(prev => prev.map(d => d.id === id ? { ...d, ...fields } : d));
        await api.put('/drawings', { id, ...fields });
    };

    const deleteDrawing = async (id) => {
        setDrawings(prev => prev.filter(d => d.id !== id));
        await api.delete(`/drawings?id=${id}`);
    };

    // ── Factory Steps ─────────────────────────────────────────
    const updateFactoryStep = async (id, fields) => {
        setFactorySteps(prev => prev.map(f => f.id === id ? { ...f, ...fields } : f));
        await api.put('/factory', { id, ...fields });
    };

    const addFactoryStep = async (groupId, stepName) => {
        const step = {
            id: uid(), groupId, stepName, plannedDate: '', doneDate: '',
            order: factorySteps.filter(f => f.groupId === groupId).length,
        };
        setFactorySteps(prev => [...prev, step]);
        await api.post('/factory', step);
    };

    const deleteFactoryStep = async (id) => {
        setFactorySteps(prev => prev.filter(f => f.id !== id));
        await api.delete(`/factory?id=${id}`);
    };

    const upsertFactoryStepDate = async (groupId, stepName, doneDate) => {
        const existing = factorySteps.find(f => f.groupId === groupId && f.stepName === stepName);
        if (existing) {
            setFactorySteps(prev => prev.map(f => f.id === existing.id ? { ...f, doneDate } : f));
            await api.put('/factory', { id: existing.id, doneDate });
        } else {
            const step = {
                id: uid(), groupId, stepName, plannedDate: '', doneDate,
                order: factorySteps.filter(f => f.groupId === groupId).length,
            };
            setFactorySteps(prev => [...prev, step]);
            await api.post('/factory', step);
        }
    };

    const value = {
        projects, groups, drawings, factorySteps,
        loading, dbError, hasCachedData,
        selectedProjectId, setSelectedProjectId,
        addProject, updateProject, deleteProject,
        addGroup, updateGroup, deleteGroup,
        addDrawingRevision, updateDrawing, deleteDrawing,
        updateFactoryStep, addFactoryStep, deleteFactoryStep, upsertFactoryStepDate,
    };

    return <ProjectContext.Provider value={value}>{children}</ProjectContext.Provider>;
}

export function useProject() {
    return useContext(ProjectContext);
}
