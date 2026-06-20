import { useState, useRef, useEffect } from 'react';
import * as XLSX from 'xlsx';
import { useProject, getDrawingStatus, ITEM_TYPES } from '../context/ProjectContext';

function useAllItemTypes() {
    try {
        const s = localStorage.getItem('pw_settings');
        const custom = s ? (JSON.parse(s).customTypes || []) : [];
        return [...ITEM_TYPES, ...custom];
    } catch { return ITEM_TYPES; }
}

function DateInput({ value, onChange }) {
    const [editing, setEditing] = useState(false);
    const inputRef = useRef(null);

    useEffect(() => {
        if (editing && inputRef.current) {
            try { inputRef.current.showPicker(); } catch (_) {}
        }
    }, [editing]);

    return (
        <div className="relative min-h-[1.1rem]" onDoubleClick={() => setEditing(true)}>
            <input
                ref={inputRef}
                type="date"
                value={value || ''}
                onChange={e => { onChange(e.target.value); setEditing(false); }}
                onBlur={() => setEditing(false)}
                className={`absolute inset-0 w-full text-xs outline-none bg-blue-50 rounded px-1 text-gray-700 opacity-0 ${editing ? 'opacity-100 pointer-events-auto' : 'pointer-events-none'}`}
            />
            <span className={`block text-xs select-none ${value ? 'text-gray-600' : 'text-gray-300'} ${editing ? 'invisible' : ''}`}>
                {value || '——'}
            </span>
        </div>
    );
}

function DrawingRow({ dr, onUpdate, onDelete, isLast, onAddRevision }) {
    const status = getDrawingStatus(dr);
    const canAddRevision = isLast && dr.reviewDate && !dr.approveDate;

    if (!isLast) {
        return (
            <div className="border-b border-gray-50 last:border-0">
                <div className="flex items-center gap-3 px-3 py-2 text-xs text-gray-400 bg-gray-50/60">
                    <span className="font-bold w-10 flex-shrink-0">{dr.rev}</span>
                    <span className="text-[10px]">回簽日期</span>
                    <span className="text-gray-500">{dr.reviewDate || '——'}</span>
                    <span className={`ml-auto text-[10px] px-2 py-0.5 rounded-full font-medium whitespace-nowrap ${status.cls}`}>{status.label}</span>
                </div>
            </div>
        );
    }

    return (
        <div className="border-b border-gray-50 last:border-0">
            <div className="grid grid-cols-[3rem_1fr_1fr_1fr_1fr_auto] gap-1 items-center px-3 py-2 text-xs hover:bg-gray-50">
                <span className="font-bold text-gray-500">{dr.rev}</span>
                <div>
                    <p className="text-gray-400 text-[10px]">預計送審</p>
                    <DateInput value={dr.plannedSubmit} onChange={v => onUpdate(dr.id, { plannedSubmit: v })} />
                </div>
                <div>
                    <p className="text-gray-400 text-[10px]">送審日期</p>
                    <DateInput value={dr.submitDate} onChange={v => onUpdate(dr.id, { submitDate: v })} />
                </div>
                <div>
                    <p className="text-gray-400 text-[10px]">回簽日期</p>
                    <DateInput value={dr.reviewDate} onChange={v => onUpdate(dr.id, { reviewDate: v })} />
                </div>
                <div>
                    <p className="text-gray-400 text-[10px]">核准日期</p>
                    <DateInput value={dr.approveDate} onChange={v => onUpdate(dr.id, { approveDate: v })} />
                </div>
                <div className="flex items-center gap-1">
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium whitespace-nowrap ${status.cls}`}>{status.label}</span>
                    <button onClick={() => onDelete(dr.id)} className="text-gray-200 hover:text-red-400 transition-colors text-xs px-1">✕</button>
                </div>
            </div>
            {dr.reviewDate && !dr.approveDate && (
                <div className="px-3 pb-1">
                    <input
                        type="text"
                        placeholder="回簽意見..."
                        value={dr.note || ''}
                        onChange={e => onUpdate(dr.id, { note: e.target.value })}
                        className="w-full text-xs text-gray-500 bg-orange-50 border border-orange-100 rounded-lg px-2 py-1 outline-none"
                    />
                </div>
            )}
            {canAddRevision && (
                <div className="px-3 pb-2">
                    <button
                        onClick={() => onAddRevision(dr.groupId, dr.rev)}
                        className="text-xs text-blue-500 hover:text-blue-700 font-medium"
                    >+ 新增版次 ({`R${parseInt(dr.rev.replace('R','')) + 1}`})</button>
                </div>
            )}
        </div>
    );
}

function GroupCard({ group, drawings, onUpdateDrawing, onDeleteDrawing, onAddRevision, onDeleteGroup, groupingMode, selected, onToggleSelect, onUpdateGroup }) {
    const [expanded, setExpanded] = useState(true);
    const [showHistory, setShowHistory] = useState(false);
    const [editingType, setEditingType] = useState(false);
    const [typeValue, setTypeValue] = useState(group.type || '');
    const groupDrawings = drawings.filter(dr => dr.groupId === group.id)
        .sort((a, b) => a.rev.localeCompare(b.rev, undefined, { numeric: true }));
    const latest = groupDrawings[groupDrawings.length - 1];
    const status = getDrawingStatus(latest);
    const hasHistory = groupDrawings.length > 1;
    const visibleDrawings = hasHistory && !showHistory ? [latest] : groupDrawings;

    return (
        <div className={`bg-white rounded-2xl border shadow-sm overflow-hidden transition-colors ${groupingMode && selected ? 'border-indigo-400 ring-2 ring-indigo-200' : 'border-gray-100'}`}>
            <div
                className="flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-gray-50"
                onClick={() => groupingMode ? onToggleSelect() : setExpanded(e => !e)}
            >
                <div className="flex items-center gap-2 flex-wrap min-w-0">
                    <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                            {group.itemNo && <span className="text-xs text-gray-400 font-mono">#{group.itemNo}</span>}
                            {group.code && <span className="text-xs text-gray-400 font-mono">{group.code}</span>}
                            <span className="font-semibold text-gray-800">{group.name}</span>
                            {editingType ? (
                                <input
                                    autoFocus
                                    value={typeValue}
                                    onChange={e => setTypeValue(e.target.value)}
                                    onBlur={() => { onUpdateGroup(group.id, { type: typeValue }); setEditingType(false); }}
                                    onKeyDown={e => {
                                        if (e.key === 'Enter') { onUpdateGroup(group.id, { type: typeValue }); setEditingType(false); }
                                        if (e.key === 'Escape') setEditingType(false);
                                    }}
                                    onClick={e => e.stopPropagation()}
                                    className="text-xs px-2 py-0.5 bg-gray-100 text-gray-700 rounded-full border border-gray-300 outline-none w-24"
                                />
                            ) : (
                                <span
                                    onClick={e => { e.stopPropagation(); setTypeValue(group.type || ''); setEditingType(true); }}
                                    title="點擊編輯類型"
                                    className="text-xs px-2 py-0.5 bg-gray-100 text-gray-500 rounded-full cursor-pointer hover:bg-gray-200 transition-colors"
                                >{group.type || '未分類'}</span>
                            )}
                            {group.batchTag && <span className="text-xs px-2 py-0.5 bg-indigo-50 text-indigo-500 rounded-full">批次：{group.batchTag}</span>}
                            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${status.cls}`}>{status.label}</span>
                            {latest && <span className="text-xs text-gray-400">{latest.rev}</span>}
                        </div>
                        {group.note && <p className="text-xs text-gray-400 mt-0.5">{group.note}</p>}
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    {groupingMode ? (
                        <div className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${selected ? 'bg-indigo-600 border-indigo-600' : 'border-gray-300'}`}>
                            {selected && <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/></svg>}
                        </div>
                    ) : (
                        <>
                            <button
                                onClick={e => { e.stopPropagation(); if (window.confirm(`刪除群組「${group.name}」？`)) onDeleteGroup(group.id); }}
                                className="text-xs text-gray-300 hover:text-red-400 transition-colors"
                            >刪除</button>
                            <svg className={`w-4 h-4 text-gray-400 transition-transform ${expanded ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7"/></svg>
                        </>
                    )}
                </div>
            </div>
            {expanded && (
                <div className="border-t border-gray-50" onDoubleClick={() => hasHistory && setShowHistory(s => !s)}>
                    {/* 欄位標題 */}
                    <div className="grid grid-cols-[3rem_1fr_1fr_1fr_1fr_auto] gap-1 px-3 py-1 bg-gray-50 text-[10px] text-gray-400 font-medium">
                        <span>版次</span>
                        <span>預計送審</span>
                        <span>送審日期</span>
                        <span>回簽日期</span>
                        <span>核准日期</span>
                        <span>狀態</span>
                    </div>
                    {hasHistory && !showHistory && (
                        <div className="px-3 py-1 text-[10px] text-gray-300 select-none">
                            共 {groupDrawings.length} 個版次，雙擊展開歷史紀錄
                        </div>
                    )}
                    {visibleDrawings.map((dr, i) => (
                        <DrawingRow
                            key={dr.id}
                            dr={dr}
                            onUpdate={onUpdateDrawing}
                            onDelete={onDeleteDrawing}
                            isLast={groupDrawings.indexOf(dr) === groupDrawings.length - 1}
                            onAddRevision={onAddRevision}
                        />
                    ))}
                    {/* 若最新版次已核准，不需新增版次 */}
                    {(!latest || latest.approveDate) && (
                        <div className="px-3 py-2">
                            <button
                                onClick={() => onAddRevision(group.id, latest?.rev || 'R0')}
                                className="text-xs text-blue-500 hover:text-blue-700 font-medium"
                            >+ 新增版次</button>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

export function DrawingPage() {
    const { projects, groups, drawings, addGroup, updateGroup, deleteGroup, addDrawingRevision, updateDrawing, deleteDrawing } = useProject();
    const allTypes = useAllItemTypes();
    const [activeProjectId, setActiveProjectId] = useState(projects[0]?.id ?? null);
    const [addingGroup, setAddingGroup] = useState(false);
    const [newGroupName, setNewGroupName] = useState('');
    const [newGroupType, setNewGroupType] = useState(allTypes[0]);

    // 群組模式
    const [groupingMode, setGroupingMode] = useState(false);
    const [groupTag, setGroupTag] = useState('');
    const [selectedIds, setSelectedIds] = useState(new Set());

    const activeGroups = groups.filter(g => g.projectId === activeProjectId);

    const handleAddGroup = () => {
        if (!newGroupName.trim() || !activeProjectId) return;
        addGroup(activeProjectId, newGroupName.trim(), newGroupType);
        setNewGroupName('');
        setNewGroupType(allTypes[0]);
        setAddingGroup(false);
    };

    const toggleSelect = (id) => {
        setSelectedIds(prev => {
            const next = new Set(prev);
            next.has(id) ? next.delete(id) : next.add(id);
            return next;
        });
    };

    const handleConfirmGroup = async () => {
        if (!groupTag.trim() || selectedIds.size === 0) return;
        for (const id of selectedIds) {
            await updateGroup(id, { batchTag: groupTag.trim() });
        }
        setGroupingMode(false);
        setGroupTag('');
        setSelectedIds(new Set());
    };

    const handleCancelGroup = () => {
        setGroupingMode(false);
        setGroupTag('');
        setSelectedIds(new Set());
    };

    const handleExport = () => {
        const project = projects.find(p => p.id === activeProjectId);
        const projGroups = groups.filter(g => g.projectId === activeProjectId)
            .sort((a, b) => Number(a.itemNo || 999) - Number(b.itemNo || 999));

        const rows = [];
        for (const g of projGroups) {
            const gDrawings = drawings
                .filter(d => d.groupId === g.id)
                .sort((a, b) => a.rev.localeCompare(b.rev, undefined, { numeric: true }));
            for (const d of gDrawings) {
                rows.push({
                    '項次':     g.itemNo || '',
                    '工料編號': g.code || '',
                    '項目名稱': g.name,
                    '品項類型': g.type || '',
                    '批次':     g.batchTag || '',
                    '版次':     d.rev,
                    '預計送審': d.plannedSubmit || '',
                    '送審日期': d.submitDate || '',
                    '回簽日期': d.reviewDate || '',
                    '核准日期': d.approveDate || '',
                    '狀態':     getDrawingStatus(d).label,
                    '備註':     d.note || '',
                });
            }
        }

        const ws = XLSX.utils.json_to_sheet(rows);
        ws['!cols'] = [
            { wch: 6 }, { wch: 12 }, { wch: 36 }, { wch: 12 }, { wch: 10 },
            { wch: 6 }, { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 8 }, { wch: 20 },
        ];
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, '繪圖管理');
        const fileName = `繪圖管理_${project?.name || ''}_${new Date().toISOString().slice(0, 10)}.xlsx`;
        XLSX.writeFile(wb, fileName);
    };

    // 更新日期時同步同批次所有項目的最新版次
    const handleUpdateDrawing = (drId, fields) => {
        updateDrawing(drId, fields);
        const dr = drawings.find(d => d.id === drId);
        if (!dr) return;
        const group = groups.find(g => g.id === dr.groupId);
        if (!group?.batchTag) return;
        const siblings = groups.filter(g =>
            g.batchTag === group.batchTag &&
            g.projectId === group.projectId &&
            g.id !== group.id
        );
        for (const sg of siblings) {
            const sgLatest = drawings
                .filter(d => d.groupId === sg.id)
                .sort((a, b) => a.rev.localeCompare(b.rev, undefined, { numeric: true }))
                .at(-1);
            if (sgLatest) updateDrawing(sgLatest.id, fields);
        }
    };

    if (projects.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh] text-gray-300 gap-3 font-sans">
                <p className="text-5xl">📐</p>
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

            <div className="max-w-5xl mx-auto p-4 md:p-6 space-y-4">
                {/* 頁面標題列 */}
                <div className="flex items-center justify-between">
                    <h2 className="text-lg font-bold text-gray-900">繪圖管理</h2>
                    {activeProjectId && (
                        <div className="flex gap-2">
                            <button
                                onClick={handleExport}
                                className="px-4 py-2 text-sm rounded-xl font-medium transition-colors border bg-white text-gray-700 border-gray-200 hover:bg-gray-50"
                            >匯出 Excel</button>
                            <button
                                onClick={() => { setGroupingMode(g => !g); setAddingGroup(false); }}
                                className={`px-4 py-2 text-sm rounded-xl font-medium transition-colors border ${groupingMode ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'}`}
                            >群組</button>
                            <button
                                onClick={() => { setAddingGroup(true); setGroupingMode(false); }}
                                className="px-4 py-2 bg-gray-900 text-white text-sm rounded-xl font-medium hover:bg-gray-700 transition-colors"
                            >+ 新增項目</button>
                        </div>
                    )}
                </div>

                {/* 群組模式工具列 */}
                {groupingMode && (
                    <div className="bg-indigo-50 border border-indigo-200 rounded-2xl p-4 space-y-3">
                        <p className="text-sm font-semibold text-indigo-800">選取項目並指定群組名稱，同群組項目的日期欄位將自動同步</p>
                        <div className="flex gap-2 items-center">
                            <input
                                autoFocus
                                type="text"
                                placeholder="群組名稱（例：A批、第一送審）"
                                value={groupTag}
                                onChange={e => setGroupTag(e.target.value)}
                                className="flex-1 px-3 py-2 text-sm border border-indigo-200 rounded-lg outline-none focus:border-indigo-400 bg-white"
                            />
                            <button
                                onClick={handleConfirmGroup}
                                disabled={!groupTag.trim() || selectedIds.size === 0}
                                className="px-4 py-2 bg-indigo-600 text-white text-sm rounded-lg disabled:opacity-40"
                            >確認（已選 {selectedIds.size}）</button>
                            <button onClick={handleCancelGroup} className="px-4 py-2 text-sm text-gray-500 hover:bg-white rounded-lg">取消</button>
                        </div>
                    </div>
                )}

                {/* 新增項目表單 */}
                {addingGroup && (
                    <div className="bg-white rounded-2xl border border-gray-200 p-4 shadow-sm space-y-3">
                        <p className="text-sm font-semibold text-gray-700">新增項目</p>
                        <input
                            autoFocus
                            type="text"
                            placeholder="群組名稱（例：外牆包板）"
                            value={newGroupName}
                            onChange={e => setNewGroupName(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && handleAddGroup()}
                            className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg outline-none focus:border-gray-400 bg-gray-50"
                        />
                        <div>
                            <label className="text-xs text-gray-400 mb-1 block">品項類型</label>
                            <select
                                value={newGroupType}
                                onChange={e => setNewGroupType(e.target.value)}
                                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg outline-none focus:border-gray-400 bg-gray-50"
                            >
                                {allTypes.map(t => <option key={t} value={t}>{t}</option>)}
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
                        <p className="text-4xl mb-2">📋</p>
                        <p className="text-gray-400 text-sm">此工地尚無群組，點「+ 新增項目」開始</p>
                    </div>
                ) : (
                    activeGroups.map(g => (
                        <GroupCard
                            key={g.id}
                            group={g}
                            drawings={drawings}
                            onUpdateDrawing={handleUpdateDrawing}
                            onDeleteDrawing={deleteDrawing}
                            onAddRevision={addDrawingRevision}
                            onDeleteGroup={deleteGroup}
                            onUpdateGroup={updateGroup}
                            groupingMode={groupingMode}
                            selected={selectedIds.has(g.id)}
                            onToggleSelect={() => toggleSelect(g.id)}
                        />
                    ))
                )}
            </div>
        </div>
    );
}
