import { useState, useRef, useEffect, forwardRef, useImperativeHandle, Fragment } from 'react';
import * as XLSX from 'xlsx';
import { useProject, getDrawingStatus, ITEM_TYPES } from '../context/ProjectContext';
import { useAuth } from '../context/AuthContext';

function useAllItemTypes() {
    try {
        const s = localStorage.getItem('pw_settings');
        const custom = s ? (JSON.parse(s).customTypes || []) : [];
        return [...ITEM_TYPES, ...custom];
    } catch { return ITEM_TYPES; }
}

const DateInput = forwardRef(function DateInput({ value, onChange, onContextMenu, style }, ref) {
    const [editing, setEditing] = useState(false);
    const inputRef = useRef(null);

    useImperativeHandle(ref, () => ({
        triggerEdit: () => setEditing(true),
    }));

    useEffect(() => {
        if (editing && inputRef.current) {
            try { inputRef.current.showPicker(); } catch (_) {}
        }
    }, [editing]);

    return (
        <div className="relative min-h-[1.1rem]"
             style={style}
             onDoubleClick={() => setEditing(true)}
             onContextMenu={onContextMenu}>
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
});

// 批次顏色（deterministic）
const BATCH_COLORS = [
    'border-blue-400', 'border-purple-400', 'border-orange-400',
    'border-pink-400', 'border-teal-400', 'border-yellow-400',
];
function batchBorderColor(tag) {
    if (!tag) return 'border-transparent';
    let h = 0;
    for (const c of tag) h = (h * 31 + c.charCodeAt(0)) & 0xff;
    return BATCH_COLORS[h % BATCH_COLORS.length];
}
const BATCH_BG_COLORS = [
    'bg-blue-50', 'bg-purple-50', 'bg-orange-50',
    'bg-pink-50', 'bg-teal-50', 'bg-yellow-50',
];
function batchBgColor(tag) {
    if (!tag) return '';
    let h = 0;
    for (const c of tag) h = (h * 31 + c.charCodeAt(0)) & 0xff;
    return BATCH_BG_COLORS[h % BATCH_BG_COLORS.length];
}

// 子項目專用類型
const SUB_ITEM_TYPES = ['預埋件', '內套筒', '補料'];

// 欄寬預設值（px）：toggle / # / 工料編號 / 項目名稱 / 類型 / 版次 / 預計送審 / 送審日期 / 回簽日期 / 核准日期 / 狀態 / delete
const DRAWING_DEFAULT_WIDTHS = [24, 40, 80, 200, 80, 56, 104, 104, 104, 104, 72, 32];
const DRAWING_COL_LABELS = ['', '#', '工料編號', '項目名稱', '類型', '版次', '預計送審', '送審日期', '回簽日期', '核准日期', '狀態', ''];

// ── 側邊群組管理面板 ─────────────────────────────────────────────
function GroupManagementPanel({ open, onClose, batches, activeGroups, drawings, onRemoveFromBatch, onCreateBatch }) {
    const [expanded, setExpanded] = useState({});
    const [addingBatch, setAddingBatch] = useState(false);
    const [newBatchName, setNewBatchName] = useState('');

    const toggle = (tag) => setExpanded(prev => ({ ...prev, [tag]: !prev[tag] }));

    const handleCreate = () => {
        if (!newBatchName.trim()) return;
        onCreateBatch(newBatchName.trim());
        setNewBatchName('');
        setAddingBatch(false);
    };

    // 每個 batch 的進度統計
    const batchStats = (tag) => {
        const members = activeGroups.filter(g => g.batchTag === tag);
        const approved = members.filter(g => {
            const latest = drawings
                .filter(d => d.groupId === g.id)
                .sort((a, b) => b.rev.localeCompare(a.rev, undefined, { numeric: true }))[0];
            return latest?.approveDate;
        }).length;
        return { count: members.length, approved };
    };

    return (
        <>
            {/* Overlay */}
            {open && <div className="fixed inset-0 z-20" onClick={onClose} />}

            {/* Panel */}
            <div className={`fixed right-0 top-0 h-full w-72 bg-white shadow-2xl z-30 flex flex-col transition-transform duration-300 ${open ? 'translate-x-0' : 'translate-x-full'}`}>
                <div className="flex items-center justify-between px-4 py-4 border-b border-gray-100">
                    <h3 className="font-semibold text-gray-900">群組管理</h3>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-lg leading-none">✕</button>
                </div>

                <div className="flex-1 overflow-y-auto p-4 space-y-2">
                    {batches.length === 0 && (
                        <p className="text-xs text-gray-400 text-center py-8">尚無群組，請在表格中選取項目後指定群組</p>
                    )}

                    {batches.map(tag => {
                        const { count, approved } = batchStats(tag);
                        const members = activeGroups.filter(g => g.batchTag === tag);
                        const isExpanded = expanded[tag];
                        const bc = batchBorderColor(tag);

                        return (
                            <div key={tag} className={`border-l-4 ${bc} bg-gray-50 rounded-r-xl overflow-hidden`}>
                                <button
                                    onClick={() => toggle(tag)}
                                    className="w-full flex items-center justify-between px-3 py-2.5 hover:bg-gray-100 transition-colors text-left"
                                >
                                    <div>
                                        <span className="font-medium text-gray-800 text-sm">{tag}</span>
                                        <span className="text-xs text-gray-400 ml-2">{count}項</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <span className={`text-xs font-medium ${approved === count ? 'text-green-600' : 'text-gray-500'}`}>
                                            {approved}/{count} 核准
                                        </span>
                                        <span className="text-gray-400 text-[10px]">{isExpanded ? '▼' : '▶'}</span>
                                    </div>
                                </button>

                                {isExpanded && (
                                    <div className="px-3 pb-2 space-y-1">
                                        {members.map(g => (
                                            <div key={g.id} className="flex items-center justify-between py-1 text-xs text-gray-600">
                                                <span className="truncate flex-1" title={g.name}>{g.name}</span>
                                                <button
                                                    onClick={() => onRemoveFromBatch(g.id)}
                                                    className="ml-2 text-gray-300 hover:text-red-400 transition-colors flex-shrink-0"
                                                >✕</button>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>

                {/* 新增群組 */}
                <div className="border-t border-gray-100 p-4">
                    {addingBatch ? (
                        <div className="space-y-2">
                            <input
                                autoFocus
                                type="text"
                                placeholder="群組名稱（例：A批）"
                                value={newBatchName}
                                onChange={e => setNewBatchName(e.target.value)}
                                onKeyDown={e => { if (e.key === 'Enter') handleCreate(); if (e.key === 'Escape') setAddingBatch(false); }}
                                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg outline-none focus:border-gray-400 bg-gray-50"
                            />
                            <div className="flex gap-2">
                                <button onClick={handleCreate} className="flex-1 py-1.5 bg-gray-900 text-white text-xs rounded-lg">建立</button>
                                <button onClick={() => setAddingBatch(false)} className="flex-1 py-1.5 text-xs text-gray-500 hover:bg-gray-100 rounded-lg">取消</button>
                            </div>
                            <p className="text-[10px] text-gray-400">建立後請在表格中選取項目並指定此群組</p>
                        </div>
                    ) : (
                        <button
                            onClick={() => setAddingBatch(true)}
                            className="w-full py-2 text-sm text-gray-500 hover:bg-gray-50 rounded-xl border border-dashed border-gray-200 transition-colors"
                        >+ 新增群組</button>
                    )}
                </div>
            </div>
        </>
    );
}

// ── GroupRow ─────────────────────────────────────────────────────
function GroupRow({ group, allDr, onUpdate, onUpdateSolo, onDeleteGroup, onUpdateGroup, isAdmin, selectMode, selected, onToggleSelect, onOpenDetail, onAddSubItem, depth = 0, hasChildren = false, isCollapsed = false, onToggleCollapse, gridStyle, colPos }) {
    const [editingType, setEditingType] = useState(false);
    const [typeValue, setTypeValue] = useState(group.type || '');
    const [ctxMenu, setCtxMenu] = useState(null); // { x, y, field }
    const [nameCtxMenu, setNameCtxMenu] = useState(null); // { x, y }
    const [soloPending, setSoloPending] = useState(null); // field name pending solo edit
    const ctxRef = useRef(null);
    const nameCtxRef = useRef(null);

    const dateRefs = {
        plannedSubmit: useRef(null),
        submitDate:    useRef(null),
        reviewDate:    useRef(null),
        approveDate:   useRef(null),
    };

    const sorted = [...allDr].sort((a, b) => a.rev.localeCompare(b.rev, undefined, { numeric: true }));
    const latest = sorted[sorted.length - 1];
    const isApproved = !!latest?.approveDate;
    const status = getDrawingStatus(latest);
    const borderColor = batchBorderColor(group.batchTag);
    const bgColor = group.batchTag ? batchBgColor(group.batchTag) : '';

    const handleTypeBlur = () => {
        onUpdateGroup(group.id, { type: typeValue });
        setEditingType(false);
    };

    // 右鍵名稱欄
    const handleNameRightClick = (e) => {
        e.preventDefault();
        e.stopPropagation();
        setNameCtxMenu({ x: e.clientX, y: e.clientY });
    };

    // 右鍵日期欄（只對有 batchTag 的列作用）
    const handleDateRightClick = (e, field) => {
        if (!group.batchTag) return;
        e.preventDefault();
        e.stopPropagation();
        setCtxMenu({ x: e.clientX, y: e.clientY, field });
    };

    const handleSoloEdit = () => {
        const field = ctxMenu.field;
        setCtxMenu(null);
        setSoloPending(field);
        dateRefs[field].current?.triggerEdit();
    };

    // 關閉 context menu（點擊外部或 Esc）
    useEffect(() => {
        if (!ctxMenu) return;
        const onDown = (e) => { if (ctxRef.current && !ctxRef.current.contains(e.target)) setCtxMenu(null); };
        const onKey  = (e) => { if (e.key === 'Escape') setCtxMenu(null); };
        window.addEventListener('mousedown', onDown);
        window.addEventListener('keydown', onKey);
        return () => { window.removeEventListener('mousedown', onDown); window.removeEventListener('keydown', onKey); };
    }, [ctxMenu]);

    useEffect(() => {
        if (!nameCtxMenu) return;
        const onDown = (e) => { if (nameCtxRef.current && !nameCtxRef.current.contains(e.target)) setNameCtxMenu(null); };
        const onKey  = (e) => { if (e.key === 'Escape') setNameCtxMenu(null); };
        window.addEventListener('mousedown', onDown);
        window.addEventListener('keydown', onKey);
        return () => { window.removeEventListener('mousedown', onDown); window.removeEventListener('keydown', onKey); };
    }, [nameCtxMenu]);

    // 決定 onChange：solo 模式用 onUpdateSolo，否則用 onUpdate
    const makeOnChange = (field, drId) => (v) => {
        if (soloPending === field) {
            setSoloPending(null);
            onUpdateSolo(drId, { [field]: v });
        } else {
            onUpdate(drId, { [field]: v });
        }
    };

    return (
        <>
            {/* 主列 */}
            <div
                className={`gap-x-1 items-center px-2 py-2 border-b border-gray-100 text-xs transition-colors border-l-4 ${borderColor} ${isApproved ? 'bg-gray-50 opacity-60' : (bgColor || 'bg-white')} hover:brightness-95 ${selectMode ? 'cursor-pointer' : ''} ${selectMode && selected ? 'ring-1 ring-inset ring-indigo-300' : ''}`}
                style={gridStyle}
                onClick={() => selectMode && onToggleSelect()}
            >
                {selectMode ? (
                    <div style={{ order: colPos[0] }}
                        onClick={e => { e.stopPropagation(); onToggleSelect(); }}
                        className={`w-4 h-4 rounded border-2 flex items-center justify-center mx-auto cursor-pointer transition-colors ${selected ? 'bg-indigo-600 border-indigo-600' : 'border-gray-300 hover:border-indigo-400'}`}
                    >
                        {selected && <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/></svg>}
                    </div>
                ) : hasChildren ? (
                    <button style={{ order: colPos[0] }}
                        onClick={e => { e.stopPropagation(); onToggleCollapse(); }}
                        className="text-gray-400 text-[10px] flex items-center justify-center hover:text-gray-600 cursor-pointer"
                    >{isCollapsed ? '▶' : '▼'}</button>
                ) : <span style={{ order: colPos[0] }} />}

                <span style={{ order: colPos[1] }} className="text-gray-400 font-mono truncate">{group.itemNo || ''}</span>
                <span style={{ order: colPos[2] }} className="text-gray-400 font-mono truncate">{group.code || ''}</span>
                <span style={{ order: colPos[3] }}
                    className="font-medium text-gray-800 truncate cursor-pointer hover:text-blue-600 transition-colors flex items-center gap-0.5"
                    title="雙擊查看詳細資訊，右鍵更多選項"
                    onDoubleClick={e => { e.stopPropagation(); onOpenDetail(); }}
                    onContextMenu={handleNameRightClick}
                >
                    {depth > 0 && <span className="text-gray-300 flex-shrink-0">└</span>}
                    <span className="truncate">{group.name}</span>
                </span>

                {editingType ? (
                    <input style={{ order: colPos[4] }}
                        autoFocus value={typeValue}
                        onChange={e => setTypeValue(e.target.value)}
                        onBlur={handleTypeBlur}
                        onKeyDown={e => { if (e.key === 'Enter') handleTypeBlur(); if (e.key === 'Escape') setEditingType(false); }}
                        onClick={e => e.stopPropagation()}
                        className="text-xs px-1 py-0.5 bg-gray-100 rounded border border-gray-300 outline-none w-full"
                    />
                ) : (
                    <span style={{ order: colPos[4] }}
                        onClick={e => { e.stopPropagation(); if (!selectMode) { setTypeValue(group.type || ''); setEditingType(true); } }}
                        className="text-xs px-1.5 py-0.5 bg-white/70 text-gray-500 rounded cursor-pointer hover:bg-white truncate"
                        title="點擊編輯類型"
                    >{group.type || '未分類'}</span>
                )}

                <span style={{ order: colPos[5] }} className="text-gray-500 font-mono text-center">{latest?.rev || '—'}</span>

                {latest ? (() => {
                    const approveOnly = !!group.parentId;
                    return (
                        <>
                            {approveOnly || isApproved
                                ? <span style={{ order: colPos[6] }} className="text-xs text-gray-300 select-none">{!approveOnly && (latest.plannedSubmit || '——')}</span>
                                : <DateInput style={{ order: colPos[6] }} ref={dateRefs.plannedSubmit} value={latest.plannedSubmit}
                                    onChange={makeOnChange('plannedSubmit', latest.id)}
                                    onContextMenu={(e) => handleDateRightClick(e, 'plannedSubmit')} />
                            }
                            {approveOnly || isApproved
                                ? <span style={{ order: colPos[7] }} className="text-xs text-gray-300 select-none">{!approveOnly && (latest.submitDate || '——')}</span>
                                : <DateInput style={{ order: colPos[7] }} ref={dateRefs.submitDate} value={latest.submitDate}
                                    onChange={makeOnChange('submitDate', latest.id)}
                                    onContextMenu={(e) => handleDateRightClick(e, 'submitDate')} />
                            }
                            {approveOnly || isApproved
                                ? <span style={{ order: colPos[8] }} className="text-xs text-gray-300 select-none">{!approveOnly && (latest.reviewDate || '——')}</span>
                                : <DateInput style={{ order: colPos[8] }} ref={dateRefs.reviewDate} value={latest.reviewDate}
                                    onChange={makeOnChange('reviewDate', latest.id)}
                                    onContextMenu={(e) => handleDateRightClick(e, 'reviewDate')} />
                            }
                            <DateInput style={{ order: colPos[9] }} ref={dateRefs.approveDate} value={latest.approveDate}
                                onChange={makeOnChange('approveDate', latest.id)}
                                onContextMenu={(e) => handleDateRightClick(e, 'approveDate')} />
                        </>
                    );
                })() : (
                    <><span style={{ order: colPos[6] }}/><span style={{ order: colPos[7] }}/><span style={{ order: colPos[8] }}/><span style={{ order: colPos[9] }}/></>
                )}

                <span style={{ order: colPos[10] }} className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full whitespace-nowrap text-center ${status.cls}`}>{status.label}</span>

                {isAdmin ? (
                    <button style={{ order: colPos[11] }}
                        onClick={e => { e.stopPropagation(); if (window.confirm(`刪除「${group.name}」？`)) onDeleteGroup(group.id); }}
                        className="text-gray-200 hover:text-red-400 transition-colors text-center"
                    >✕</button>
                ) : <span style={{ order: colPos[11] }} />}
            </div>

            {/* 右鍵選單：單獨修改日期 */}
            {ctxMenu && (
                <div
                    ref={ctxRef}
                    style={{ position: 'fixed', left: ctxMenu.x, top: ctxMenu.y }}
                    className="z-50 bg-white border border-gray-200 rounded-xl shadow-lg py-1 min-w-[9rem]"
                >
                    <button
                        onClick={handleSoloEdit}
                        className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                    >單獨修改此日期</button>
                </div>
            )}

            {/* 右鍵選單：名稱欄 */}
            {nameCtxMenu && (
                <div
                    ref={nameCtxRef}
                    style={{ position: 'fixed', left: nameCtxMenu.x, top: nameCtxMenu.y }}
                    className="z-50 bg-white border border-gray-200 rounded-xl shadow-lg py-1 min-w-[9rem]"
                >
                    <button
                        onClick={() => { setNameCtxMenu(null); onOpenDetail(); }}
                        className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                    >詳細內容</button>
                    <button
                        onClick={() => { setNameCtxMenu(null); onAddSubItem(); }}
                        className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                    >新增子項目</button>
                </div>
            )}

        </>
    );
}

// ── 指定群組下拉選單 ──────────────────────────────────────────────
function BatchDropdown({ batches, onSelect, onClose }) {
    const [newName, setNewName] = useState('');
    const [creating, setCreating] = useState(false);
    const ref = useRef(null);

    useEffect(() => {
        const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) onClose(); };
        window.addEventListener('mousedown', handler);
        return () => window.removeEventListener('mousedown', handler);
    }, [onClose]);

    return (
        <div ref={ref} className="absolute top-full left-0 mt-1 w-52 bg-white border border-gray-200 rounded-xl shadow-lg z-10 py-1 overflow-hidden">
            {batches.map(tag => (
                <button key={tag} onClick={() => { onSelect(tag); onClose(); }}
                    className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
                >{tag}</button>
            ))}
            {batches.length > 0 && <div className="border-t border-gray-100 my-1" />}
            {creating ? (
                <div className="px-3 py-2 space-y-1.5">
                    <input
                        autoFocus
                        type="text"
                        placeholder="群組名稱"
                        value={newName}
                        onChange={e => setNewName(e.target.value)}
                        onKeyDown={e => {
                            if (e.key === 'Enter' && newName.trim()) { onSelect(newName.trim()); onClose(); }
                            if (e.key === 'Escape') setCreating(false);
                        }}
                        className="w-full text-sm px-2 py-1 border border-gray-200 rounded-lg outline-none focus:border-gray-400"
                    />
                    <div className="flex gap-1">
                        <button onClick={() => newName.trim() && (onSelect(newName.trim()), onClose())}
                            className="flex-1 text-xs py-1 bg-gray-900 text-white rounded-lg">確定</button>
                        <button onClick={() => setCreating(false)}
                            className="flex-1 text-xs py-1 text-gray-500 hover:bg-gray-100 rounded-lg">取消</button>
                    </div>
                </div>
            ) : (
                <button onClick={() => setCreating(true)}
                    className="w-full text-left px-3 py-2 text-sm text-indigo-600 hover:bg-indigo-50"
                >+ 新增群組</button>
            )}
        </div>
    );
}

// ── DetailModal ───────────────────────────────────────────────────
function DetailModal({ group, drawings, onClose, onUpdate }) {
    const sorted = [...drawings].sort((a, b) => b.rev.localeCompare(a.rev, undefined, { numeric: true }));
    const latest = sorted[0];
    const [note, setNote] = useState(latest?.note || '');

    const handleBackdrop = (e) => { if (e.target === e.currentTarget) onClose(); };

    const meta = [
        group.itemNo && `#${group.itemNo}`,
        group.code,
        group.type,
        group.batchTag && `批次：${group.batchTag}`,
    ].filter(Boolean).join('  ·  ');

    return (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4"
             onClick={handleBackdrop}>
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[80vh] flex flex-col overflow-hidden">
                {/* Header */}
                <div className="flex items-start justify-between p-5 border-b border-gray-100">
                    <div>
                        <h3 className="font-bold text-gray-900 text-base">{group.name}</h3>
                        {meta && <p className="text-xs text-gray-400 mt-0.5">{meta}</p>}
                    </div>
                    <button onClick={onClose} className="text-gray-300 hover:text-gray-600 text-xl leading-none ml-4">✕</button>
                </div>

                {/* 版次表格 */}
                <div className="overflow-auto flex-1 px-5 py-4">
                    {sorted.length === 0 ? (
                        <p className="text-xs text-gray-300 text-center py-8">尚無版次資料</p>
                    ) : (
                        <table className="w-full text-xs text-left border-collapse">
                            <thead>
                                <tr className="text-gray-400 border-b border-gray-100">
                                    <th className="pb-2 font-medium pr-4">版次</th>
                                    <th className="pb-2 font-medium pr-4">預計送審</th>
                                    <th className="pb-2 font-medium pr-4">送審日期</th>
                                    <th className="pb-2 font-medium pr-4">回簽日期</th>
                                    <th className="pb-2 font-medium pr-4">核准日期</th>
                                    <th className="pb-2 font-medium">狀態</th>
                                </tr>
                            </thead>
                            <tbody>
                                {sorted.map((dr, i) => {
                                    const s = getDrawingStatus(dr);
                                    return (
                                        <tr key={dr.id} className={`border-b border-gray-50 ${i === 0 ? 'bg-blue-50/60' : ''}`}>
                                            <td className="py-2 pr-4 font-mono text-gray-600">{dr.rev}</td>
                                            <td className="py-2 pr-4 text-gray-500">{dr.plannedSubmit || '—'}</td>
                                            <td className="py-2 pr-4 text-gray-500">{dr.submitDate || '—'}</td>
                                            <td className="py-2 pr-4 text-gray-500">{dr.reviewDate || '—'}</td>
                                            <td className="py-2 pr-4 text-gray-500">{dr.approveDate || '—'}</td>
                                            <td className="py-2">
                                                <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-medium ${s.cls}`}>{s.label}</span>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    )}
                </div>

                {/* 備註 */}
                {latest && (
                    <div className="px-5 pb-5 border-t border-gray-100 pt-4">
                        <label className="text-xs text-gray-400 block mb-1.5">備註（{latest.rev}）</label>
                        <textarea
                            className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 outline-none focus:border-gray-400 bg-gray-50 resize-none"
                            rows={3}
                            placeholder="輸入備註..."
                            value={note}
                            onChange={e => setNote(e.target.value)}
                            onBlur={() => onUpdate(latest.id, { note })}
                        />
                    </div>
                )}
            </div>
        </div>
    );
}

// ── DrawingPage ───────────────────────────────────────────────────
export function DrawingPage() {
    const { projects, groups, drawings, addGroup, updateGroup, deleteGroup, addDrawingRevision, updateDrawing, deleteDrawing, selectedProjectId } = useProject();
    const { user } = useAuth();
    const isAdmin = user?.role === 'admin';
    const allTypes = useAllItemTypes();

    const activeProjectId = selectedProjectId;
    const [addingGroup, setAddingGroup] = useState(false);
    const [newGroupName, setNewGroupName] = useState('');
    const [newGroupType, setNewGroupType] = useState(allTypes[0]);

    // 選取模式
    const [selectMode, setSelectMode] = useState(false);
    const [selectedIds, setSelectedIds] = useState(new Set());
    const [showBatchMenu, setShowBatchMenu] = useState(false);
    const [pendingBatchName, setPendingBatchName] = useState('');

    // 群組管理面板
    const [showPanel, setShowPanel] = useState(false);

    // 還原堆疊
    const [undoStack, setUndoStack] = useState([]);

    // 欄寬調整
    const [colWidths, setColWidths] = useState(() => {
        try {
            const s = localStorage.getItem('pw_col_widths_drawing');
            if (s) { const a = JSON.parse(s); if (a.length === DRAWING_DEFAULT_WIDTHS.length) return a; }
        } catch {}
        return DRAWING_DEFAULT_WIDTHS;
    });
    const [colOrder, setColOrder] = useState(() => {
        try {
            const s = localStorage.getItem('pw_col_order_drawing');
            if (s) { const a = JSON.parse(s); if (a.length === DRAWING_DEFAULT_WIDTHS.length && a[0] === 0 && a[a.length - 1] === a.length - 1) return a; }
        } catch {}
        return DRAWING_DEFAULT_WIDTHS.map((_, i) => i);
    });
    const colPos = Object.fromEntries(colOrder.map((origIdx, displayPos) => [origIdx, displayPos]));
    const [dragInfo, setDragInfo] = useState(null);
    const headerRef = useRef(null);
    const gridStyle = { display: 'grid', gridTemplateColumns: colOrder.map(i => colWidths[i] + 'px').join(' ') };
    const startResize = (colIdx, e) => {
        e.preventDefault();
        const startX = e.clientX;
        const startW = colWidths[colIdx];
        const onMove = (me) => {
            const newW = Math.max(32, startW + me.clientX - startX);
            setColWidths(prev => {
                const next = [...prev]; next[colIdx] = newW;
                try { localStorage.setItem('pw_col_widths_drawing', JSON.stringify(next)); } catch {}
                return next;
            });
        };
        const onUp = () => {
            document.removeEventListener('mousemove', onMove);
            document.removeEventListener('mouseup', onUp);
            document.body.style.cursor = '';
            document.body.style.userSelect = '';
        };
        document.body.style.cursor = 'col-resize';
        document.body.style.userSelect = 'none';
        document.addEventListener('mousemove', onMove);
        document.addEventListener('mouseup', onUp);
    };
    const startColDrag = (fromDisplayPos, e) => {
        e.preventDefault();
        e.stopPropagation();
        document.body.style.cursor = 'grabbing';
        document.body.style.userSelect = 'none';
        setDragInfo({ fromPos: fromDisplayPos, toPos: fromDisplayPos });
        const getDropPos = (mouseX) => {
            if (!headerRef.current) return fromDisplayPos;
            const { left } = headerRef.current.getBoundingClientRect();
            const x = mouseX - left;
            let cumW = 0;
            for (let i = 0; i < colOrder.length; i++) {
                const w = colWidths[colOrder[i]];
                if (x < cumW + w / 2) return Math.max(1, Math.min(colOrder.length - 2, i));
                cumW += w;
            }
            return colOrder.length - 2;
        };
        const onMove = (me) => setDragInfo(prev => prev ? { ...prev, toPos: getDropPos(me.clientX) } : null);
        const onUp = (me) => {
            document.removeEventListener('mousemove', onMove);
            document.removeEventListener('mouseup', onUp);
            document.body.style.cursor = '';
            document.body.style.userSelect = '';
            const toPos = getDropPos(me.clientX);
            setDragInfo(null);
            if (toPos !== fromDisplayPos) {
                setColOrder(prev => {
                    const next = [...prev];
                    const [moved] = next.splice(fromDisplayPos, 1);
                    next.splice(toPos, 0, moved);
                    try { localStorage.setItem('pw_col_order_drawing', JSON.stringify(next)); } catch {}
                    return next;
                });
            }
        };
        document.addEventListener('mousemove', onMove);
        document.addEventListener('mouseup', onUp);
    };

    // 詳細資訊 Modal
    const [detailGroupId, setDetailGroupId] = useState(null);

    // 子項目折疊
    const [collapsedGroups, setCollapsedGroups] = useState(new Set());
    const toggleCollapse = (id) => setCollapsedGroups(prev => {
        const next = new Set(prev);
        next.has(id) ? next.delete(id) : next.add(id);
        return next;
    });

    // 子項目新增
    const [addingSubItem, setAddingSubItem] = useState(null); // parentGroupId | null
    const [newSubName, setNewSubName] = useState('');
    const [newSubType, setNewSubType] = useState(SUB_ITEM_TYPES[0]);

    const activeGroups = groups.filter(g => g.projectId === activeProjectId);
    const batches = [...new Set(activeGroups.map(g => g.batchTag).filter(Boolean))];

    // 父子排序：頂層項目 → 各自的子項目
    const topLevelGroups = activeGroups.filter(g => !g.parentId);
    const childGroups = activeGroups.filter(g => !!g.parentId);
    const orderedGroups = [];
    for (const parent of topLevelGroups) {
        orderedGroups.push({ g: parent, depth: 0 });
        for (const child of childGroups.filter(c => c.parentId === parent.id)) {
            orderedGroups.push({ g: child, depth: 1 });
        }
    }

    const toggleSelect = (id) => {
        setSelectedIds(prev => {
            const next = new Set(prev);
            next.has(id) ? next.delete(id) : next.add(id);
            return next;
        });
    };

    const handleAssignBatch = async (tag) => {
        for (const id of selectedIds) await updateGroup(id, { batchTag: tag });
        setSelectedIds(new Set());
        setSelectMode(false);
        setShowBatchMenu(false);
        setPendingBatchName('');
    };

    const handleRemoveFromBatch = async (groupId) => {
        await updateGroup(groupId, { batchTag: '' });
    };

    const handleRemoveSelectedFromBatch = async () => {
        for (const id of selectedIds) await updateGroup(id, { batchTag: '' });
        setSelectedIds(new Set());
        setSelectMode(false);
    };

    const exitSelectMode = () => {
        setSelectMode(false);
        setSelectedIds(new Set());
        setShowBatchMenu(false);
        setPendingBatchName('');
    };

    const handleAddGroup = () => {
        if (!newGroupName.trim() || !activeProjectId) return;
        addGroup(activeProjectId, newGroupName.trim(), newGroupType);
        setNewGroupName('');
        setNewGroupType(allTypes[0]);
        setAddingGroup(false);
    };

    const handleAddSubItem = (parentGroupId) => {
        setAddingSubItem(parentGroupId);
        setNewSubName('');
        setNewSubType(SUB_ITEM_TYPES[0]);
    };

    const handleConfirmSubItem = () => {
        if (!newSubName.trim()) return;
        addGroup(activeProjectId, `${newSubName.trim()}-${newSubType}`, newSubType, { parentId: addingSubItem });
        setAddingSubItem(null);
        setNewSubName('');
    };

    // 更新日期：自動進版 + 同批次日期同步
    const handleUpdateDrawing = async (drId, fields) => {
        if (fields.submitDate) fields = { ...fields, plannedSubmit: '' };

        const dr = drawings.find(d => d.id === drId);
        if (!dr) return;
        const group = groups.find(g => g.id === dr.groupId);

        // 記錄還原快照
        const undoUpdates = [];
        const prevFields = {};
        for (const key of Object.keys(fields)) prevFields[key] = dr[key] ?? '';
        undoUpdates.push({ drId, prevFields });

        updateDrawing(drId, fields);
        const newRevIds = [];

        // 自動進版
        if (fields.reviewDate && !dr.approveDate) {
            const grpDrawings = drawings.filter(d => d.groupId === dr.groupId);
            const latest = grpDrawings.sort((a, b) => b.rev.localeCompare(a.rev, undefined, { numeric: true }))[0];
            if (latest?.id === drId) {
                const newId = await addDrawingRevision(dr.groupId, dr.rev);
                if (newId) newRevIds.push(newId);
            }
        }

        // 同批次日期同步
        if (group?.batchTag) {
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
                if (sgLatest && !sgLatest.approveDate) {
                    const sgPrev = {};
                    for (const key of Object.keys(fields)) sgPrev[key] = sgLatest[key] ?? '';
                    undoUpdates.push({ drId: sgLatest.id, prevFields: sgPrev });
                    updateDrawing(sgLatest.id, fields);
                    if (fields.reviewDate) {
                        const newId = await addDrawingRevision(sg.id, sgLatest.rev);
                        if (newId) newRevIds.push(newId);
                    }
                }
            }
        }

        setUndoStack(prev => [...prev.slice(-9), { updates: undoUpdates, newRevIds }]);
    };

    // 單獨修改：跳過批次同步，但保留自動進版
    const handleUpdateDrawingSolo = async (drId, fields) => {
        if (fields.submitDate) fields = { ...fields, plannedSubmit: '' };

        const dr = drawings.find(d => d.id === drId);
        const prevFields = {};
        for (const key of Object.keys(fields)) prevFields[key] = dr ? (dr[key] ?? '') : '';

        updateDrawing(drId, fields);
        const newRevIds = [];

        if (fields.reviewDate && dr && !dr.approveDate) {
            const grpDrawings = drawings.filter(d => d.groupId === dr.groupId);
            const latest = grpDrawings.sort((a, b) => b.rev.localeCompare(a.rev, undefined, { numeric: true }))[0];
            if (latest?.id === drId) {
                const newId = await addDrawingRevision(dr.groupId, dr.rev);
                if (newId) newRevIds.push(newId);
            }
        }

        setUndoStack(prev => [...prev.slice(-9), { updates: [{ drId, prevFields }], newRevIds }]);
    };

    const handleUndo = () => {
        if (undoStack.length === 0) return;
        const entry = undoStack[undoStack.length - 1];
        setUndoStack(prev => prev.slice(0, -1));
        for (const { drId, prevFields } of entry.updates) {
            updateDrawing(drId, prevFields);
        }
        for (const revId of entry.newRevIds) {
            deleteDrawing(revId);
        }
    };

    const handleExport = () => {
        const project = projects.find(p => p.id === activeProjectId);
        const projGroups = groups
            .filter(g => g.projectId === activeProjectId)
            .sort((a, b) => Number(a.itemNo || 999) - Number(b.itemNo || 999));
        const rows = [];
        for (const g of projGroups) {
            const gDrawings = drawings
                .filter(d => d.groupId === g.id)
                .sort((a, b) => a.rev.localeCompare(b.rev, undefined, { numeric: true }));
            for (const d of gDrawings) {
                rows.push({
                    '項次': g.itemNo || '', '工料編號': g.code || '', '項目名稱': g.name,
                    '品項類型': g.type || '', '批次': g.batchTag || '', '版次': d.rev,
                    '預計送審': d.plannedSubmit || '', '送審日期': d.submitDate || '',
                    '回簽日期': d.reviewDate || '', '核准日期': d.approveDate || '',
                    '狀態': getDrawingStatus(d).label,
                });
            }
        }
        const ws = XLSX.utils.json_to_sheet(rows);
        ws['!cols'] = [6, 12, 36, 12, 10, 6, 12, 12, 12, 12, 8].map(wch => ({ wch }));
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, '繪圖');
        XLSX.writeFile(wb, `繪圖_${project?.name || ''}_${new Date().toISOString().slice(0, 10)}.xlsx`);
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
            <div className="max-w-7xl mx-auto p-4 md:p-6 space-y-4">
                {/* 標題列 */}
                <div className="flex items-center justify-between gap-2 flex-wrap">
                    <h2 className="text-lg font-bold text-gray-900">繪圖</h2>
                    {activeProjectId && (
                        <div className="flex gap-2 flex-wrap">
                            {/* 選取模式下的操作列 */}
                            {selectMode ? (
                                <>
                                    {pendingBatchName ? (
                                        // 從面板新增群組後，直接顯示確認按鈕
                                        <button
                                            onClick={() => handleAssignBatch(pendingBatchName)}
                                            disabled={selectedIds.size === 0}
                                            className="px-4 py-2 bg-indigo-600 text-white text-sm rounded-xl font-medium hover:bg-indigo-700 disabled:opacity-40"
                                        >確認指定到「{pendingBatchName}」</button>
                                    ) : (
                                        <div className="relative">
                                            <button
                                                onClick={() => setShowBatchMenu(v => !v)}
                                                disabled={selectedIds.size === 0}
                                                className="px-4 py-2 bg-indigo-600 text-white text-sm rounded-xl font-medium hover:bg-indigo-700 disabled:opacity-40 flex items-center gap-1"
                                            >指定群組 <span className="text-xs">▾</span></button>
                                            {showBatchMenu && (
                                                <BatchDropdown
                                                    batches={batches}
                                                    onSelect={handleAssignBatch}
                                                    onClose={() => setShowBatchMenu(false)}
                                                />
                                            )}
                                        </div>
                                    )}
                                    <button
                                        onClick={handleRemoveSelectedFromBatch}
                                        disabled={selectedIds.size === 0}
                                        className="px-4 py-2 text-sm rounded-xl font-medium border bg-white text-gray-700 border-gray-200 hover:bg-gray-50 disabled:opacity-40"
                                    >移除群組</button>
                                    <span className="px-3 py-2 text-sm text-gray-500">已選 {selectedIds.size} 項</span>
                                    <button onClick={exitSelectMode} className="px-4 py-2 text-sm text-gray-500 hover:bg-gray-100 rounded-xl">取消</button>
                                </>
                            ) : (
                                <>
                                    <button
                                        onClick={handleUndo}
                                        disabled={undoStack.length === 0}
                                        title="還原上一步"
                                        className="px-4 py-2 text-sm rounded-xl font-medium border bg-white text-gray-700 border-gray-200 hover:bg-gray-50 disabled:opacity-30"
                                    >↩ 還原</button>
                                    <button onClick={handleExport} className="px-4 py-2 text-sm rounded-xl font-medium border bg-white text-gray-700 border-gray-200 hover:bg-gray-50">匯出 Excel</button>
                                    <button
                                        onClick={() => { setSelectMode(true); setShowPanel(false); }}
                                        className="px-4 py-2 text-sm rounded-xl font-medium border bg-white text-gray-700 border-gray-200 hover:bg-gray-50"
                                    >選取</button>
                                    <button
                                        onClick={() => { setShowPanel(v => !v); setSelectMode(false); }}
                                        className={`px-4 py-2 text-sm rounded-xl font-medium border transition-colors ${showPanel ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'}`}
                                    >群組管理{batches.length > 0 ? ` (${batches.length})` : ''}</button>
                                    <button
                                        onClick={() => setAddingGroup(true)}
                                        className="px-4 py-2 bg-gray-900 text-white text-sm rounded-xl font-medium hover:bg-gray-700"
                                    >+ 新增項目</button>
                                </>
                            )}
                        </div>
                    )}
                </div>

                {/* 新增項目表單 */}
                {addingGroup && (
                    <div className="bg-white rounded-2xl border border-gray-200 p-4 shadow-sm space-y-3">
                        <p className="text-sm font-semibold text-gray-700">新增項目</p>
                        <input autoFocus type="text" placeholder="項目名稱"
                            value={newGroupName} onChange={e => setNewGroupName(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && handleAddGroup()}
                            className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg outline-none focus:border-gray-400 bg-gray-50"
                        />
                        <div>
                            <label className="text-xs text-gray-400 mb-1 block">品項類型</label>
                            <select value={newGroupType} onChange={e => setNewGroupType(e.target.value)}
                                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg outline-none focus:border-gray-400 bg-gray-50"
                            >{allTypes.map(t => <option key={t} value={t}>{t}</option>)}</select>
                        </div>
                        <div className="flex gap-2">
                            <button onClick={handleAddGroup} className="px-4 py-1.5 bg-gray-900 text-white text-sm rounded-lg">新增</button>
                            <button onClick={() => { setAddingGroup(false); setNewGroupName(''); }} className="px-4 py-1.5 text-sm text-gray-500 hover:bg-gray-100 rounded-lg">取消</button>
                        </div>
                    </div>
                )}

                {/* 表格 */}
                {activeGroups.length === 0 && !addingGroup ? (
                    <div className="text-center py-16 text-gray-300">
                        <p className="text-4xl mb-2">📋</p>
                        <p className="text-gray-400 text-sm">此工地尚無項目，點「+ 新增項目」開始</p>
                    </div>
                ) : (
                    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-x-auto">
                        {/* 表頭 */}
                        <div ref={headerRef}
                             className="gap-x-1 px-2 py-2 bg-gray-50 border-b border-gray-200 text-[10px] text-gray-400 font-medium sticky top-0 border-l-4 border-transparent"
                             style={gridStyle}>
                            {colOrder.map((origIdx, displayPos) => {
                                if (displayPos === 0 || displayPos === colOrder.length - 1) return <span key={origIdx} />;
                                const label = DRAWING_COL_LABELS[origIdx];
                                const isDragging = dragInfo?.fromPos === displayPos;
                                const isTarget = dragInfo && dragInfo.toPos === displayPos && !isDragging;
                                const centered = origIdx === 5 || origIdx === 10;
                                return (
                                    <div key={origIdx}
                                         className={`relative flex items-center overflow-visible select-none transition-colors ${isDragging ? 'opacity-30' : ''} ${isTarget ? 'bg-blue-50' : ''}`}
                                         onMouseDown={e => { if (e.ctrlKey) startColDrag(displayPos, e); }}
                                         title="Ctrl+拖曳調整欄位順序">
                                        <span className={centered ? 'w-full text-center' : ''}>{label}</span>
                                        <div onMouseDown={e => { e.stopPropagation(); if (!e.ctrlKey) startResize(origIdx, e); }}
                                             className="absolute right-0 top-0 h-full w-1 cursor-col-resize bg-gray-200/60 hover:bg-blue-400/60 transition-colors z-10" />
                                    </div>
                                );
                            })}
                        </div>

                        {/* 資料列 */}
                        {orderedGroups.map(({ g, depth }) => {
                            if (depth > 0 && collapsedGroups.has(g.parentId)) return null;
                            const hasChildren = depth === 0 && childGroups.some(c => c.parentId === g.id);
                            return (
                            <Fragment key={g.id}>
                                <GroupRow
                                    group={g}
                                    depth={depth}
                                    hasChildren={hasChildren}
                                    isCollapsed={collapsedGroups.has(g.id)}
                                    onToggleCollapse={() => toggleCollapse(g.id)}
                                    allDr={drawings.filter(d => d.groupId === g.id)}
                                    onUpdate={handleUpdateDrawing}
                                    onUpdateSolo={handleUpdateDrawingSolo}
                                    onDeleteGroup={deleteGroup}
                                    onUpdateGroup={updateGroup}
                                    isAdmin={isAdmin}
                                    selectMode={selectMode}
                                    selected={selectedIds.has(g.id)}
                                    onToggleSelect={() => toggleSelect(g.id)}
                                    onOpenDetail={() => setDetailGroupId(g.id)}
                                    onAddSubItem={() => handleAddSubItem(g.id)}
                                    gridStyle={gridStyle}
                                    colPos={colPos}
                                />
                                {addingSubItem === g.id && (
                                    <div className="gap-x-1 items-center px-2 py-1.5 bg-blue-50 border-b border-blue-100 border-l-4 border-l-blue-300" style={gridStyle}>
                                        <span style={{ order: colPos[0] }} />
                                        <span style={{ order: colPos[1] }} />
                                        <span style={{ order: colPos[2] }} />
                                        <input style={{ order: colPos[3] }}
                                            autoFocus type="text" placeholder="子項目名稱"
                                            value={newSubName} onChange={e => setNewSubName(e.target.value)}
                                            onKeyDown={e => { if (e.key === 'Enter') handleConfirmSubItem(); if (e.key === 'Escape') setAddingSubItem(null); }}
                                            className="text-xs px-2 py-1 border border-blue-300 rounded outline-none bg-white w-full"
                                        />
                                        <select style={{ order: colPos[4] }} value={newSubType} onChange={e => setNewSubType(e.target.value)}
                                            className="text-xs px-1 py-1 border border-gray-200 rounded outline-none bg-white w-full">
                                            {SUB_ITEM_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                                        </select>
                                        <span style={{ order: colPos[5] }} />
                                        <span style={{ order: colPos[6] }} />
                                        <span style={{ order: colPos[7] }} />
                                        <span style={{ order: colPos[8] }} />
                                        <span style={{ order: colPos[9] }} />
                                        <div style={{ order: colPos[10] }} className="flex gap-1">
                                            <button onClick={handleConfirmSubItem} className="text-xs px-2 py-0.5 bg-blue-600 text-white rounded">新增</button>
                                            <button onClick={() => setAddingSubItem(null)} className="text-xs px-2 py-0.5 text-gray-500 hover:bg-gray-100 rounded">取消</button>
                                        </div>
                                        <span style={{ order: colPos[11] }} />
                                    </div>
                                )}
                            </Fragment>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* 詳細資訊 Modal */}
            {detailGroupId && (() => {
                const dg = groups.find(g => g.id === detailGroupId);
                if (!dg) return null;
                return (
                    <DetailModal
                        group={dg}
                        drawings={drawings.filter(d => d.groupId === detailGroupId)}
                        onClose={() => setDetailGroupId(null)}
                        onUpdate={updateDrawing}
                    />
                );
            })()}

            {/* 側邊群組管理面板 */}
            <GroupManagementPanel
                open={showPanel}
                onClose={() => setShowPanel(false)}
                batches={batches}
                activeGroups={activeGroups}
                drawings={drawings}
                onRemoveFromBatch={handleRemoveFromBatch}
                onCreateBatch={(name) => {
                    setShowPanel(false);
                    setSelectMode(true);
                    setPendingBatchName(name);
                }}
            />
        </div>
    );
}
