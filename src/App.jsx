import { useState, useRef, useEffect } from 'react';
import { jsPDF } from 'jspdf';
import { toJpeg } from 'html-to-image';
import { Icons } from './components/icons';
import { EntryEditor } from './components/EntryEditor';
import { MeasurementRecorder } from './components/MeasurementRecorder';
import { CodeMeasurementRecorder } from './components/CodeMeasurementRecorder';
import { PlanMeasurementRecorder } from './components/PlanMeasurementRecorder';
import { PreviewPage } from './components/PreviewPage';
import { CalendarView } from './components/CalendarView';
import { getROCDate, compressImage } from './utils/helpers';
import { useAuth } from './context/AuthContext';
import { usePermission } from './hooks/usePermission';
import { LoginPage } from './pages/LoginPage';
import { useProject } from './context/ProjectContext';
import { DashboardPage } from './pages/DashboardPage';
import { DrawingPage } from './pages/DrawingPage';
import { FactoryPage } from './pages/FactoryPage';
import { SettingsPage } from './pages/SettingsPage';

const MAIN_NAV = [
    { key: 'dashboard', label: '首頁' },
    { key: 'drawing',   label: '繪圖' },
    { key: 'factory',   label: '下料' },
    { key: 'site',      label: '工地現場' },
    { key: 'calendar',  label: '日曆' },
    { key: 'settings',  label: '系統設定' },
];

const VIEW_MENU = [
    { group: '照片記錄', items: [{ label: '照片黏貼', key: 'photo' }] },
    { group: '量測工具', items: [
        { label: '四周量測', key: 'dimension' },
        { label: '兩側量測', key: 'twoSide' },
        { label: '代號量測(樓層)', key: 'code' },
        { label: '代號量測(平面)', key: 'codePlan' },
    ]},
];

export default function App() {
    const { user, logout } = useAuth();
    const { canAccess } = usePermission();
    const { loading: dbLoading, dbError } = useProject();
    const [mainSection, setMainSection] = useState('dashboard');
    const [view, setView] = useState('photo');
    const [menuOpen, setMenuOpen] = useState(false);
    const [calendarJumpDate, setCalendarJumpDate] = useState(null);
    const [entries, setEntries] = useState(() => {
        try {
            const saved = localStorage.getItem('site_report_data');
            return saved ? JSON.parse(saved).map(e => ({...e, images: e.images || []})) : [{ id: Date.now(), date: getROCDate(), floor: '', direction: '', item: '', content: '', images: [] }];
        } catch {
            return [{ id: Date.now(), date: getROCDate(), floor: '', direction: '', item: '', content: '', images: [] }];
        }
    });
    const [reportTitle, setReportTitle] = useState(() => localStorage.getItem('site_report_title') || '施工照片');
    const [calendarEntries, setCalendarEntries] = useState(() => {
        try {
            const saved = localStorage.getItem('calendar_entries');
            return saved ? JSON.parse(saved) : [];
        } catch { return []; }
    });
    const [isGenerating, setIsGenerating] = useState(false);
    const [isProcessing, setIsProcessing] = useState(false);
    const reportRef = useRef(null);

    useEffect(() => { document.title = "PRO-WORK"; }, []);

    // --- [修正] 防止暫存爆掉 ---
    useEffect(() => {
        try {
            localStorage.setItem('site_report_data', JSON.stringify(entries));
            localStorage.setItem('site_report_title', reportTitle);
        } catch { console.warn("暫存已滿"); }
    }, [entries, reportTitle]);

    useEffect(() => {
        try {
            localStorage.setItem('calendar_entries', JSON.stringify(calendarEntries));
        } catch { console.warn("暫存已滿"); }
    }, [calendarEntries]);

    const handleImageUpload = async (id, e) => {
        const files = Array.from(e.target.files); 
        if (!files.length) return;
        setIsProcessing(true);
        try {
            const currentEntry = entries.find(ent => ent.id === id);
            const remainingSlots = 2 - (currentEntry?.images?.length || 0);
            if (remainingSlots <= 0) return;
            const processed = [];
            for(let file of files.slice(0, remainingSlots)) {
                try { const preview = await compressImage(file, 600, 0.4); processed.push({ preview }); } catch (err) { console.error(err); }
            }
            if (processed.length > 0) {
                setEntries(prev => prev.map(ent => ent.id === id ? { ...ent, images: [...ent.images, ...processed].slice(0, 2) } : ent));
            }
        } finally {
            setIsProcessing(false);
            e.target.value = '';
        }
    };

    const generatePDF = async () => {
        setIsGenerating(true);
        try {
            const pdf = new jsPDF('p', 'mm', 'a4');
            const pages = reportRef.current.children;
            
            const parent = reportRef.current.parentElement;
            const originalStyle = parent.style.cssText;
            
            // Move into viewport but keep it visually behind everything to avoid rendering bugs
            parent.style.cssText = 'position: absolute; left: 0px; top: 0px; z-index: -9999; opacity: 1; pointer-events: none; background: white;';

            for (let i = 0; i < pages.length; i++) {
                const page = pages[i];
                const dataUrl = await toJpeg(page, { 
                    cacheBust: true, 
                    pixelRatio: 1.5, 
                    backgroundColor: '#ffffff' 
                });
                if (i > 0) pdf.addPage();
                
                pdf.addImage(dataUrl, 'JPEG', 0, 0, 210, 297);
            }
            
            parent.style.cssText = originalStyle;
            pdf.save(`${reportTitle}_${getROCDate()}.pdf`);
        } catch (err) {
            console.error('Failed to generate PDF', err);
            alert('PDF 匯出失敗，請重試或將圖片品質降低。');
        } finally {
            setIsGenerating(false);
        }
    };

    const generateImage = async () => {
        setIsGenerating(true);
        try {
            const filesToShare = [];

            for (let i = 0; i < entries.length; i++) {
                const entry = entries[i];
                if (!entry.images || entry.images.length === 0) continue;
                
                const watermarkText = [entry.date, entry.floor, entry.direction, entry.item, entry.content].filter(Boolean).join('-');
                
                for (let j = 0; j < entry.images.length; j++) {
                    const imgObj = entry.images[j];
                    const imgDataUrl = imgObj.preview;
                    
                    const img = new Image();
                    img.src = imgDataUrl;
                    await new Promise((resolve) => {
                        img.onload = resolve;
                        img.onerror = resolve;
                    });
                    
                    if (!img.width || !img.height) continue;
                    
                    const canvas = document.createElement('canvas');
                    canvas.width = img.width;
                    canvas.height = img.height;
                    const ctx = canvas.getContext('2d');
                    
                    // 背景填滿預防透明PNG
                    ctx.fillStyle = '#ffffff';
                    ctx.fillRect(0, 0, canvas.width, canvas.height);
                    ctx.drawImage(img, 0, 0);
                    
                    if (watermarkText) {
                        const fontSize = Math.max(18, Math.floor(canvas.width * 0.025)); 
                        ctx.font = `bold ${fontSize}px sans-serif`;
                        
                        const paddingX = fontSize * 0.4;
                        const paddingY = fontSize * 0.2;
                        const textMetrics = ctx.measureText(watermarkText);
                        const textWidth = textMetrics.width;
                        const lineHeight = fontSize * 1.2;
                        
                        // 位置在左上角
                        const rectX = Math.floor(canvas.width * 0.02);
                        const rectY = Math.floor(canvas.height * 0.02);
                        const rectWidth = textWidth + paddingX * 2;
                        const rectHeight = lineHeight + paddingY * 2;
                        
                        ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
                        ctx.fillRect(rectX, rectY, rectWidth, rectHeight);
                        
                        ctx.fillStyle = '#dc2626'; // tailwind red-600
                        ctx.textBaseline = 'top';
                        ctx.fillText(watermarkText, rectX + paddingX, rectY + paddingY + (lineHeight - fontSize) / 2);
                    }
                    
                    const imageBlob = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', 0.85));
                    if (imageBlob) {
                        const filename = `${watermarkText ? watermarkText.replace(new RegExp('[\\\\/:*?"<>|]', 'g'), '-') : '現場照片'}_${i+1}_${j+1}.jpg`;
                        filesToShare.push(new File([imageBlob], filename, { type: 'image/jpeg' }));
                    }
                }
            }
            
            if (filesToShare.length > 0) {
                const downloadIndividualFiles = (files) => {
                    files.forEach((file, index) => {
                        setTimeout(() => {
                            const url = URL.createObjectURL(file);
                            const link = document.createElement('a');
                            link.href = url;
                            link.download = file.name;
                            document.body.appendChild(link);
                            link.click();
                            document.body.removeChild(link);
                            URL.revokeObjectURL(url);
                        }, index * 300);
                    });
                };

                if (navigator.canShare && navigator.canShare({ files: filesToShare })) {
                    try {
                        await navigator.share({
                            files: filesToShare,
                            title: '施工照片',
                        });
                    } catch (e) {
                        if (e.name !== 'AbortError') {
                            downloadIndividualFiles(filesToShare);
                        }
                    }
                } else {
                    downloadIndividualFiles(filesToShare);
                }
            } else {
                alert('沒有可輸出的照片');
            }
        } catch (err) {
            console.error('Failed to export photos', err);
            alert('照片輸出失敗: ' + err.message);
        } finally {
            setIsGenerating(false);
        }
    };

    const chunkedEntries = [];
    for (let i = 0; i < entries.length; i += 3) chunkedEntries.push(entries.slice(i, i + 3));
    if (chunkedEntries.length === 0) chunkedEntries.push([]);

    if (!user) return <LoginPage />;
    if (dbLoading) return <div className="flex items-center justify-center min-h-screen text-gray-400 font-sans text-sm">連線中...</div>;
    if (dbError) return <div className="flex flex-col items-center justify-center min-h-screen text-red-400 font-sans gap-2"><p className="font-bold">資料庫連線失敗</p><p className="text-xs text-gray-400">{dbError}</p></div>;

    const visibleNav = MAIN_NAV.filter(s => canAccess(s.key));
    // 若目前 section 使用者無權限，自動跳到第一個有權限的頁面
    const activeSection = canAccess(mainSection) ? mainSection : (visibleNav[0]?.key ?? 'calendar');

    return (
        <>
            {/* Pro Work 主導覽 */}
            <div className="sticky top-0 z-30 bg-white border-b border-gray-200 shadow-sm font-sans">
                <div className="flex items-center gap-1 px-4 py-2 overflow-x-auto">
                    <span className="font-bold text-base text-gray-900 mr-3 flex-shrink-0">Pro Work</span>
                    {visibleNav.map(s => (
                        <button key={s.key} onClick={() => setMainSection(s.key)}
                            className={`flex-shrink-0 px-4 py-1.5 text-sm rounded-full transition-colors ${mainSection === s.key ? 'bg-gray-900 text-white font-medium' : 'text-gray-500 hover:text-gray-800 hover:bg-gray-100'}`}>
                            {s.label}
                        </button>
                    ))}
                    <div className="ml-auto flex items-center gap-2 flex-shrink-0 pl-3">
                        <span className="text-xs text-gray-500">{user.name}</span>
                        <button onClick={logout} className="text-xs text-gray-400 hover:text-red-500 transition-colors px-2 py-1 rounded-lg hover:bg-red-50">登出</button>
                    </div>
                </div>
            </div>

            {activeSection === 'site' ? (
            <div className={`min-h-screen bg-gray-100 p-2 md:p-8 font-sans text-gray-800`}>
                <div className="max-w-6xl mx-auto mb-6 flex flex-col gap-3">
                    <div className="flex justify-between items-center">
                        <h1 className="text-2xl font-bold flex items-center gap-2">🏗️ 工地現場</h1>
                        {view === 'photo' && (
                            <div className="flex gap-2">
                                <button onClick={() => { localStorage.removeItem('site_report_data'); localStorage.removeItem('site_report_title'); window.location.reload(); }} className="text-xs text-red-400 px-2 font-bold font-sans">重置</button>
                                <button onClick={() => setEntries([...entries, {id: Date.now(), date: getROCDate(), floor:'', direction:'', item:'', content:'', images:[] }])} className="px-4 py-2 bg-white border border-gray-300 rounded-lg text-xs font-bold shadow">+ 新增單筆</button>
                                <button onClick={generateImage} className="px-4 py-2 bg-purple-600 text-white rounded-lg text-xs font-bold shadow">輸出圖片</button>
                                <button onClick={generatePDF} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-xs font-bold shadow">生成 PDF</button>
                                <button onClick={() => {
                                    setCalendarEntries(prev => {
                                        const existingIds = new Set(prev.map(e => e.id));
                                        const toAdd = entries.filter(e => !existingIds.has(e.id));
                                        return [...prev, ...toAdd];
                                    });
                                    setCalendarJumpDate(new Date());
                                    setView('calendar');
                                }} className="px-4 py-2 bg-green-600 text-white rounded-lg text-xs font-bold shadow">儲存到日歷</button>
                            </div>
                        )}
                    </div>
                    <div className="flex items-center gap-3">
                        <div className="relative">
                            <button
                                onClick={() => setMenuOpen(o => !o)}
                                className="flex items-center justify-center w-28 h-14 bg-white rounded-xl shadow border border-gray-200 hover:bg-gray-50 transition-colors"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" className="w-7 h-7 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16"/></svg>
                            </button>
                            {menuOpen && (
                                <>
                                    <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(false)} />
                                    <div className="absolute top-full mt-1 left-0 bg-white rounded-xl shadow-lg border border-gray-200 z-50 py-2 min-w-44">
                                        {VIEW_MENU.map(group => (
                                            <div key={group.group}>
                                                <div className="px-3 pt-2 pb-1 text-xs font-bold text-gray-400 uppercase tracking-wide">{group.group}</div>
                                                {group.items.map(item => (
                                                    <button
                                                        key={item.key}
                                                        onClick={() => { setView(item.key); setMenuOpen(false); }}
                                                        className={`w-full text-left px-4 py-2 text-sm transition-colors ${view === item.key ? 'text-blue-600 font-bold bg-blue-50' : 'text-gray-700 hover:bg-gray-50'}`}
                                                    >
                                                        {item.label}
                                                    </button>
                                                ))}
                                            </div>
                                        ))}
                                    </div>
                                </>
                            )}
                        </div>
                    </div>
                    {view === 'photo' && <div className="flex items-center gap-2 border-b border-gray-400 pb-0.5 font-bold font-sans italic"><label className="text-xs text-gray-500">標題:</label><input type="text" value={reportTitle} onChange={e=>setReportTitle(e.target.value)} className="bg-transparent outline-none w-32" /></div>}
                </div>

                {view === 'photo' ? (
                    <div className="max-w-3xl mx-auto space-y-4 animate-in fade-in">
                        {entries.map((entry, idx) => (
                            <EntryEditor key={entry.id} entry={entry} index={idx} total={entries.length} onMove={(i,d)=>{const n=[...entries]; const t=d==='up'?i-1:i+1; [n[i],n[t]]=[n[t],n[i]]; setEntries(n);}} onRemove={id=>setEntries(entries.filter(e=>e.id!==id))} onChange={(id,f,v)=>setEntries(entries.map(e=>e.id===id?{...e,[f]:v}:e))} onImageUpload={handleImageUpload} onRemoveImage={(id,idx)=>setEntries(entries.map(e=>e.id===id?{...e,images:e.images.filter((_,i)=>i!==idx)}:e))} />
                        ))}
                        <button onClick={() => setEntries([...entries, {id: Date.now(), date: getROCDate(), floor:'', direction:'', item:'', content:'', images:[] }])} className="w-full py-5 border-2 border-dashed border-gray-300 rounded-2xl text-gray-400 font-bold bg-white font-sans text-lg">+ 新增照片項目</button>
                    </div>
                ) : view === 'dimension' ? (
                    <MeasurementRecorder key="horiz" defaultTitle="四周量測尺寸" mode="full" />
                ) : view === 'twoSide' ? (
                    <MeasurementRecorder key="twoSide" defaultTitle="兩側量測尺寸" mode="widthOnly" />
                ) : view === 'codePlan' ? (
                    <PlanMeasurementRecorder key="planMeasure" defaultTitle="代號量測尺寸" />
                ) : view === 'calendar' ? (
                    <CalendarView entries={calendarEntries} onDeleteEntry={(id) => setCalendarEntries(prev => prev.filter(e => e.id !== id))} jumpDate={calendarJumpDate} onJumped={() => setCalendarJumpDate(null)} onAddEntry={() => { setEntries(prev => [...prev, {id: Date.now(), date: getROCDate(), floor:'', direction:'', item:'', content:'', images:[] }]); setView('photo'); }} />
                ) : (
                    <CodeMeasurementRecorder key="codeMeasure" defaultTitle="代號量測尺寸" />
                )}
                
                {(isProcessing || isGenerating) && <div className="fixed inset-0 bg-black/60 z-50 flex flex-col items-center justify-center font-bold text-white backdrop-blur-sm shadow-2xl font-sans"><Icons.Loader />處理中，請稍候...</div>}
            </div>
            ) : activeSection === 'calendar' ? (
                <CalendarView entries={calendarEntries} onDeleteEntry={(id) => setCalendarEntries(prev => prev.filter(e => e.id !== id))} jumpDate={calendarJumpDate} onJumped={() => setCalendarJumpDate(null)} onAddEntry={() => { setEntries(prev => [...prev, {id: Date.now(), date: getROCDate(), floor:'', direction:'', item:'', content:'', images:[] }]); setMainSection('site'); setView('photo'); }} />
            ) : activeSection === 'dashboard' ? (
                <DashboardPage />
            ) : activeSection === 'drawing' ? (
                <DrawingPage />
            ) : activeSection === 'factory' ? (
                <FactoryPage />
            ) : activeSection === 'settings' ? (
                <SettingsPage />
            ) : (
                <div className="flex flex-col items-center justify-center min-h-[70vh] font-sans text-gray-300 gap-3">
                    <div className="text-6xl">🚧</div>
                    <p className="text-xl font-semibold text-gray-400">{MAIN_NAV.find(s => s.key === activeSection)?.label}</p>
                    <p className="text-sm">開發中</p>
                </div>
            )}

            <div className="absolute left-[-9999px] top-[-9999px] opacity-0 pointer-events-none">
                <div ref={reportRef} style={{ margin: 0, padding: 0 }}>
                    {chunkedEntries.map((items, i) => <PreviewPage key={i} pageItems={items} pageIndex={i} totalPages={chunkedEntries.length} reportTitle={reportTitle} />)}
                </div>
            </div>
        </>
    );
}