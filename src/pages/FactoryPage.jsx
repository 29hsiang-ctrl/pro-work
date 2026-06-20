import { useState } from 'react';
import { useProject, ITEM_TYPES, FACTORY_STEPS_BY_TYPE } from '../context/ProjectContext';

function useAllItemTypes() {
    try {
        const s = localStorage.getItem('pw_settings');
        const custom = s ? (JSON.parse(s).customTypes || []) : [];
        return [...ITEM_TYPES, ...custom];
    } catch { return ITEM_TYPES; }
}

function StepRow({ step, onUpdate, onDelete }) {
    const today = new Date().toISOString().slice(0, 10);
    const isDone = !!step.doneDate;

    return (
        <div className={`flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${isDone ? 'bg-green-50' : 'hover:bg-gray-50'}`}>
            {/* 完成 checkbox */}
            <button
                onClick={() => onUpdate(step.id, { doneDate: isDone ? '' : today })}
                className={`flex-shrink-0 w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors ${isDone ? 'bg-green-500 border-green-500 text-white' : 'border-gray-300 hover:border-green-400'}`}
            >
                {isDone && <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/></svg>}
            </button>

            {/* 步驟名稱 */}
            <span className={`text-sm flex-1 ${isDone ? 'text-gray-400 line-through' : 'text-gray-700'}`}>{step.stepName}</span>

            {/* 預計日期 */}
            <div className="flex items-center gap-1 text-xs text-gray-400 shrink-0">
                <span className="hidden sm:inline">預計</span>
                <input
                    type="date"
                    value={step.plannedDate || ''}
                    onChange={e => onUpdate(step.id, { plannedDate: e.target.value })}
                    className="text-xs border-0 outline-none bg-transparent text-gray-500 cursor-pointer w-[120px]"
                    onClick={e => e.stopPropagation()}
                />
            </div>

            {/* 完成日期 */}
            {isDone && (
                <div className="flex items-center gap-1 text-xs shrink-0">
                    <span className="text-green-600">✓</span>
                    <input
                        type="date"
                        value={step.doneDate || ''}
                        onChange={e => onUpdate(step.id, { doneDate: e.target.value })}
                        className="text-xs border-0 outline-none bg-transparent text-green-600 cursor-pointer w-[120px]"
                        onClick={e => e.stopPropagation()}
                    />
                </div>
            )}

            {/* 刪除 */}
            <button
                onClick={() => onDelete(step.id)}
                className="text-gray-200 hover:text-red-400 text-xs px-1 transition-colors flex-shrink-0"
            >✕</button>
        </div>
    );
}

function GroupCard({ group, steps, onUpdateStep, onAddStep, onDeleteStep, onDeleteGroup }) {
    const [expanded, setExpanded] = useState(true);
    const [addingStep, setAddingStep] = useState(false);
    const [newStepName, setNewStepName] = useState('');

    const groupSteps = steps
        .filter(fs => fs.groupId === group.id)
        .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

    const doneCount = groupSteps.filter(s => s.doneDate).length;
    const total = groupSteps.length;
    const pct = total ? Math.round(doneCount / total * 100) : 0;

    const handleAddStep = () => {
        if (!newStepName.trim()) return;
        onAddStep(group.id, newStepName.trim());
        setNewStepName('');
        setAddingStep(false);
    };

    return (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            {/* 群組標題 */}
            <div
                className="flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-gray-50"
                onClick={() => setExpanded(e => !e)}
            >
                <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                            {group.itemNo && <span className="text-xs text-gray-400 font-mono">#{group.itemNo}</span>}
                            {group.code && <span className="text-xs text-gray-400 font-mono">{group.code}</span>}
                            <span className="font-semibold text-gray-800 text-sm">{group.name}</span>
                            <span className="text-xs px-2 py-0.5 bg-gray-100 text-gray-500 rounded-full flex-shrink-0">{group.type}</span>
                        </div>
                        {total > 0 && (
                            <div className="flex items-center gap-2 mt-1">
                                <div className="w-24 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                                    <div
                                        className="h-full bg-green-400 rounded-full transition-all"
                                        style={{ width: `${pct}%` }}
                                    />
                                </div>
                                <span className="text-xs text-gray-400">{doneCount}/{total}</span>
                            </div>
                        )}
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <span className={`text-xs font-bold ${pct === 100 ? 'text-green-600' : 'text-gray-400'}`}>{pct}%</span>
                    <button
                        onClick={e => { e.stopPropagation(); if (window.confirm(`刪除群組「${group.name}」？`)) onDeleteGroup(group.id); }}
                        className="text-xs text-gray-300 hover:text-red-400 transition-colors"
                    >刪除</button>
                    <svg className={`w-4 h-4 text-gray-400 transition-transform flex-shrink-0 ${expanded ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7"/></svg>
                </div>
            </div>

            {/* 步驟列表 */}
            {expanded && (
                <div className="border-t border-gray-50 px-1 py-2 space-y-0.5">
                    {groupSteps.length === 0 && !addingStep && (
                        <p className="text-xs text-gray-300 text-center py-3">此群組尚無步驟</p>
                    )}
                    {groupSteps.map(step => (
                        <StepRow
                            key={step.id}
                            step={step}
                            onUpdate={onUpdateStep}
                            onDelete={onDeleteStep}
                        />
                    ))}

                    {/* 新增步驟 */}
                    {addingStep ? (
                        <div className="flex items-center gap-2 px-3 py-2">
                            <input
                                autoFocus
                                type="text"
                                placeholder="步驟名稱"
                                value={newStepName}
                                onChange={e => setNewStepName(e.target.value)}
                                onKeyDown={e => { if (e.key === 'Enter') handleAddStep(); if (e.key === 'Escape') setAddingStep(false); }}
                                className="flex-1 text-sm border border-gray-200 rounded-lg px-2 py-1 outline-none focus:border-gray-400 bg-gray-50"
                            />
                            <button onClick={handleAddStep} className="text-xs text-blue-600 font-medium px-2">新增</button>
                            <button onClick={() => setAddingStep(false)} className="text-xs text-gray-400 px-2">取消</button>
                        </div>
                    ) : (
                        <button
                            onClick={e => { e.stopPropagation(); setAddingStep(true); }}
                            className="text-xs text-gray-400 hover:text-gray-600 px-4 py-1.5 transition-colors"
                        >+ 新增步驟</button>
                    )}
                </div>
            )}
        </div>
    );
}

export function FactoryPage() {
    const { projects, groups, factorySteps, addGroup, deleteGroup, updateFactoryStep, addFactoryStep, deleteFactoryStep } = useProject();
    const allTypes = useAllItemTypes();
    const [activeProjectId, setActiveProjectId] = useState(projects[0]?.id ?? null);
    const [addingGroup, setAddingGroup] = useState(false);
    const [newGroupName, setNewGroupName] = useState('');
    const [newGroupType, setNewGroupType] = useState(allTypes[0]);

    const activeGroups = groups.filter(g => g.projectId === activeProjectId);

    const handleAddGroup = () => {
        if (!newGroupName.trim() || !activeProjectId) return;
        addGroup(activeProjectId, newGroupName.trim(), newGroupType);
        setNewGroupName('');
        setNewGroupType(allTypes[0]);
        setAddingGroup(false);
    };

    if (projects.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh] text-gray-300 gap-3 font-sans">
                <p className="text-5xl">🏭</p>
                <p className="text-gray-400">請先在「首頁」建立工地</p>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50 font-sans text-gray-800">
            {/* Project tabs */}
            <div className="bg-white border-b border-gray-100 px-4 py-3 flex items-center gap-2 overflow-x-auto">
                {projects.map(p => (
                    <button
                        key={p.id}
                        onClick={() => { setActiveProjectId(p.id); setAddingGroup(false); }}
                        className={`flex-shrink-0 px-4 py-1.5 text-sm rounded-full transition-colors ${activeProjectId === p.id ? 'bg-gray-900 text-white font-medium' : 'text-gray-500 hover:bg-gray-100'}`}
                    >{p.name}</button>
                ))}
            </div>

            <div className="max-w-3xl mx-auto p-4 md:p-6 space-y-4">
                {/* 頁面標題列 */}
                <div className="flex items-center justify-between">
                    <h2 className="text-lg font-bold text-gray-900">工廠管理</h2>
                    {activeProjectId && (
                        <button
                            onClick={() => setAddingGroup(true)}
                            className="px-4 py-2 bg-gray-900 text-white text-sm rounded-xl font-medium hover:bg-gray-700 transition-colors"
                        >+ 新增項目</button>
                    )}
                </div>

                {/* 新增項目 */}
                {addingGroup && (
                    <div className="bg-white rounded-2xl border border-gray-200 p-4 shadow-sm space-y-3">
                        <p className="text-sm font-semibold text-gray-700">新增項目</p>
                        <input
                            autoFocus
                            type="text"
                            placeholder="群組名稱（例：2F 外牆格柵）"
                            value={newGroupName}
                            onChange={e => setNewGroupName(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && handleAddGroup()}
                            className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg outline-none focus:border-gray-400 bg-gray-50"
                        />
                        <div>
                            <label className="text-xs text-gray-400 mb-1 block">品項類型（決定預設工廠步驟）</label>
                            <select
                                value={newGroupType}
                                onChange={e => setNewGroupType(e.target.value)}
                                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg outline-none focus:border-gray-400 bg-gray-50"
                            >
                                {allTypes.map(t => (
                                    <option key={t} value={t}>
                                        {t}{(FACTORY_STEPS_BY_TYPE[t]?.length > 0) ? `（${FACTORY_STEPS_BY_TYPE[t].join(' → ')}）` : '（自定義）'}
                                    </option>
                                ))}
                            </select>
                        </div>
                        <div className="flex gap-2">
                            <button onClick={handleAddGroup} className="px-4 py-1.5 bg-gray-900 text-white text-sm rounded-lg">新增</button>
                            <button onClick={() => { setAddingGroup(false); setNewGroupName(''); }} className="px-4 py-1.5 text-sm text-gray-500 hover:bg-gray-100 rounded-lg">取消</button>
                        </div>
                    </div>
                )}

                {/* 群組列表 */}
                {activeGroups.length === 0 && !addingGroup ? (
                    <div className="text-center py-16 text-gray-300">
                        <p className="text-4xl mb-2">🏭</p>
                        <p className="text-gray-400 text-sm">此工地尚無群組，點「+ 新增項目」開始</p>
                    </div>
                ) : (
                    activeGroups.map(g => (
                        <GroupCard
                            key={g.id}
                            group={g}
                            steps={factorySteps}
                            onUpdateStep={updateFactoryStep}
                            onAddStep={addFactoryStep}
                            onDeleteStep={deleteFactoryStep}
                            onDeleteGroup={deleteGroup}
                        />
                    ))
                )}
            </div>
        </div>
    );
}
