import { useState, useEffect, useRef, useCallback } from 'react';
import { compressImage } from '../utils/helpers';

function uid() { return Math.random().toString(36).slice(2, 10); }

const ALL_CAT = '__all__';

export function StoragePage() {
    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedCat, setSelectedCat] = useState(ALL_CAT);
    const [selectedItem, setSelectedItem] = useState(null);
    const [editMode, setEditMode] = useState(false);
    const [editTitle, setEditTitle] = useState('');
    const [editCategory, setEditCategory] = useState('');
    const [saving, setSaving] = useState(false);
    const [importing, setImporting] = useState(false);

    // 新增筆記表單
    const [showAddForm, setShowAddForm] = useState(false);
    const [addTitle, setAddTitle] = useState('');
    const [addCategory, setAddCategory] = useState('');
    const [addContent, setAddContent] = useState('');

    const editorRef = useRef(null);
    const addEditorRef = useRef(null);
    const fileInputRef = useRef(null);
    const editImgInputRef = useRef(null);
    const addImgInputRef = useRef(null);

    const fetchItems = async () => {
        try {
            const res = await fetch('/api/storage');
            if (res.ok) setItems(await res.json());
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchItems(); }, []);

    const categories = [...new Set(items.map(i => i.category).filter(Boolean))].sort();
    const filtered = selectedCat === ALL_CAT ? items : items.filter(i => i.category === selectedCat);

    // ── Word / 照片匯入 ──────────────────────────────
    const handleImportFile = async (e) => {
        const files = Array.from(e.target.files);
        if (!files.length) return;
        setImporting(true);
        try {
            let content = '';
            let title = '未命名';
            for (const file of files) {
                if (file.name.endsWith('.docx')) {
                    const mammoth = await import('mammoth');
                    const buf = await file.arrayBuffer();
                    const result = await mammoth.convertToHtml({ arrayBuffer: buf });
                    content += result.value;
                    title = file.name.replace(/\.docx$/i, '');
                } else if (file.type.startsWith('image/')) {
                    const base64 = await compressImage(file, 1200, 0.8);
                    content += `<p><img src="${base64}" style="max-width:100%;border-radius:4px;" /></p>`;
                }
            }
            setAddTitle(title);
            setAddContent(content);
            setShowAddForm(true);
            if (addEditorRef.current) addEditorRef.current.innerHTML = content;
        } catch (e) {
            alert('匯入失敗：' + e.message);
        } finally {
            setImporting(false);
            e.target.value = '';
        }
    };

    // ── 插入照片到 contentEditable ─────────────────
    const insertImage = async (e, editorEl) => {
        const file = e.target.files[0];
        if (!file || !editorEl) return;
        const base64 = await compressImage(file, 1200, 0.8);
        editorEl.focus();
        const sel = window.getSelection();
        if (sel && sel.rangeCount > 0) {
            const range = sel.getRangeAt(0);
            range.collapse(false);
            const img = document.createElement('img');
            img.src = base64;
            img.style.cssText = 'max-width:100%;border-radius:4px;display:block;margin:4px 0';
            range.insertNode(img);
            range.setStartAfter(img);
            sel.removeAllRanges();
            sel.addRange(range);
        } else {
            editorEl.innerHTML += `<p><img src="${base64}" style="max-width:100%;border-radius:4px;" /></p>`;
        }
        e.target.value = '';
    };

    // ── 新增筆記 ──────────────────────────────────
    const handleAdd = async () => {
        const content = addEditorRef.current?.innerHTML ?? addContent;
        if (!addTitle.trim()) return;
        setSaving(true);
        const item = { id: uid(), title: addTitle.trim(), category: addCategory.trim(), content };
        const res = await fetch('/api/storage', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(item),
        });
        if (res.ok) {
            const created = await res.json();
            setItems(prev => [created, ...prev]);
            setSelectedItem(created);
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
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: selectedItem.id, title: editTitle, category: editCategory, content }),
        });
        if (res.ok) {
            const { updatedAt } = await res.json();
            const updated = { ...selectedItem, title: editTitle, category: editCategory, content, updatedAt };
            setItems(prev => prev.map(i => i.id === selectedItem.id ? updated : i));
            setSelectedItem(updated);
        }
        setEditMode(false);
        setSaving(false);
    };

    // ── 刪除 ──────────────────────────────────────
    const handleDelete = async (id) => {
        if (!window.confirm('確認刪除此筆記？')) return;
        await fetch(`/api/storage?id=${id}`, { method: 'DELETE' });
        setItems(prev => prev.filter(i => i.id !== id));
        if (selectedItem?.id === id) setSelectedItem(null);
    };

    const startEdit = () => {
        setEditTitle(selectedItem.title);
        setEditCategory(selectedItem.category || '');
        setEditMode(true);
        setTimeout(() => {
            if (editorRef.current) editorRef.current.innerHTML = selectedItem.content || '';
        }, 0);
    };

    const formatDate = (iso) => iso ? new Date(iso).toLocaleDateString('zh-TW', { year:'numeric', month:'2-digit', day:'2-digit' }) : '';

    if (loading) return <div className="flex items-center justify-center min-h-[70vh] text-sm text-gray-400 font-sans">載入中...</div>;

    return (
        <div className="flex h-[calc(100vh-49px)] font-sans overflow-hidden">
            {/* ── 左側：種類 + 清單 ─────────────────────── */}
            <div className="w-64 flex-shrink-0 border-r border-gray-100 bg-white flex flex-col">
                {/* 操作按鈕 */}
                <div className="p-3 border-b border-gray-100 space-y-2">
                    <button
                        onClick={() => { setAddTitle(''); setAddCategory(''); setAddContent(''); setShowAddForm(true); setTimeout(() => { if (addEditorRef.current) addEditorRef.current.innerHTML = ''; }, 0); }}
                        className="w-full px-3 py-2 bg-gray-900 text-white text-xs font-semibold rounded-xl hover:bg-gray-700 transition-colors"
                    >+ 新增筆記</button>
                    <button
                        onClick={() => fileInputRef.current?.click()}
                        disabled={importing}
                        className="w-full px-3 py-2 border border-gray-200 text-gray-600 text-xs rounded-xl hover:bg-gray-50 transition-colors disabled:opacity-60"
                    >{importing ? '匯入中...' : '匯入 Word / 照片'}</button>
                    <input ref={fileInputRef} type="file" accept=".docx,image/*" multiple className="hidden" onChange={handleImportFile} />
                </div>

                {/* 種類篩選 */}
                <div className="overflow-y-auto flex-1">
                    <button
                        onClick={() => setSelectedCat(ALL_CAT)}
                        className={`w-full text-left px-4 py-2.5 text-sm transition-colors ${selectedCat === ALL_CAT ? 'bg-gray-900 text-white font-medium' : 'text-gray-600 hover:bg-gray-50'}`}
                    >全部 <span className="text-xs opacity-60">({items.length})</span></button>
                    {categories.map(cat => (
                        <button
                            key={cat}
                            onClick={() => setSelectedCat(cat)}
                            className={`w-full text-left px-4 py-2.5 text-sm transition-colors ${selectedCat === cat ? 'bg-gray-900 text-white font-medium' : 'text-gray-600 hover:bg-gray-50'}`}
                        >
                            <span className="truncate block">{cat}</span>
                            <span className="text-xs opacity-60">({items.filter(i => i.category === cat).length})</span>
                        </button>
                    ))}
                </div>
            </div>

            {/* ── 中欄：筆記列表 ─────────────────────────── */}
            <div className="w-64 flex-shrink-0 border-r border-gray-100 bg-gray-50 overflow-y-auto">
                {filtered.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-gray-300 gap-2 py-16">
                        <span className="text-3xl">📄</span>
                        <p className="text-xs">尚無筆記</p>
                    </div>
                ) : (
                    <div className="divide-y divide-gray-100">
                        {filtered.map(item => (
                            <button
                                key={item.id}
                                onClick={() => { setSelectedItem(item); setEditMode(false); }}
                                className={`w-full text-left px-4 py-3 transition-colors ${selectedItem?.id === item.id ? 'bg-white border-l-2 border-gray-900' : 'hover:bg-white'}`}
                            >
                                <p className="text-sm font-medium text-gray-800 truncate">{item.title || '未命名'}</p>
                                {item.category && <p className="text-xs text-blue-500 mt-0.5 truncate">{item.category}</p>}
                                <p className="text-xs text-gray-300 mt-0.5">{formatDate(item.updatedAt || item.createdAt)}</p>
                            </button>
                        ))}
                    </div>
                )}
            </div>

            {/* ── 右側：內容區 ──────────────────────────── */}
            <div className="flex-1 overflow-y-auto bg-white">
                {/* 新增筆記表單 */}
                {showAddForm && (
                    <div className="h-full flex flex-col">
                        <div className="flex items-center gap-3 px-6 py-4 border-b border-gray-100">
                            <input
                                type="text"
                                value={addTitle}
                                onChange={e => setAddTitle(e.target.value)}
                                placeholder="筆記標題 *"
                                className="flex-1 text-lg font-semibold text-gray-900 outline-none placeholder-gray-300"
                            />
                            <input
                                type="text"
                                value={addCategory}
                                onChange={e => setAddCategory(e.target.value)}
                                placeholder="種類（選填）"
                                className="w-32 px-2 py-1 text-xs border border-gray-200 rounded-lg outline-none focus:border-gray-400 bg-gray-50"
                            />
                            <button
                                onClick={() => fileInputRef.current && (addImgInputRef.current?.click())}
                                className="px-3 py-1.5 text-xs border border-gray-200 rounded-lg text-gray-500 hover:bg-gray-50 transition-colors"
                            >插入照片</button>
                            <input ref={addImgInputRef} type="file" accept="image/*" className="hidden" onChange={e => insertImage(e, addEditorRef.current)} />
                            <button onClick={handleAdd} disabled={saving || !addTitle.trim()} className="px-4 py-1.5 bg-gray-900 text-white text-sm rounded-xl disabled:opacity-50 hover:bg-gray-700 transition-colors">{saving ? '儲存中...' : '儲存'}</button>
                            <button onClick={() => setShowAddForm(false)} className="px-3 py-1.5 text-sm text-gray-400 hover:text-gray-600 transition-colors">取消</button>
                        </div>
                        <div
                            ref={addEditorRef}
                            contentEditable
                            suppressContentEditableWarning
                            className="flex-1 px-6 py-4 outline-none text-sm text-gray-700 leading-relaxed prose prose-sm max-w-none overflow-y-auto"
                            style={{ minHeight: '200px' }}
                            dangerouslySetInnerHTML={addContent ? { __html: addContent } : undefined}
                        />
                    </div>
                )}

                {/* 筆記閱讀 / 編輯 */}
                {!showAddForm && selectedItem && (
                    <div className="h-full flex flex-col">
                        <div className="flex items-center gap-3 px-6 py-4 border-b border-gray-100">
                            {editMode ? (
                                <>
                                    <input
                                        type="text"
                                        value={editTitle}
                                        onChange={e => setEditTitle(e.target.value)}
                                        className="flex-1 text-lg font-semibold text-gray-900 outline-none border-b border-gray-200 focus:border-gray-500 pb-0.5"
                                    />
                                    <input
                                        type="text"
                                        value={editCategory}
                                        onChange={e => setEditCategory(e.target.value)}
                                        placeholder="種類"
                                        className="w-32 px-2 py-1 text-xs border border-gray-200 rounded-lg outline-none focus:border-gray-400 bg-gray-50"
                                    />
                                    <button
                                        onClick={() => editImgInputRef.current?.click()}
                                        className="px-3 py-1.5 text-xs border border-gray-200 rounded-lg text-gray-500 hover:bg-gray-50 transition-colors"
                                    >插入照片</button>
                                    <input ref={editImgInputRef} type="file" accept="image/*" className="hidden" onChange={e => insertImage(e, editorRef.current)} />
                                    <button onClick={handleSave} disabled={saving} className="px-4 py-1.5 bg-gray-900 text-white text-sm rounded-xl disabled:opacity-50 hover:bg-gray-700 transition-colors">{saving ? '儲存中...' : '儲存'}</button>
                                    <button onClick={() => setEditMode(false)} className="px-3 py-1.5 text-sm text-gray-400 hover:text-gray-600 transition-colors">取消</button>
                                </>
                            ) : (
                                <>
                                    <div className="flex-1 min-w-0">
                                        <h2 className="text-lg font-semibold text-gray-900 truncate">{selectedItem.title}</h2>
                                        <div className="flex items-center gap-3 mt-0.5">
                                            {selectedItem.category && <span className="text-xs text-blue-500">{selectedItem.category}</span>}
                                            <span className="text-xs text-gray-300">{formatDate(selectedItem.updatedAt || selectedItem.createdAt)}</span>
                                        </div>
                                    </div>
                                    <button onClick={startEdit} className="px-3 py-1.5 text-xs border border-gray-200 rounded-lg text-gray-500 hover:bg-gray-50 transition-colors">編輯</button>
                                    <button onClick={() => handleDelete(selectedItem.id)} className="px-3 py-1.5 text-xs border border-red-100 rounded-lg text-red-400 hover:bg-red-50 transition-colors">刪除</button>
                                </>
                            )}
                        </div>

                        {editMode ? (
                            <div
                                ref={editorRef}
                                contentEditable
                                suppressContentEditableWarning
                                className="flex-1 px-6 py-4 outline-none text-sm text-gray-700 leading-relaxed overflow-y-auto"
                                style={{ minHeight: '200px' }}
                            />
                        ) : (
                            <div
                                className="flex-1 px-6 py-4 text-sm text-gray-700 leading-relaxed overflow-y-auto prose prose-sm max-w-none"
                                dangerouslySetInnerHTML={{ __html: selectedItem.content || '<p class="text-gray-300">（無內容）</p>' }}
                            />
                        )}
                    </div>
                )}

                {/* 空狀態 */}
                {!showAddForm && !selectedItem && (
                    <div className="flex flex-col items-center justify-center h-full text-gray-300 gap-3">
                        <span className="text-5xl">📦</span>
                        <p className="text-sm">選擇左側筆記或新增一筆</p>
                    </div>
                )}
            </div>
        </div>
    );
}
