import { useState, useRef, useEffect } from 'react';
import * as XLSX from 'xlsx';
import { useProject, ITEM_TYPES, FACTORY_STEPS_BY_TYPE } from '../context/ProjectContext';
import { useSettings } from '../context/SettingsContext';

const ROLE_LABELS = {
    admin:      '管理員',
    drawing:    '繪圖員',
    purchasing: '採購人員',
    site:       '工地人員',
    owner:      '業主',
};

function uid() { return Math.random().toString(36).slice(2, 10); }

// ════════════════════════════════════════════════════
// Tab 1：工地管理
// ════════════════════════════════════════════════════
const EMPTY_PROJ_FORM = { name: '', address: '', members: [], note: '' };

function MemberPicker({ allUsers, selected, onChange }) {
    return (
        <div>
            <p className="text-xs text-gray-500 mb-1.5">負責人員</p>
            <div className="flex flex-wrap gap-1.5">
                {allUsers.length === 0 && <span className="text-xs text-gray-300">尚未設定任何帳號</span>}
                {allUsers.map(u => {
                    const on = selected.includes(u.id);
                    return (
                        <button
                            key={u.id}
                            type="button"
                            onClick={() => onChange(on ? selected.filter(id => id !== u.id) : [...selected, u.id])}
                            className={`px-2.5 py-1 text-xs rounded-full border transition-colors ${
                                on ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-500 border-gray-200 hover:border-gray-400'
                            }`}
                        >{u.name}</button>
                    );
                })}
            </div>
        </div>
    );
}

function detectTypeFromName(name) {
    if (/玻璃欄杆/.test(name)) return '玻璃欄杆';
    if (/格柵欄桿/.test(name)) return '格柵欄桿';
    if (/透空格柵|水平格柵/.test(name)) return '水平格柵';
    if (/格柵|冷氣/.test(name)) return '垂直格柵';
    if (/包板|板/.test(name)) return '包板';
    if (/門/.test(name)) return '門';
    if (/窗/.test(name)) return '窗';
    return null;
}

function parseRows(matrix) {
    if (!matrix.length) return [];

    // 找 header 列
    let headerIdx = 0;
    for (let i = 0; i < Math.min(5, matrix.length); i++) {
        if (matrix[i].some(c => /項目|工料/.test(String(c ?? '')))) { headerIdx = i; break; }
    }

    const headers = matrix[headerIdx].map(h => String(h ?? '').trim());
    const noIdx   = headers.findIndex(h => /項次|序號/.test(h));
    const codeIdx = headers.findIndex(h => /工料|編號/.test(h));
    const nameIdx = headers.findIndex(h => /項目|名稱|工項/.test(h));
    const noteIdx = headers.findIndex(h => /備註/.test(h));

    const col = (row, idx, fallback) => String(row[idx >= 0 ? idx : fallback] ?? '').trim();

    let currentType = '';
    const rows = [];

    for (const row of matrix.slice(headerIdx + 1)) {
        const itemNo = col(row, noIdx, 0);
        const code   = col(row, codeIdx, 1);
        const name   = col(row, nameIdx, 2);
        const note   = col(row, noteIdx, 7);
        if (!name) continue;
        if (!code) { currentType = name; continue; }
        const type = detectTypeFromName(name) || currentType || ITEM_TYPES[0];
        rows.push({ itemNo, name, type, code, note });
    }

    return rows;
}

async function parseContractFile(file) {
    const buf = await file.arrayBuffer();
    const wb = XLSX.read(buf, { type: 'array' });
    const ws = wb.Sheets[wb.SheetNames[0]];
    const matrix = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
    return parseRows(matrix);
}

function ProjectTab({ allUsers = [] }) {
    const { projects, addProject, updateProject, deleteProject, addGroup } = useProject();
    const fileInputRef = useRef(null);
    const [importingProjectId, setImportingProjectId] = useState(null);
    const [importing, setImporting] = useState(false);

    const [adding, setAdding] = useState(false);
    const [form, setForm] = useState(EMPTY_PROJ_FORM);
    const [editId, setEditId] = useState(null);
    const [editForm, setEditForm] = useState(EMPTY_PROJ_FORM);

    const handleImportClick = (projectId) => {
        setImportingProjectId(projectId);
        fileInputRef.current.value = '';
        fileInputRef.current.click();
    };

    const handleFileChange = async (e) => {
        const file = e.target.files[0];
        if (!file || !importingProjectId) return;
        const rows = await parseContractFile(file);
        if (!rows.length) { alert('找不到有效資料，請確認欄位含「工料編號」與「項目」。'); return; }
        if (!window.confirm(`確認匯入 ${rows.length} 個群組到此工地？`)) return;
        setImporting(true);
        for (const row of rows) {
            await addGroup(importingProjectId, row.name, row.type, {
                itemNo: row.itemNo || '',
                code: row.code || '',
                note: row.note || '',
            });
        }
        setImporting(false);
        alert(`已匯入 ${rows.length} 個群組`);
    };

    const handleAdd = () => {
        if (!form.name.trim()) return;
        addProject(form.name.trim(), form.address.trim(), { members: form.members, note: form.note.trim() });
        setForm(EMPTY_PROJ_FORM);
        setAdding(false);
    };
    const handleSaveEdit = (id) => {
        updateProject(id, { name: editForm.name, address: editForm.address, members: editForm.members, note: editForm.note });
        setEditId(null);
    };

    const memberNames = (ids) => {
        const names = (ids || []).map(id => allUsers.find(u => u.id === id)?.name).filter(Boolean);
        return names.length ? names.join('、') : null;
    };

    return (
        <div className="space-y-4">
            <input ref={fileInputRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={handleFileChange} />
            <div className="flex justify-between items-center">
                <p className="text-sm text-gray-500">新增工地後，可在「首頁」查看總覽，並在繪圖管理 / 工廠管理中建立群組。</p>
                <button onClick={() => setAdding(true)} className="flex-shrink-0 px-4 py-2 bg-gray-900 text-white text-sm rounded-xl font-medium hover:bg-gray-700 transition-colors">+ 新增工地</button>
            </div>
            {adding && (
                <div className="bg-gray-50 rounded-xl p-4 border border-gray-200 space-y-3">
                    <input autoFocus type="text" placeholder="工地名稱 *" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg outline-none focus:border-gray-400 bg-white" />
                    <input type="text" placeholder="地址（選填）" value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg outline-none focus:border-gray-400 bg-white" />
                    <MemberPicker allUsers={allUsers} selected={form.members} onChange={v => setForm(f => ({ ...f, members: v }))} />
                    <textarea placeholder="備註（選填）" value={form.note} onChange={e => setForm(f => ({ ...f, note: e.target.value }))} rows={2} className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg outline-none focus:border-gray-400 bg-white resize-none" />
                    <div className="flex gap-2">
                        <button onClick={handleAdd} className="px-4 py-1.5 bg-gray-900 text-white text-sm rounded-lg">新增</button>
                        <button onClick={() => { setAdding(false); setForm(EMPTY_PROJ_FORM); }} className="px-4 py-1.5 text-sm text-gray-500 hover:bg-gray-200 rounded-lg">取消</button>
                    </div>
                </div>
            )}
            {projects.length === 0 && !adding ? (
                <p className="text-center text-gray-300 py-10">尚無工地</p>
            ) : (
                <div className="divide-y divide-gray-100 border border-gray-100 rounded-xl overflow-hidden">
                    {projects.map(p => (
                        <div key={p.id} className="bg-white px-4 py-3">
                            {editId === p.id ? (
                                <div className="space-y-3">
                                    <input autoFocus value={editForm.name} onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))} placeholder="工地名稱 *" className="w-full px-3 py-1.5 text-sm border border-gray-200 rounded-lg outline-none focus:border-gray-400 bg-gray-50" />
                                    <input value={editForm.address} onChange={e => setEditForm(f => ({ ...f, address: e.target.value }))} placeholder="地址" className="w-full px-3 py-1.5 text-sm border border-gray-200 rounded-lg outline-none focus:border-gray-400 bg-gray-50" />
                                    <MemberPicker allUsers={allUsers} selected={editForm.members} onChange={v => setEditForm(f => ({ ...f, members: v }))} />
                                    <textarea placeholder="備註" value={editForm.note} onChange={e => setEditForm(f => ({ ...f, note: e.target.value }))} rows={2} className="w-full px-3 py-1.5 text-sm border border-gray-200 rounded-lg outline-none focus:border-gray-400 bg-gray-50 resize-none" />
                                    <div className="flex gap-2">
                                        <button onClick={() => handleSaveEdit(p.id)} className="text-sm text-blue-600 font-medium">儲存</button>
                                        <button onClick={() => setEditId(null)} className="text-sm text-gray-400">取消</button>
                                    </div>
                                </div>
                            ) : (
                                <div className="flex items-start justify-between">
                                    <div className="min-w-0">
                                        <p className="font-medium text-gray-800 text-sm">{p.name}</p>
                                        {p.address && <p className="text-xs text-gray-400 mt-0.5">{p.address}</p>}
                                        {memberNames(p.members) && (
                                            <p className="text-xs text-blue-500 mt-0.5">負責：{memberNames(p.members)}</p>
                                        )}
                                        {p.note && <p className="text-xs text-gray-400 mt-0.5 whitespace-pre-wrap">{p.note}</p>}
                                    </div>
                                    <div className="flex gap-3 flex-shrink-0 ml-3 items-center">
                                        <button
                                            onClick={() => handleImportClick(p.id)}
                                            disabled={importing}
                                            className="text-xs text-indigo-500 hover:text-indigo-700 disabled:opacity-40"
                                        >{importing && importingProjectId === p.id ? '匯入中…' : '匯入合約'}</button>
                                        <button onClick={() => { setEditId(p.id); setEditForm({ name: p.name, address: p.address || '', members: p.members || [], note: p.note || '' }); }} className="text-xs text-gray-400 hover:text-gray-700">編輯</button>
                                        <button onClick={() => { if (window.confirm(`確認刪除「${p.name}」？`)) deleteProject(p.id); }} className="text-xs text-red-400 hover:text-red-600">刪除</button>
                                    </div>
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

// ════════════════════════════════════════════════════
// Tab 2：流程步驟
// ════════════════════════════════════════════════════
const STEP_POOL = ['折板', '叫管料', '抽料', '加工', '組立', '烤漆', '矽利康', '送達工地'];

function StepsTab({ settings, setSettings }) {
    const customSteps = settings.customSteps || {};
    const customTypes = settings.customTypes || [];
    const customStepPool = settings.customStepPool || [];
    const hiddenBuiltinTypes = settings.hiddenBuiltinTypes || [];
    const visibleBuiltinTypes = ITEM_TYPES.filter(t => !hiddenBuiltinTypes.includes(t));
    const allTypes = [...visibleBuiltinTypes, ...customTypes];
    const allStepPool = [...STEP_POOL, ...customStepPool];

    const [addingType, setAddingType] = useState(false);
    const [newTypeName, setNewTypeName] = useState('');
    const [addingStep, setAddingStep] = useState(false);
    const [newStepName, setNewStepName] = useState('');

    const getSteps = (type) =>
        customSteps[type] ?? FACTORY_STEPS_BY_TYPE[type] ?? [];

    const toggleStep = (type, step) => {
        const current = getSteps(type);
        const next = current.includes(step)
            ? current.filter(s => s !== step)
            : [...current, step].sort((a, b) => allStepPool.indexOf(a) - allStepPool.indexOf(b));
        setSettings(s => ({ ...s, customSteps: { ...(s.customSteps || {}), [type]: next } }));
    };

    const resetType = (type) => {
        setSettings(s => ({ ...s, customSteps: { ...(s.customSteps || {}), [type]: [] } }));
    };

    const addType = () => {
        const name = newTypeName.trim();
        if (!name || allTypes.includes(name)) return;
        setSettings(s => ({ ...s, customTypes: [...(s.customTypes || []), name] }));
        setNewTypeName('');
        setAddingType(false);
    };

    const deleteType = (type) => {
        if (!window.confirm(`確認刪除品項「${type}」？`)) return;
        const isCustom = customTypes.includes(type);
        if (isCustom) {
            setSettings(s => ({
                ...s,
                customTypes: (s.customTypes || []).filter(t => t !== type),
                customSteps: Object.fromEntries(Object.entries(s.customSteps || {}).filter(([k]) => k !== type)),
            }));
        } else {
            setSettings(s => ({
                ...s,
                hiddenBuiltinTypes: [...(s.hiddenBuiltinTypes || []), type],
                customSteps: Object.fromEntries(Object.entries(s.customSteps || {}).filter(([k]) => k !== type)),
            }));
        }
    };

    const addStep = () => {
        const name = newStepName.trim();
        if (!name || allStepPool.includes(name)) return;
        setSettings(s => ({ ...s, customStepPool: [...(s.customStepPool || []), name] }));
        setNewStepName('');
        setAddingStep(false);
    };

    const deleteStep = (step) => {
        if (!window.confirm(`確認刪除步驟「${step}」？此步驟將從所有品項中移除。`)) return;
        setSettings(s => ({
            ...s,
            customStepPool: (s.customStepPool || []).filter(st => st !== step),
            customSteps: Object.fromEntries(
                Object.entries(s.customSteps || {}).map(([type, steps]) => [type, steps.filter(st => st !== step)])
            ),
        }));
    };

    return (
        <div className="space-y-4">
            {/* 步驟庫管理 */}
            <div className="bg-white rounded-xl border border-gray-100 px-4 py-4 space-y-3">
                <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold text-gray-800">步驟庫</p>
                    <button
                        onClick={() => setAddingStep(true)}
                        className="flex-shrink-0 px-3 py-1.5 bg-gray-900 text-white text-xs rounded-lg font-medium hover:bg-gray-700 transition-colors"
                    >+ 新增步驟</button>
                </div>
                {addingStep && (
                    <div className="flex gap-2">
                        <input
                            autoFocus
                            type="text"
                            placeholder="步驟名稱（例：打磨）"
                            value={newStepName}
                            onChange={e => setNewStepName(e.target.value)}
                            onKeyDown={e => { if (e.key === 'Enter') addStep(); if (e.key === 'Escape') { setAddingStep(false); setNewStepName(''); } }}
                            className="flex-1 px-3 py-2 text-sm border border-gray-200 rounded-lg outline-none focus:border-gray-400 bg-white"
                        />
                        <button onClick={addStep} className="px-3 py-2 bg-gray-900 text-white text-sm rounded-lg">新增</button>
                        <button onClick={() => { setAddingStep(false); setNewStepName(''); }} className="px-3 py-2 text-sm text-gray-400 hover:bg-gray-100 rounded-lg">取消</button>
                    </div>
                )}
                <div className="flex flex-wrap gap-2">
                    {STEP_POOL.map(step => (
                        <span key={step} className="px-3 py-1 text-xs rounded-full bg-gray-100 text-gray-500 font-medium">{step}</span>
                    ))}
                    {customStepPool.map(step => (
                        <span key={step} className="inline-flex items-center gap-1 px-3 py-1 text-xs rounded-full bg-blue-50 text-blue-600 font-medium">
                            {step}
                            <button onClick={() => deleteStep(step)} className="text-blue-300 hover:text-red-400 transition-colors leading-none">✕</button>
                        </span>
                    ))}
                </div>
            </div>

            {/* 品項類型列表 */}
            <div className="flex items-center justify-between">
                <p className="text-sm text-gray-500">點選步驟開啟／關閉，設定各品項類型的預設工廠步驟。</p>
                <button
                    onClick={() => setAddingType(true)}
                    className="flex-shrink-0 ml-3 px-3 py-1.5 bg-gray-900 text-white text-xs rounded-lg font-medium hover:bg-gray-700 transition-colors"
                >+ 新增品項</button>
            </div>

            {addingType && (
                <div className="flex gap-2">
                    <input
                        autoFocus
                        type="text"
                        placeholder="品項名稱（例：鋁窗）"
                        value={newTypeName}
                        onChange={e => setNewTypeName(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter') addType(); if (e.key === 'Escape') setAddingType(false); }}
                        className="flex-1 px-3 py-2 text-sm border border-gray-200 rounded-lg outline-none focus:border-gray-400 bg-white"
                    />
                    <button onClick={addType} className="px-3 py-2 bg-gray-900 text-white text-sm rounded-lg">新增</button>
                    <button onClick={() => { setAddingType(false); setNewTypeName(''); }} className="px-3 py-2 text-sm text-gray-400 hover:bg-gray-100 rounded-lg">取消</button>
                </div>
            )}

            <div className="divide-y divide-gray-100 border border-gray-100 rounded-xl overflow-hidden">
                {allTypes.map(type => {
                    const activeSteps = getSteps(type);
                    const isCustomType = customTypes.includes(type);
                    return (
                        <div key={type} className="bg-white px-4 py-4 space-y-2">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <span className="text-sm font-semibold text-gray-800">{type}</span>
                                    {isCustomType && <span className="text-xs px-1.5 py-0.5 bg-blue-50 text-blue-500 rounded">自訂</span>}
                                </div>
                                <div className="flex items-center gap-3">
                                    <button onClick={() => resetType(type)} className="text-xs text-gray-400 hover:text-red-500 transition-colors">重置</button>
                                    <button onClick={() => deleteType(type)} className="text-xs text-red-400 hover:text-red-600 transition-colors">刪除</button>
                                </div>
                            </div>
                            <div className="flex flex-wrap gap-2">
                                {allStepPool.map(step => {
                                    const on = activeSteps.includes(step);
                                    return (
                                        <button
                                            key={step}
                                            onClick={() => toggleStep(type, step)}
                                            className={`px-3 py-1 text-xs rounded-full border transition-colors font-medium ${
                                                on
                                                    ? 'bg-gray-900 text-white border-gray-900'
                                                    : 'bg-white text-gray-400 border-gray-200 hover:border-gray-400 hover:text-gray-600'
                                            }`}
                                        >{step}</button>
                                    );
                                })}
                            </div>
                            {activeSteps.length > 0 ? (
                                <div className="flex items-center gap-1 flex-wrap pt-1">
                                    <span className="text-xs text-gray-400 mr-1">流程：</span>
                                    {activeSteps.map((s, i) => (
                                        <span key={s} className="flex items-center gap-1">
                                            <span className="text-xs text-gray-600">{s}</span>
                                            {i < activeSteps.length - 1 && <span className="text-gray-300 text-xs">→</span>}
                                        </span>
                                    ))}
                                </div>
                            ) : (
                                <p className="text-xs text-gray-300 pt-1">未選取任何步驟</p>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

// ════════════════════════════════════════════════════
// Tab 4：廠商管理
// ════════════════════════════════════════════════════
function VendorsTab({ settings, setSettings }) {
    const [adding, setAdding] = useState(false);
    const [form, setForm] = useState({ name: '', type: '', phone: '', email: '', address: '', note: '' });
    const [editId, setEditId] = useState(null);
    const [editForm, setEditForm] = useState({});

    const vendors = settings.vendors || [];

    const handleAdd = () => {
        if (!form.name.trim()) return;
        setSettings(s => ({ ...s, vendors: [...(s.vendors || []), { id: uid(), ...form }] }));
        setForm({ name: '', type: '', phone: '', email: '', address: '', note: '' });
        setAdding(false);
    };
    const handleSave = (id) => {
        setSettings(s => ({ ...s, vendors: s.vendors.map(v => v.id === id ? { ...v, ...editForm } : v) }));
        setEditId(null);
    };
    const handleDelete = (id) => {
        if (!window.confirm('確認刪除此廠商？')) return;
        setSettings(s => ({ ...s, vendors: s.vendors.filter(v => v.id !== id) }));
    };

    return (
        <div className="space-y-4">
            <div className="flex justify-between items-center">
                <p className="text-sm text-gray-500">管理承包廠商資料</p>
                <button onClick={() => setAdding(true)} className="flex-shrink-0 px-4 py-2 bg-gray-900 text-white text-sm rounded-xl font-medium hover:bg-gray-700 transition-colors">+ 新增廠商</button>
            </div>
            {adding && (
                <div className="bg-gray-50 rounded-xl p-4 border border-gray-200 space-y-2">
                    {[['name','廠商名稱 *','text'],['type','廠商種類','text'],['phone','電話','tel'],['email','Email','email'],['address','地址','text'],['note','備註','text']].map(([k,ph,tp]) => (
                        <input key={k} type={tp} placeholder={ph} value={form[k]} onChange={e => setForm(f => ({ ...f, [k]: e.target.value }))} className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg outline-none focus:border-gray-400 bg-white" />
                    ))}
                    <div className="flex gap-2">
                        <button onClick={handleAdd} className="px-4 py-1.5 bg-gray-900 text-white text-sm rounded-lg">新增</button>
                        <button onClick={() => { setAdding(false); setForm({ name:'',phone:'',email:'',address:'',note:'' }); }} className="px-4 py-1.5 text-sm text-gray-500 hover:bg-gray-200 rounded-lg">取消</button>
                    </div>
                </div>
            )}
            {vendors.length === 0 && !adding ? (
                <p className="text-center text-gray-300 py-10">尚無廠商資料</p>
            ) : (
                <div className="divide-y divide-gray-100 border border-gray-100 rounded-xl overflow-hidden">
                    {vendors.map(v => (
                        <div key={v.id} className="bg-white px-4 py-3">
                            {editId === v.id ? (
                                <div className="space-y-2">
                                    {[['name','廠商名稱 *','text'],['type','廠商種類','text'],['phone','電話','tel'],['email','Email','email'],['address','地址','text'],['note','備註','text']].map(([k,ph,tp]) => (
                                        <input key={k} type={tp} placeholder={ph} value={editForm[k]||''} onChange={e => setEditForm(f => ({ ...f, [k]: e.target.value }))} className="w-full px-3 py-1.5 text-sm border border-gray-200 rounded-lg outline-none focus:border-gray-400 bg-gray-50" />
                                    ))}
                                    <div className="flex gap-2">
                                        <button onClick={() => handleSave(v.id)} className="text-sm text-blue-600 font-medium">儲存</button>
                                        <button onClick={() => setEditId(null)} className="text-sm text-gray-400">取消</button>
                                    </div>
                                </div>
                            ) : (
                                <div className="flex items-start justify-between">
                                    <div>
                                        <p className="font-medium text-sm text-gray-800">{v.name}{v.type ? <span className="text-xs text-gray-500 ml-2">{v.type}</span> : null}</p>
                                        {v.phone && <p className="text-xs text-gray-400 mt-0.5"><span className="text-gray-500">電話：</span>{v.phone}</p>}
                                        {v.email && <p className="text-xs text-gray-400 mt-0.5"><span className="text-gray-500">電子郵件：</span>{v.email}</p>}
                                        {v.address && <p className="text-xs text-gray-400 mt-0.5"><span className="text-gray-500">地址：</span>{v.address}</p>}
                                        {v.note && <p className="text-xs text-gray-400 mt-0.5"><span className="text-gray-500">備註：</span>{v.note}</p>}
                                    </div>
                                    <div className="flex gap-3 flex-shrink-0 ml-2">
                                        <button onClick={() => { setEditId(v.id); setEditForm({ name:v.name, type:v.type||'', phone:v.phone||'', email:v.email||'', address:v.address||'', note:v.note||'' }); }} className="text-xs text-gray-400 hover:text-gray-700">編輯</button>
                                        <button onClick={() => handleDelete(v.id)} className="text-xs text-red-400 hover:text-red-600">刪除</button>
                                    </div>
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

// ════════════════════════════════════════════════════
// Tab 5：人員帳號
// ════════════════════════════════════════════════════
function UsersTab({ onUsersChange }) {
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [adding, setAdding] = useState(false);
    const [form, setForm] = useState({ name: '', account: '', role: 'site', email: '' });
    const [editId, setEditId] = useState(null);
    const [editForm, setEditForm] = useState({});
    const [successMsg, setSuccessMsg] = useState('');
    const [apiError, setApiError] = useState('');

    const fetchUsers = async () => {
        try {
            const res = await fetch('/api/users');
            if (res.ok) {
                const data = await res.json();
                setUsers(data);
                onUsersChange?.(data);
            }
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchUsers(); }, []);

    const handleAdd = async () => {
        if (!form.name.trim() || !form.account.trim()) return;
        setApiError('');
        const res = await fetch('/api/users', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(form),
        });
        const data = await res.json();
        if (!res.ok) { setApiError(data.error || '新增失敗'); return; }
        setSuccessMsg(`「${form.name}」帳號已建立，初始密碼為 123456`);
        setForm({ name: '', account: '', role: 'site', email: '' });
        setAdding(false);
        fetchUsers();
    };

    const handleSave = async (id) => {
        setApiError('');
        const res = await fetch('/api/users', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id, ...editForm }),
        });
        if (!res.ok) { const d = await res.json(); setApiError(d.error || '更新失敗'); return; }
        setEditId(null);
        fetchUsers();
    };

    const handleDelete = async (id) => {
        if (!window.confirm('確認刪除此帳號？')) return;
        setApiError('');
        await fetch(`/api/users?id=${id}`, { method: 'DELETE' });
        fetchUsers();
    };

    const handleResetPassword = async (id, name) => {
        if (!window.confirm(`確認重置「${name}」的密碼？`)) return;
        setApiError('');
        const res = await fetch('/api/users?action=resetPassword', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id }),
        });
        const data = await res.json();
        if (!res.ok) { setApiError(data.error || '重置失敗'); return; }
        setSuccessMsg(`「${name}」密碼已重置為 123456`);
        fetchUsers();
    };

    if (loading) return <div className="text-sm text-gray-400 py-8 text-center">載入中...</div>;

    return (
        <div className="space-y-4">
            <div className="flex justify-between items-center">
                <p className="text-sm text-gray-500">管理系統使用者帳號與角色</p>
                <button onClick={() => { setAdding(true); setApiError(''); }} className="flex-shrink-0 px-4 py-2 bg-gray-900 text-white text-sm rounded-xl font-medium hover:bg-gray-700 transition-colors ml-4">+ 新增帳號</button>
            </div>

            {apiError && <p className="text-xs text-red-500">{apiError}</p>}

            {adding && (
                <div className="bg-gray-50 rounded-xl p-4 border border-gray-200 space-y-2">
                    <div className="grid grid-cols-2 gap-2">
                        <input autoFocus type="text" placeholder="姓名 *" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} className="px-3 py-2 text-sm border border-gray-200 rounded-lg outline-none focus:border-gray-400 bg-white" />
                        <input type="text" placeholder="帳號 *" value={form.account} onChange={e => setForm(f => ({ ...f, account: e.target.value }))} className="px-3 py-2 text-sm border border-gray-200 rounded-lg outline-none focus:border-gray-400 bg-white" />
                        <select value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value }))} className="px-3 py-2 text-sm border border-gray-200 rounded-lg outline-none focus:border-gray-400 bg-white col-span-2">
                            {Object.entries(ROLE_LABELS).map(([k,v]) => <option key={k} value={k}>{v}</option>)}
                        </select>
                        <input type="email" placeholder="Gmail（忘記密碼用，選填）" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} className="px-3 py-2 text-sm border border-gray-200 rounded-lg outline-none focus:border-gray-400 bg-white col-span-2" />
                    </div>
                    <div className="flex gap-2">
                        <button onClick={handleAdd} className="px-4 py-1.5 bg-gray-900 text-white text-sm rounded-lg">新增</button>
                        <button onClick={() => { setAdding(false); setForm({ name:'', account:'', role:'site', email:'' }); }} className="px-4 py-1.5 text-sm text-gray-500 hover:bg-gray-200 rounded-lg">取消</button>
                    </div>
                </div>
            )}

            <div className="divide-y divide-gray-100 border border-gray-100 rounded-xl overflow-hidden">
                {users.length === 0 && <div className="py-8 text-center text-sm text-gray-300">尚無帳號</div>}
                {users.map(u => (
                    <div key={u.id} className="bg-white px-4 py-3">
                        {editId === u.id ? (
                            <div className="space-y-2">
                                <div className="grid grid-cols-2 gap-2">
                                    <input autoFocus type="text" placeholder="姓名 *" value={editForm.name||''} onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))} className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg outline-none focus:border-gray-400 bg-gray-50" />
                                    <input type="text" placeholder="帳號" value={editForm.account||''} onChange={e => setEditForm(f => ({ ...f, account: e.target.value }))} className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg outline-none focus:border-gray-400 bg-gray-50" />
                                    <select value={editForm.role||'site'} onChange={e => setEditForm(f => ({ ...f, role: e.target.value }))} className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg outline-none focus:border-gray-400 bg-gray-50 col-span-2">
                                        {Object.entries(ROLE_LABELS).filter(([k]) => k !== 'pending').map(([k,v]) => <option key={k} value={k}>{v}</option>)}
                                    </select>
                                    <input type="email" placeholder="Gmail（忘記密碼用，選填）" value={editForm.email||''} onChange={e => setEditForm(f => ({ ...f, email: e.target.value }))} className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg outline-none focus:border-gray-400 bg-gray-50 col-span-2" />
                                </div>
                                <div className="flex gap-2">
                                    <button onClick={() => handleSave(u.id)} className="text-sm text-blue-600 font-medium">儲存</button>
                                    <button onClick={() => setEditId(null)} className="text-sm text-gray-400">取消</button>
                                </div>
                            </div>
                        ) : (
                            <div className="flex items-center justify-between">
                                <div>
                                    <div className="flex items-center gap-2">
                                        <p className="font-medium text-sm text-gray-800">{u.name}</p>
                                        <span className={`text-xs px-2 py-0.5 rounded-full ${
                                            u.role === 'admin' ? 'bg-gray-900 text-white' :
                                            u.role === 'drawing' ? 'bg-blue-100 text-blue-700' :
                                            u.role === 'purchasing' ? 'bg-purple-100 text-purple-700' :
                                            u.role === 'site' ? 'bg-orange-100 text-orange-700' :
                                            'bg-green-100 text-green-700'
                                        }`}>{ROLE_LABELS[u.role] || u.role}</span>
                                        {u.role === 'pending' && <span className="text-xs text-orange-500 font-medium">待審核</span>}
                                        {u.mustChangePassword && u.role !== 'pending' && <span className="text-xs text-amber-500">（待設定密碼）</span>}
                                    </div>
                                    <p className="text-xs text-gray-400 mt-0.5">{u.account}{u.email ? ` · ${u.email}` : ''}{u.googleId ? ' · 🔗 Google' : ''}</p>
                                </div>
                                <div className="flex gap-2 flex-shrink-0 ml-2">
                                    <button onClick={() => handleResetPassword(u.id, u.name)} className="text-xs text-amber-500 hover:text-amber-700">重置密碼</button>
                                    <button onClick={() => { setEditId(u.id); setEditForm({ name:u.name, account:u.account, role:u.role, email:u.email||'' }); }} className="text-xs text-gray-400 hover:text-gray-700">編輯</button>
                                    <button onClick={() => handleDelete(u.id)} className="text-xs text-red-400 hover:text-red-600">刪除</button>
                                </div>
                            </div>
                        )}
                    </div>
                ))}
            </div>

            {successMsg && (
                <div className="bg-green-50 border border-green-200 rounded-xl px-4 py-3 text-sm text-green-700 flex justify-between items-center">
                    <span>{successMsg}</span>
                    <button onClick={() => setSuccessMsg('')} className="text-green-400 hover:text-green-600 ml-3">✕</button>
                </div>
            )}
        </div>
    );
}

// ════════════════════════════════════════════════════
// Google Drive 同步
// ════════════════════════════════════════════════════
const DRIVE_CLIENT_ID = '343315337087-g0p1bbhuocrj7au9t271emgvfjmfof5r.apps.googleusercontent.com';

async function driveCreateFolder(token, name, parentId) {
    const body = { name, mimeType: 'application/vnd.google-apps.folder' };
    if (parentId) body.parents = [parentId];
    const res = await fetch('https://www.googleapis.com/drive/v3/files', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    });
    const d = await res.json();
    if (d.error) throw new Error(d.error.message);
    return d.id;
}

function base64ToBlob(b64) {
    const [hdr, data] = b64.split(',');
    const mime = hdr.match(/:(.*?);/)[1];
    return new Blob([Uint8Array.from(atob(data), c => c.charCodeAt(0))], { type: mime });
}

async function driveUploadFile(token, name, blob, parentId) {
    const boundary = 'prowork_drive_boundary';
    const meta = JSON.stringify({ name, parents: [parentId] });
    const enc = new TextEncoder();
    const metaPart = enc.encode(`--${boundary}\r\nContent-Type: application/json\r\n\r\n${meta}\r\n--${boundary}\r\nContent-Type: ${blob.type}\r\n\r\n`);
    const closePart = enc.encode(`\r\n--${boundary}--`);
    const fileBytes = new Uint8Array(await blob.arrayBuffer());
    const body = new Uint8Array(metaPart.length + fileBytes.length + closePart.length);
    body.set(metaPart); body.set(fileBytes, metaPart.length); body.set(closePart, metaPart.length + fileBytes.length);
    const res = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': `multipart/related; boundary="${boundary}"` },
        body,
    });
    const d = await res.json();
    if (d.error) throw new Error(d.error.message);
    return d.id;
}

function DriveBackupTab() {
    const [phase, setPhase] = useState('idle');
    const [msg, setMsg] = useState('');

    const sync = async () => {
        setPhase('syncing'); setMsg('取得授權...');
        try {
            const token = await new Promise((resolve, reject) => {
                if (!window.google?.accounts?.oauth2) return reject(new Error('Google SDK 未載入，請重新整理頁面'));
                const client = window.google.accounts.oauth2.initTokenClient({
                    client_id: DRIVE_CLIENT_ID,
                    scope: 'https://www.googleapis.com/auth/drive.file',
                    callback: r => r.error ? reject(new Error(r.error)) : resolve(r.access_token),
                });
                client.requestAccessToken();
            });

            setMsg('載入資料...');
            const [photos, notes, initData] = await Promise.all([
                fetch('/api/calendarPhotos').then(r => r.json()),
                fetch('/api/storage').then(r => r.json()),
                fetch('/api/init').then(r => r.json()),
            ]);
            const projectMap = {};
            (initData.projects || []).forEach(p => { projectMap[p.id] = p.name; });

            setMsg('建立資料夾...');
            const rootId    = await driveCreateFolder(token, 'ProWork', null);
            const photoRoot = await driveCreateFolder(token, '照片', rootId);
            const noteRoot  = await driveCreateFolder(token, '筆記', rootId);

            const projFolders = {}, dateFolders = {};
            let photoCount = 0;
            for (const entry of photos) {
                const projName = projectMap[entry.projectId] || '未知工地';
                if (!projFolders[entry.projectId]) {
                    projFolders[entry.projectId] = await driveCreateFolder(token, projName, photoRoot);
                }
                const dateKey = `${entry.projectId}|${entry.date}`;
                if (!dateFolders[dateKey]) {
                    dateFolders[dateKey] = await driveCreateFolder(token, entry.date, projFolders[entry.projectId]);
                }
                for (let i = 0; i < (entry.images || []).length; i++) {
                    const blob = base64ToBlob(entry.images[i].preview);
                    const parts = [entry.date, entry.floor, entry.direction, i + 1].filter(Boolean);
                    await driveUploadFile(token, `${parts.join('_')}.jpg`, blob, dateFolders[dateKey]);
                    setMsg(`上傳照片... ${++photoCount} 張`);
                }
            }

            let noteCount = 0;
            for (const note of notes) {
                const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${note.title || '未命名'}</title></head><body>${note.content || ''}</body></html>`;
                await driveUploadFile(token, `${note.title || '未命名'}.html`, new Blob([html], { type: 'text/html' }), noteRoot);
                setMsg(`上傳筆記... ${++noteCount} 筆`);
            }

            setMsg(`完成！${photoCount} 張照片、${noteCount} 筆筆記已上傳到 Google Drive「ProWork」資料夾`);
            setPhase('done');
        } catch (e) {
            setMsg(e.message || '同步失敗');
            setPhase('error');
        }
    };

    return (
        <div className="space-y-4 py-2">
            <div>
                <h3 className="text-sm font-semibold text-gray-700 mb-1">同步到 Google Drive</h3>
                <p className="text-xs text-gray-400 leading-relaxed">
                    將所有照片（JPG）與筆記（HTML）上傳到你的 Google Drive，
                    建立「ProWork / 照片 / 工地 / 日期」與「ProWork / 筆記」的資料夾結構，方便直接在 Drive 瀏覽。
                    <br />每次同步為全量上傳（不刪除 Drive 上的舊檔案）。
                </p>
            </div>
            {msg && (
                <p className={`text-xs ${phase === 'error' ? 'text-red-500' : phase === 'done' ? 'text-green-600' : 'text-blue-500'}`}>
                    {msg}
                </p>
            )}
            <button
                onClick={sync}
                disabled={phase === 'syncing'}
                className="px-4 py-2 bg-blue-600 text-white text-sm rounded-xl hover:bg-blue-700 disabled:opacity-60 transition-colors"
            >
                {phase === 'syncing' ? '同步中...' : '📤 同步到 Google Drive'}
            </button>
        </div>
    );
}

// ════════════════════════════════════════════════════
// 主元件
// ════════════════════════════════════════════════════
const TABS = [
    { key: 'projects', label: '工地管理' },
    { key: 'steps',    label: '流程步驟' },
    { key: 'vendors',  label: '廠商管理' },
    { key: 'users',    label: '人員帳號' },
    { key: 'backup',   label: '備份' },
];

export function SettingsPage() {
    const [activeTab, setActiveTab] = useState('projects');
    const { settings, updateSettings } = useSettings();
    const setSettings = (next) => updateSettings(typeof next === 'function' ? next(settings) : next);
    const [dbUsers, setDbUsers] = useState([]);

    return (
        <div className="min-h-screen bg-gray-50 font-sans text-gray-800">
            {/* Tab 列 */}
            <div className="bg-white border-b border-gray-100">
                <div className="max-w-3xl mx-auto px-4 flex gap-1 overflow-x-auto py-2">
                    {TABS.map(t => (
                        <button
                            key={t.key}
                            onClick={() => setActiveTab(t.key)}
                            className={`flex-shrink-0 px-4 py-1.5 text-sm rounded-full transition-colors ${activeTab === t.key ? 'bg-gray-900 text-white font-medium' : 'text-gray-500 hover:bg-gray-100'}`}
                        >{t.label}</button>
                    ))}
                </div>
            </div>

            {/* 內容 */}
            <div className="max-w-3xl mx-auto p-4 md:p-6">
                <h2 className="text-lg font-bold text-gray-900 mb-5">
                    {TABS.find(t => t.key === activeTab)?.label}
                </h2>
                {activeTab === 'projects' && <ProjectTab allUsers={dbUsers} />}
                {activeTab === 'steps'    && <StepsTab settings={settings} setSettings={setSettings} />}
                {activeTab === 'vendors'  && <VendorsTab settings={settings} setSettings={setSettings} />}
                {activeTab === 'users'    && <UsersTab onUsersChange={setDbUsers} />}
                {activeTab === 'backup'   && <DriveBackupTab />}
            </div>
        </div>
    );
}
