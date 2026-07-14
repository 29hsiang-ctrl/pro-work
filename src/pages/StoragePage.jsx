import { useState, useEffect, useRef, useCallback } from 'react';
import { compressImage } from '../utils/helpers';
import * as driveSync from '../utils/driveSync';

function uid() { return Math.random().toString(36).slice(2, 10); }

function parseRocDate(d = '') {
    const [y, m, day] = d.split('.');
    return { year: parseInt(y, 10) + 1911, monthDay: `${m}/${day}` };
}

// ── 拖曳調整寬度 ─────────────────────────────────────
function useDragResize(defaultWidth, min = 160, max = 520) {
    const [width, setWidth] = useState(defaultWidth);
    const dragging = useRef(false);
    const startX = useRef(0);
    const startW = useRef(0);
    const onMouseDown = useCallback((e) => {
        e.preventDefault();
        dragging.current = true;
        startX.current = e.clientX;
        startW.current = width;
        document.body.style.cursor = 'col-resize';
        document.body.style.userSelect = 'none';
        const onMove = (ev) => {
            if (!dragging.current) return;
            setWidth(Math.min(max, Math.max(min, startW.current + ev.clientX - startX.current)));
        };
        const onUp = () => {
            dragging.current = false;
            document.body.style.cursor = '';
            document.body.style.userSelect = '';
            document.removeEventListener('mousemove', onMove);
            document.removeEventListener('mouseup', onUp);
        };
        document.addEventListener('mousemove', onMove);
        document.addEventListener('mouseup', onUp);
    }, [width, min, max]);
    return [width, onMouseDown];
}

// ── 右鍵選單元件 ─────────────────────────────────────
function ContextMenu({ menu, onClose, onAction }) {
    const ref = useRef(null);
    useEffect(() => {
        const close = (e) => { if (ref.current && !ref.current.contains(e.target)) onClose(); };
        const esc = (e) => { if (e.key === 'Escape') onClose(); };
        document.addEventListener('mousedown', close);
        document.addEventListener('keydown', esc);
        return () => { document.removeEventListener('mousedown', close); document.removeEventListener('keydown', esc); };
    }, [onClose]);

    if (!menu) return null;
    return (
        <div
            ref={ref}
            className="fixed z-50 bg-white border border-gray-200 rounded-xl shadow-lg py-1 min-w-36 text-sm"
            style={{ left: menu.x, top: menu.y }}
        >
            {menu.items.map((item, i) =>
                item === '---'
                    ? <div key={i} className="my-1 border-t border-gray-100" />
                    : (
                        <button
                            key={i}
                            disabled={item.disabled}
                            onClick={() => { if (!item.disabled) { onAction(item.action, menu.target); onClose(); } }}
                            className={`w-full text-left px-4 py-2 transition-colors
                                ${item.disabled ? 'text-gray-300 cursor-default' : item.danger ? 'text-red-500 hover:bg-gray-50' : 'text-gray-700 hover:bg-gray-50'}`}
                        >{item.label}</button>
                    )
            )}
        </div>
    );
}

// ── 移至資料夾 Picker ────────────────────────────────
function MovePicker({ folders, onMove, onClose }) {
    const ref = useRef(null);
    useEffect(() => {
        const close = (e) => { if (ref.current && !ref.current.contains(e.target)) onClose(); };
        document.addEventListener('mousedown', close);
        return () => document.removeEventListener('mousedown', close);
    }, [onClose]);
    return (
        <div ref={ref} className="fixed z-50 bg-white border border-gray-200 rounded-xl shadow-lg py-1 min-w-40 text-sm max-h-64 overflow-y-auto"
            style={{ left: '50%', top: '50%', transform: 'translate(-50%,-50%)' }}>
            <p className="px-4 py-2 text-xs text-gray-400 font-semibold border-b border-gray-100">移至資料夾</p>
            <button onClick={() => onMove(null)} className="w-full text-left px-4 py-2 hover:bg-gray-50 text-gray-500">
                未分類（根目錄）
            </button>
            {folders.map(f => (
                <button key={f.id} onClick={() => onMove(f.id)} className="w-full text-left px-4 py-2 hover:bg-gray-50 text-gray-700">
                    📁 {f.name}
                </button>
            ))}
        </div>
    );
}

// ── 筆記列項目 ───────────────────────────────────────
function NoteRow({ item, selected, draggingId, onSelect, onDragStart, onDragEnd, onCtx, fmt }) {
    return (
        <div
            draggable
            onDragStart={e => { e.dataTransfer.setData('noteId', item.id); e.dataTransfer.effectAllowed = 'move'; onDragStart(); }}
            onDragEnd={onDragEnd}
            onContextMenu={onCtx}
            onClick={onSelect}
            className={`px-3 py-2.5 cursor-grab active:cursor-grabbing transition-colors border-b border-gray-50
                ${draggingId === item.id ? 'opacity-40' : ''}
                ${selected ? 'bg-blue-50 border-l-2 border-blue-500' : 'hover:bg-gray-50'}`}
        >
            <p className="text-sm font-medium text-gray-800 truncate">{item.title || '未命名'}</p>
            <p className="text-xs text-gray-300 mt-0.5">{fmt(item.updatedAt || item.createdAt)}</p>
        </div>
    );
}

// ── 主元件 ───────────────────────────────────────────
export function StoragePage() {
    const [items, setItems]           = useState([]);
    const [folders, setFolders]       = useState([]);
    const [loading, setLoading]       = useState(true);
    const [selectedItem, setSelectedItem] = useState(null);
    const [editMode, setEditMode]     = useState(false);
    const [editTitle, setEditTitle]   = useState('');
    const [editCategory, setEditCategory] = useState('');
    const [saving, setSaving]         = useState(false);
    const [importing, setImporting]   = useState(false);

    const [showAddForm, setShowAddForm] = useState(false);
    const [addTitle, setAddTitle]     = useState('');
    const [addCategory, setAddCategory] = useState('');
    const [addContent, setAddContent] = useState('');

    // 展開的資料夾 ids
    const [expandedFIds, setExpandedFIds] = useState(new Set());
    // 照片資料夾
    const [photoEntries, setPhotoEntries]           = useState([]);
    const [projectMap, setProjectMap]               = useState({});
    const [photoOpen, setPhotoOpen]                 = useState(false);
    const [expandedPhotoProj, setExpandedPhotoProj] = useState(new Set());
    const [selectedPhotoKey, setSelectedPhotoKey]   = useState(null); // "{projectId}|{date}"
    const [lightboxImg, setLightboxImg]             = useState(null);
    // 右鍵選單
    const [ctxMenu, setCtxMenu]       = useState(null);
    // 重新命名資料夾
    const [renamingId, setRenamingId] = useState(null);
    const [renameVal, setRenameVal]   = useState('');
    // 新增資料夾 inline 輸入
    const [creatingFolder, setCreatingFolder] = useState(false);
    const [newFolderVal, setNewFolderVal]     = useState('');
    // 移至資料夾 picker
    const [movePicker, setMovePicker] = useState(null); // item id
    // 拖曳
    const [draggingId, setDraggingId]   = useState(null);
    const [dragOverFId, setDragOverFId] = useState(undefined); // undefined=無, null=根目錄, id=資料夾

    const toggleExpand = (fid) => setExpandedFIds(prev => {
        const next = new Set(prev);
        next.has(fid) ? next.delete(fid) : next.add(fid);
        return next;
    });
    const togglePhotoProj = (pid) => setExpandedPhotoProj(prev => {
        const next = new Set(prev);
        next.has(pid) ? next.delete(pid) : next.add(pid);
        return next;
    });

    const [leftWidth, onDragLeft]     = useDragResize(260, 160, 520);

    const [windowWidth, setWindowWidth] = useState(() => window.innerWidth);
    useEffect(() => {
        const h = () => setWindowWidth(window.innerWidth);
        window.addEventListener('resize', h);
        return () => window.removeEventListener('resize', h);
    }, []);
    const isMobile = windowWidth < 768;
    const mobileRightActive = !!(selectedItem || showAddForm || selectedPhotoKey);

    const editorRef        = useRef(null);
    const addEditorRef     = useRef(null);
    const fileInputRef     = useRef(null);
    const editImgRef       = useRef(null);
    const addImgRef        = useRef(null);
    const renameInputRef   = useRef(null);
    const newFolderRef     = useRef(null);

    // ── 資料載入 ──────────────────────────────────
    useEffect(() => {
        Promise.all([
            fetch('/api/storage').then(r => r.ok ? r.json() : []),
            fetch('/api/storageFolders').then(r => r.ok ? r.json() : []),
            fetch('/api/calendarPhotos').then(r => r.ok ? r.json() : []),
            fetch('/api/init').then(r => r.ok ? r.json() : {}),
        ]).then(([its, fds, photos, initData]) => {
            setItems(its);
            setFolders(fds);
            setPhotoEntries(photos);
            const pmap = {};
            (initData.projects || []).forEach(p => { pmap[p.id] = p.name; });
            setProjectMap(pmap);
        }).finally(() => setLoading(false));
    }, []);

    useEffect(() => { if (renamingId && renameInputRef.current) renameInputRef.current.focus(); }, [renamingId]);
    useEffect(() => { if (creatingFolder && newFolderRef.current) newFolderRef.current.focus(); }, [creatingFolder]);

    const rootItems   = items.filter(i => !i.folderId);
    const countIn = (fid) => items.filter(i => i.folderId === fid).length;

    // ── Word / 照片匯入 ───────────────────────────
    const handleImportFile = async (e) => {
        const files = Array.from(e.target.files);
        if (!files.length) return;
        setImporting(true);
        try {
            let content = '', title = '未命名';
            for (const file of files) {
                if (file.name.endsWith('.docx')) {
                    const mammoth = await import('mammoth');
                    const result = await mammoth.convertToHtml({ arrayBuffer: await file.arrayBuffer() });
                    content += result.value;
                    title = file.name.replace(/\.docx$/i, '');
                } else if (file.type.startsWith('image/')) {
                    const b64 = await compressImage(file, 1200, 0.8);
                    content += `<p><img src="${b64}" style="max-width:100%;border-radius:4px;" /></p>`;
                }
            }
            setAddTitle(title);
            setAddContent(content);
            setShowAddForm(true);
            setSelectedItem(null);
            setEditMode(false);
            setTimeout(() => { if (addEditorRef.current) addEditorRef.current.innerHTML = content; }, 0);
        } catch (err) { alert('匯入失敗：' + err.message); }
        finally { setImporting(false); e.target.value = ''; }
    };

    // ── 插入照片 ──────────────────────────────────
    const insertImage = async (e, el) => {
        const file = e.target.files[0];
        if (!file || !el) return;
        const b64 = await compressImage(file, 1200, 0.8);
        el.focus();
        const sel = window.getSelection();
        if (sel?.rangeCount > 0) {
            const range = sel.getRangeAt(0);
            range.collapse(false);
            const img = document.createElement('img');
            img.src = b64;
            img.style.cssText = 'max-width:100%;border-radius:4px;display:block;margin:4px 0';
            range.insertNode(img);
            range.setStartAfter(img);
            sel.removeAllRanges(); sel.addRange(range);
        } else {
            el.innerHTML += `<p><img src="${b64}" style="max-width:100%;border-radius:4px;" /></p>`;
        }
        e.target.value = '';
    };

    // ── 新增筆記 ──────────────────────────────────
    const handleAdd = async () => {
        const content = addEditorRef.current?.innerHTML ?? addContent;
        if (!addTitle.trim()) return;
        setSaving(true);
        const item = { id: uid(), title: addTitle.trim(), category: addCategory.trim(), content, folderId: null };
        const res = await fetch('/api/storage', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(item) });
        if (res.ok) {
            const created = await res.json();
            setItems(prev => [created, ...prev]);
            setSelectedItem(created);
            if (driveSync.isAutoSyncEnabled()) driveSync.syncNote(created).catch(() => {});
        }
        setShowAddForm(false);
        setAddTitle(''); setAddCategory(''); setAddContent('');
        if (addEditorRef.current) addEditorRef.current.innerHTML = '';
        setSaving(false);
    };

    // ── 儲存編輯 ──────────────────────────────────
    const handleSave = async () => {
        if (!selectedItem) return;
        const content = editorRef.current?.innerHTML ?? selectedItem.content;
        setSaving(true);
        const res = await fetch('/api/storage', {
            method: 'PUT', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: selectedItem.id, title: editTitle, category: editCategory, content }),
        });
        if (res.ok) {
            const { updatedAt } = await res.json();
            const updated = { ...selectedItem, title: editTitle, category: editCategory, content, updatedAt };
            setItems(prev => prev.map(i => i.id === selectedItem.id ? updated : i));
            setSelectedItem(updated);
            if (driveSync.isAutoSyncEnabled()) driveSync.syncNote(updated).catch(() => {});
        }
        setEditMode(false); setSaving(false);
    };

    // ── 刪除筆記 ──────────────────────────────────
    const handleDeleteItem = async (id) => {
        if (!window.confirm('確認刪除此筆記？')) return;
        await fetch(`/api/storage?id=${id}`, { method: 'DELETE' });
        setItems(prev => prev.filter(i => i.id !== id));
        if (selectedItem?.id === id) setSelectedItem(null);
    };

    // ── 移至資料夾 ────────────────────────────────
    const handleMove = async (itemId, folderId) => {
        setMovePicker(null);
        await fetch('/api/storage', {
            method: 'PUT', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: itemId, folderId }),
        });
        setItems(prev => prev.map(i => i.id === itemId ? { ...i, folderId } : i));
        if (selectedItem?.id === itemId) setSelectedItem(p => ({ ...p, folderId }));
    };

    // ── 資料夾 CRUD ───────────────────────────────
    const createFolder = () => { setCreatingFolder(true); setNewFolderVal(''); };

    const commitCreateFolder = async () => {
        const name = newFolderVal.trim();
        setCreatingFolder(false);
        if (!name) return;
        const res = await fetch('/api/storageFolders', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name }) });
        if (res.ok) { const f = await res.json(); setFolders(prev => [...prev, f].sort((a, b) => a.name.localeCompare(b.name))); }
    };

    const startRename = (folder) => { setRenamingId(folder.id); setRenameVal(folder.name); };
    const commitRename = async () => {
        if (!renameVal.trim() || !renamingId) { setRenamingId(null); return; }
        await fetch('/api/storageFolders', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: renamingId, name: renameVal.trim() }) });
        setFolders(prev => prev.map(f => f.id === renamingId ? { ...f, name: renameVal.trim() } : f).sort((a, b) => a.name.localeCompare(b.name)));
        setRenamingId(null);
    };

    const deleteFolder = async (id) => {
        if (!window.confirm('確認刪除此資料夾？資料夾內的筆記將移至未分類。')) return;
        await fetch(`/api/storageFolders?id=${id}`, { method: 'DELETE' });
        setFolders(prev => prev.filter(f => f.id !== id));
        setItems(prev => prev.map(i => i.folderId === id ? { ...i, folderId: null } : i));
        if (expandedFIds.has(id)) setExpandedFIds(prev => { const n = new Set(prev); n.delete(id); return n; });
    };

    // ── 複製筆記 ──────────────────────────────────
    const handleDuplicate = async (item) => {
        if (!item) return;
        const copy = { id: uid(), title: item.title + '（副本）', category: item.category || '', content: item.content || '', folderId: item.folderId || null };
        const res = await fetch('/api/storage', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(copy) });
        if (res.ok) { const created = await res.json(); setItems(prev => [created, ...prev]); setSelectedItem(created); setSelectedPhotoKey(null); }
    };

    // ── 右鍵選單 ──────────────────────────────────
    const openCtx = (e, type, target) => {
        e.preventDefault();
        e.stopPropagation();
        const items_map = {
            panel:  [{ label: '📁 新增資料夾', action: 'createFolder' }],
            folder: [{ label: '✏️ 重新命名', action: 'renameFolder' }, '---', { label: '🗑️ 刪除資料夾', action: 'deleteFolder', danger: true }],
            note:   [{ label: '📂 移至資料夾…', action: 'moveNote' }, '---', { label: '🗑️ 刪除', action: 'deleteNote', danger: true }],
        };
        setCtxMenu({ x: e.clientX, y: e.clientY, type, target, items: items_map[type] });
    };

    // ── 複製照片到剪貼簿 ─────────────────────────
    const copyPhoto = async (src) => {
        try {
            const res = await fetch(src);
            const blob = await res.blob();
            await navigator.clipboard.write([new ClipboardItem({ [blob.type]: blob })]);
        } catch { alert('複製失敗，請確認瀏覽器已允許剪貼簿權限'); }
    };

    // ── 刪除單張照片（從 calendarEntry 移除）────
    const handleDeletePhoto = async (entryId, imageIdx) => {
        if (!window.confirm('確認刪除此照片？')) return;
        const res = await fetch(`/api/calendarPhotos?entryId=${entryId}&imageIdx=${imageIdx}`, { method: 'DELETE' });
        if (!res.ok) return;
        const { remaining } = await res.json();
        setPhotoEntries(prev => {
            const updated = prev.map(e => {
                if (e.id !== entryId) return e;
                return { ...e, images: e.images.filter((_, i) => i !== imageIdx) };
            });
            return remaining === 0 ? updated.filter(e => e.id !== entryId) : updated;
        });
    };

    const openRightCtx = (e) => {
        e.preventDefault();
        const hasNote = !!selectedItem;
        setCtxMenu({
            x: e.clientX, y: e.clientY, type: 'right', target: selectedItem,
            items: [
                { label: '新增', action: 'addNew' },
                { label: '複製', action: 'duplicate', disabled: !hasNote },
                '---',
                { label: '刪除', action: 'deleteNote', danger: true, disabled: !hasNote },
            ],
        });
    };

    const openPhotoCtx = (e, entryId, imageIdx, preview) => {
        e.preventDefault();
        e.stopPropagation();
        setCtxMenu({
            x: e.clientX, y: e.clientY, type: 'photo',
            target: { entryId, imageIdx, preview },
            items: [
                { label: '複製', action: 'copyPhoto' },
                '---',
                { label: '刪除', action: 'deletePhoto', danger: true },
            ],
        });
    };

    const handleCtxAction = (action, target) => {
        if (action === 'createFolder') createFolder();
        if (action === 'renameFolder') startRename(target);
        if (action === 'deleteFolder') deleteFolder(target.id);
        if (action === 'moveNote')     setMovePicker(target.id);
        if (action === 'deleteNote')   handleDeleteItem(target?.id);
        if (action === 'duplicate')    handleDuplicate(target);
        if (action === 'copyPhoto')    copyPhoto(target.preview);
        if (action === 'deletePhoto')  handleDeletePhoto(target.entryId, target.imageIdx);
        if (action === 'addNew')       { setAddTitle(''); setAddCategory(''); setAddContent(''); setShowAddForm(true); setSelectedItem(null); setEditMode(false); setSelectedPhotoKey(null); setTimeout(() => { if (addEditorRef.current) addEditorRef.current.innerHTML = ''; }, 0); }
    };

    const startEdit = () => {
        setEditTitle(selectedItem.title);
        setEditCategory(selectedItem.category || '');
        setEditMode(true);
        setTimeout(() => { if (editorRef.current) editorRef.current.innerHTML = selectedItem.content || ''; }, 0);
    };

    const fmt = (iso) => iso ? new Date(iso).toLocaleDateString('zh-TW', { year: 'numeric', month: '2-digit', day: '2-digit' }) : '';

    if (loading) return <div className="flex items-center justify-center min-h-[70vh] text-sm text-gray-400 font-sans">載入中...</div>;

    return (
        <div className="h-[calc(100vh-49px)] font-sans overflow-hidden flex select-none">

            {/* ── 左側面板 ─────────────────────────── */}
            <div
                className={`flex-col border-r border-gray-100 bg-white ${isMobile ? (mobileRightActive ? 'hidden' : 'flex w-full') : 'flex flex-shrink-0'}`}
                style={isMobile ? undefined : { width: leftWidth }}
                onContextMenu={e => { e.preventDefault(); openCtx(e, 'panel', null); }}
            >
                {/* 操作按鈕 */}
                <div className="p-3 border-b border-gray-100 space-y-2">
                    <button
                        onClick={() => { setAddTitle(''); setAddCategory(''); setAddContent(''); setShowAddForm(true); setSelectedItem(null); setEditMode(false); setSelectedPhotoKey(null); setTimeout(() => { if (addEditorRef.current) addEditorRef.current.innerHTML = ''; }, 0); }}
                        className="w-full px-3 py-2 bg-gray-900 text-white text-xs font-semibold rounded-xl hover:bg-gray-700 transition-colors"
                    >+ 新增筆記</button>
                    <button
                        onClick={() => fileInputRef.current?.click()}
                        disabled={importing}
                        className="w-full px-3 py-2 border border-gray-200 text-gray-600 text-xs rounded-xl hover:bg-gray-50 transition-colors disabled:opacity-60"
                    >{importing ? '匯入中...' : '匯入 Word / 照片'}</button>
                    <input ref={fileInputRef} type="file" accept=".docx,image/*" multiple className="hidden" onChange={handleImportFile} />
                </div>

                {/* 資料夾樹 */}
                <div className="flex-1 overflow-y-auto">
                    {/* ── 照片資料夾（固定頂層）── */}
                    {(() => {
                        const projectIds = [...new Set(photoEntries.map(e => e.projectId).filter(Boolean))];
                        const totalPhotos = photoEntries.reduce((s, e) => s + e.images.length, 0);
                        return (
                            <div>
                                <div
                                    onClick={() => setPhotoOpen(p => !p)}
                                    className="flex items-center justify-between px-3 py-2.5 cursor-pointer hover:bg-gray-50 text-gray-600 transition-colors"
                                >
                                    <span className="flex items-center gap-1.5 text-sm">
                                        <span className="text-xs text-gray-400 w-3">{photoOpen ? '▾' : '▸'}</span>
                                        <span>📷</span>
                                        <span>照片</span>
                                    </span>
                                    <span className="text-xs text-gray-400">{totalPhotos || ''}</span>
                                </div>
                                {photoOpen && (
                                    <div className="ml-4 border-l border-gray-100">
                                        {projectIds.length === 0 ? (
                                            <p className="text-xs text-gray-300 px-3 py-2">尚無照片</p>
                                        ) : projectIds.map(pid => {
                                            const projName = projectMap[pid] || '未知工地';
                                            const isProjOpen = expandedPhotoProj.has(pid);
                                            const projEntries = photoEntries.filter(e => e.projectId === pid);
                                            const uniqueDates = [...new Set(projEntries.map(e => e.date))].sort().reverse();
                                            const projTotal = projEntries.reduce((s, e) => s + e.images.length, 0);
                                            return (
                                                <div key={pid}>
                                                    <div
                                                        onClick={() => togglePhotoProj(pid)}
                                                        className="flex items-center justify-between px-3 py-2 cursor-pointer hover:bg-gray-50 text-gray-600 transition-colors"
                                                    >
                                                        <span className="flex items-center gap-1.5 text-sm min-w-0 truncate">
                                                            <span className="text-xs text-gray-400 w-3 flex-shrink-0">{isProjOpen ? '▾' : '▸'}</span>
                                                            <span>📁</span>
                                                            <span className="truncate">{projName}</span>
                                                        </span>
                                                        <span className="text-xs text-gray-400 ml-2 flex-shrink-0">{projTotal}</span>
                                                    </div>
                                                    {isProjOpen && (
                                                        <div className="ml-4 border-l border-gray-100">
                                                            {(() => {
                                                                let prevYear = null;
                                                                return uniqueDates.map(date => {
                                                                    const { year, monthDay } = parseRocDate(date);
                                                                    const showYear = prevYear !== null && year !== prevYear;
                                                                    prevYear = year;
                                                                    const key = `${pid}|${date}`;
                                                                    const isSelected = selectedPhotoKey === key;
                                                                    const dayCount = projEntries.filter(e => e.date === date).reduce((s, e) => s + e.images.length, 0);
                                                                    return (
                                                                        <div key={date}>
                                                                            {showYear && (
                                                                                <div className="px-3 py-1 text-xs text-gray-300 font-semibold select-none">{year}</div>
                                                                            )}
                                                                            <div
                                                                                onClick={() => { setSelectedPhotoKey(key); setSelectedItem(null); setShowAddForm(false); setEditMode(false); }}
                                                                                className={`flex items-center justify-between px-3 py-2 cursor-pointer text-sm transition-colors
                                                                                    ${isSelected ? 'bg-blue-50 border-l-2 border-blue-500 text-blue-700' : 'text-gray-600 hover:bg-gray-50'}`}
                                                                            >
                                                                                <span>{monthDay}</span>
                                                                                <span className="text-xs text-gray-400">{dayCount}</span>
                                                                            </div>
                                                                        </div>
                                                                    );
                                                                });
                                                            })()}
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        );
                    })()}
                    <div className="border-t border-gray-100 my-1" />

                    {/* Inline 新增資料夾輸入框 */}
                    {creatingFolder && (
                        <div className="px-3 pt-2">
                            <input
                                ref={newFolderRef}
                                value={newFolderVal}
                                onChange={e => setNewFolderVal(e.target.value)}
                                onBlur={commitCreateFolder}
                                onKeyDown={e => { if (e.key === 'Enter') commitCreateFolder(); if (e.key === 'Escape') setCreatingFolder(false); }}
                                placeholder="資料夾名稱"
                                className="w-full text-sm border border-gray-300 rounded px-2 py-1 outline-none focus:border-gray-500"
                            />
                        </div>
                    )}

                    {/* 資料夾列表（可展開）*/}
                    {folders.map(f => {
                        const isExpanded = expandedFIds.has(f.id);
                        const folderNotes = items.filter(i => i.folderId === f.id);
                        const isDragOver  = dragOverFId === f.id;
                        return (
                            <div key={f.id}>
                                {/* 資料夾標題列 */}
                                <div
                                    onContextMenu={e => { e.preventDefault(); e.stopPropagation(); openCtx(e, 'folder', f); }}
                                    onClick={() => toggleExpand(f.id)}
                                    onDragOver={e => { e.preventDefault(); e.stopPropagation(); setDragOverFId(f.id); }}
                                    onDragLeave={e => { if (!e.currentTarget.contains(e.relatedTarget)) setDragOverFId(undefined); }}
                                    onDrop={e => { e.preventDefault(); e.stopPropagation(); setDragOverFId(undefined); const nid = e.dataTransfer.getData('noteId'); if (nid) handleMove(nid, f.id); }}
                                    className={`flex items-center justify-between px-3 py-2.5 cursor-pointer transition-colors
                                        ${isDragOver ? 'bg-blue-100 ring-1 ring-blue-300 ring-inset rounded' : 'text-gray-600 hover:bg-gray-50'}`}
                                >
                                    {renamingId === f.id ? (
                                        <input
                                            ref={renameInputRef}
                                            value={renameVal}
                                            onChange={e => setRenameVal(e.target.value)}
                                            onBlur={commitRename}
                                            onKeyDown={e => { if (e.key === 'Enter') commitRename(); if (e.key === 'Escape') setRenamingId(null); }}
                                            onClick={e => e.stopPropagation()}
                                            className="flex-1 text-sm bg-white text-gray-900 border border-gray-300 rounded px-1 outline-none"
                                        />
                                    ) : (
                                        <>
                                            <span className="text-sm flex items-center gap-1.5 min-w-0 truncate">
                                                <span className="text-gray-400 text-xs w-3 flex-shrink-0">{isExpanded ? '▾' : '▸'}</span>
                                                <span>📁</span>
                                                <span className="truncate">{f.name}</span>
                                            </span>
                                            <span className="text-xs ml-2 flex-shrink-0 text-gray-400">{countIn(f.id)}</span>
                                        </>
                                    )}
                                </div>
                                {/* 展開的資料夾筆記 */}
                                {isExpanded && (
                                    <div className="ml-4 border-l border-gray-100">
                                        {folderNotes.length === 0
                                            ? <p className="text-xs text-gray-300 px-3 py-2">（空）</p>
                                            : folderNotes.map(item => (
                                                <NoteRow key={item.id} item={item} selected={selectedItem?.id === item.id} draggingId={draggingId}
                                                    onSelect={() => { setSelectedItem(item); setShowAddForm(false); setEditMode(false); setSelectedPhotoKey(null); }}
                                                    onDragStart={() => setDraggingId(item.id)}
                                                    onDragEnd={() => { setDraggingId(null); setDragOverFId(undefined); }}
                                                    onCtx={e => { e.preventDefault(); e.stopPropagation(); openCtx(e, 'note', item); }}
                                                    fmt={fmt}
                                                />
                                            ))
                                        }
                                    </div>
                                )}
                            </div>
                        );
                    })}

                    {/* 根目錄筆記（無資料夾）*/}
                    {folders.length > 0 && rootItems.length > 0 && <div className="border-t border-gray-100 my-1" />}
                    <div
                        className={`min-h-[32px] transition-colors ${dragOverFId === null ? 'bg-blue-50' : ''}`}
                        onDragOver={e => { e.preventDefault(); setDragOverFId(null); }}
                        onDragLeave={e => { if (!e.currentTarget.contains(e.relatedTarget)) setDragOverFId(undefined); }}
                        onDrop={e => { e.preventDefault(); setDragOverFId(undefined); const nid = e.dataTransfer.getData('noteId'); if (nid) handleMove(nid, null); }}
                    >
                        {rootItems.length === 0 && folders.length === 0 && (
                            <p className="text-xs text-gray-300 text-center py-6">尚無筆記</p>
                        )}
                        {rootItems.map(item => (
                            <NoteRow key={item.id} item={item} selected={selectedItem?.id === item.id} draggingId={draggingId}
                                onSelect={() => { setSelectedItem(item); setShowAddForm(false); setEditMode(false); setSelectedPhotoKey(null); }}
                                onDragStart={() => setDraggingId(item.id)}
                                onDragEnd={() => { setDraggingId(null); setDragOverFId(undefined); }}
                                onCtx={e => { e.preventDefault(); e.stopPropagation(); openCtx(e, 'note', item); }}
                                fmt={fmt}
                            />
                        ))}
                    </div>
                </div>
            </div>

            {/* 拖曳把手（桌機限定）*/}
            {!isMobile && <div onMouseDown={onDragLeft} className="w-1 flex-shrink-0 bg-gray-100 hover:bg-blue-300 active:bg-blue-400 cursor-col-resize transition-colors" />}

            {/* ── 右側：內容區 ─────────────────────── */}
            <div
                className={`overflow-y-auto bg-white select-text ${isMobile ? (mobileRightActive ? 'flex flex-col w-full' : 'hidden') : 'flex flex-col flex-1'}`}
                onContextMenu={!isMobile ? openRightCtx : undefined}
            >
                {isMobile && mobileRightActive && (
                    <button
                        className="flex items-center gap-1 px-4 py-3 text-sm text-blue-500 border-b border-gray-100 bg-white sticky top-0 z-10 text-left w-full flex-shrink-0"
                        onClick={() => { setSelectedItem(null); setShowAddForm(false); setSelectedPhotoKey(null); setEditMode(false); }}
                    >← 返回</button>
                )}
                {selectedPhotoKey ? (() => {
                    const [pid, date] = selectedPhotoKey.split('|');
                    const { year, monthDay } = parseRocDate(date);
                    const projName = projectMap[pid] || '未知工地';
                    const dayEntries = photoEntries.filter(e => e.projectId === pid && e.date === date);
                    return (
                        <div className="h-full flex flex-col">
                            <div className="px-6 py-4 border-b border-gray-100">
                                <h2 className="text-lg font-semibold text-gray-900">{projName}</h2>
                                <p className="text-sm text-gray-400 mt-0.5">{year}/{monthDay}</p>
                            </div>
                            <div className="flex-1 overflow-y-auto px-6 py-4">
                                <div className="grid grid-cols-2 gap-4">
                                    {dayEntries.map(entry =>
                                        entry.images.map((img, idx) => (
                                            <div key={`${entry.id}-${idx}`}>
                                                <img
                                                    src={img.preview}
                                                    alt=""
                                                    onClick={() => setLightboxImg(img.preview)}
                                                    onContextMenu={e => openPhotoCtx(e, entry.id, idx, img.preview)}
                                                    className="w-full rounded-lg cursor-zoom-in hover:opacity-90 transition-opacity"
                                                />
                                                <p className="text-xs text-gray-400 mt-1.5">
                                                    {[entry.floor, entry.direction, entry.item].filter(Boolean).join(' · ')}
                                                </p>
                                                {entry.content && <p className="text-xs text-gray-500 mt-0.5">{entry.content}</p>}
                                            </div>
                                        ))
                                    )}
                                </div>
                            </div>
                        </div>
                    );
                })() : showAddForm ? (
                    <div className="h-full flex flex-col">
                        <div className="flex items-center gap-3 px-6 py-4 border-b border-gray-100">
                            <input type="text" value={addTitle} onChange={e => setAddTitle(e.target.value)} placeholder="筆記標題 *" className="flex-1 text-lg font-semibold text-gray-900 outline-none placeholder-gray-300" />
                            <input type="text" value={addCategory} onChange={e => setAddCategory(e.target.value)} placeholder="標籤（選填）" className="w-28 px-2 py-1 text-xs border border-gray-200 rounded-lg outline-none focus:border-gray-400 bg-gray-50" />
                            <button onClick={() => addImgRef.current?.click()} className="px-3 py-1.5 text-xs border border-gray-200 rounded-lg text-gray-500 hover:bg-gray-50 transition-colors">插入照片</button>
                            <input ref={addImgRef} type="file" accept="image/*" className="hidden" onChange={e => insertImage(e, addEditorRef.current)} />
                            <button onClick={handleAdd} disabled={saving || !addTitle.trim()} className="px-4 py-1.5 bg-gray-900 text-white text-sm rounded-xl disabled:opacity-50 hover:bg-gray-700 transition-colors">{saving ? '儲存中...' : '儲存'}</button>
                            <button onClick={() => setShowAddForm(false)} className="px-3 py-1.5 text-sm text-gray-400 hover:text-gray-600 transition-colors">取消</button>
                        </div>
                        <div ref={addEditorRef} contentEditable suppressContentEditableWarning className="flex-1 px-6 py-4 outline-none text-sm text-gray-700 leading-relaxed overflow-y-auto" style={{ minHeight: 200 }} dangerouslySetInnerHTML={addContent ? { __html: addContent } : undefined} />
                    </div>
                ) : selectedItem ? (
                    <div className="h-full flex flex-col">
                        <div className="flex items-center gap-3 px-6 py-4 border-b border-gray-100">
                            {editMode ? (
                                <>
                                    <input type="text" value={editTitle} onChange={e => setEditTitle(e.target.value)} className="flex-1 text-lg font-semibold text-gray-900 outline-none border-b border-gray-200 focus:border-gray-500 pb-0.5" />
                                    <input type="text" value={editCategory} onChange={e => setEditCategory(e.target.value)} placeholder="標籤" className="w-28 px-2 py-1 text-xs border border-gray-200 rounded-lg outline-none focus:border-gray-400 bg-gray-50" />
                                    <button onClick={() => editImgRef.current?.click()} className="px-3 py-1.5 text-xs border border-gray-200 rounded-lg text-gray-500 hover:bg-gray-50 transition-colors">插入照片</button>
                                    <input ref={editImgRef} type="file" accept="image/*" className="hidden" onChange={e => insertImage(e, editorRef.current)} />
                                    <button onClick={handleSave} disabled={saving} className="px-4 py-1.5 bg-gray-900 text-white text-sm rounded-xl disabled:opacity-50 hover:bg-gray-700 transition-colors">{saving ? '儲存中...' : '儲存'}</button>
                                    <button onClick={() => setEditMode(false)} className="px-3 py-1.5 text-sm text-gray-400 hover:text-gray-600 transition-colors">取消</button>
                                </>
                            ) : (
                                <>
                                    <div className="flex-1 min-w-0">
                                        <h2 className="text-lg font-semibold text-gray-900 truncate">{selectedItem.title}</h2>
                                        <div className="flex items-center gap-3 mt-0.5">
                                            {selectedItem.category && <span className="text-xs text-blue-500">{selectedItem.category}</span>}
                                            {selectedItem.folderId && <span className="text-xs text-gray-400">📁 {folders.find(f => f.id === selectedItem.folderId)?.name}</span>}
                                            <span className="text-xs text-gray-300">{fmt(selectedItem.updatedAt || selectedItem.createdAt)}</span>
                                        </div>
                                    </div>
                                    <button onClick={startEdit} className="px-3 py-1.5 text-xs border border-gray-200 rounded-lg text-gray-500 hover:bg-gray-50 transition-colors">編輯</button>
                                    <button onClick={() => handleDeleteItem(selectedItem.id)} className="px-3 py-1.5 text-xs border border-red-100 rounded-lg text-red-400 hover:bg-red-50 transition-colors">刪除</button>
                                </>
                            )}
                        </div>
                        {editMode
                            ? <div ref={editorRef} contentEditable suppressContentEditableWarning className="flex-1 px-6 py-4 outline-none text-sm text-gray-700 leading-relaxed overflow-y-auto" style={{ minHeight: 200 }} />
                            : <div className="flex-1 px-6 py-4 text-sm text-gray-700 leading-relaxed overflow-y-auto prose prose-sm max-w-none" dangerouslySetInnerHTML={{ __html: selectedItem.content || '<p style="color:#d1d5db">（無內容）</p>' }} />
                        }
                    </div>
                ) : (
                    <div className="flex flex-col items-center justify-center h-full text-gray-300 gap-3">
                        <span className="text-5xl">📦</span>
                        <p className="text-sm">選擇筆記或新增一筆</p>
                        <p className="text-xs text-gray-200">右鍵左側面板可新增資料夾</p>
                    </div>
                )}
            </div>

            {/* Lightbox */}
            {lightboxImg && (
                <div
                    className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center"
                    onClick={() => setLightboxImg(null)}
                >
                    <img src={lightboxImg} alt="" className="max-w-[90vw] max-h-[90vh] rounded-lg shadow-2xl" onClick={e => e.stopPropagation()} />
                </div>
            )}

            {/* 右鍵選單 */}
            <ContextMenu menu={ctxMenu} onClose={() => setCtxMenu(null)} onAction={handleCtxAction} />

            {/* 移至資料夾 picker */}
            {movePicker && (
                <>
                    <div className="fixed inset-0 z-40 bg-black/20" onClick={() => setMovePicker(null)} />
                    <MovePicker folders={folders} onMove={(fid) => handleMove(movePicker, fid)} onClose={() => setMovePicker(null)} />
                </>
            )}
        </div>
    );
}
