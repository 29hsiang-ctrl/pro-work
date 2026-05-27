import { useState, useRef, useEffect } from 'react';
import html2pdf from 'html2pdf.js';
import { Icons } from './components/icons';
import { EntryEditor } from './components/EntryEditor';
import { MeasurementRecorder } from './components/MeasurementRecorder';
import { PreviewPage } from './components/PreviewPage';
import { getROCDate, compressImage } from './utils/helpers';

export default function App() {
    const [view, setView] = useState('photo'); 
    const [entries, setEntries] = useState(() => {
        const saved = localStorage.getItem('site_report_data');
        return saved ? JSON.parse(saved).map(e => ({...e, images: e.images || []})) : [{ id: Date.now(), date: getROCDate(), floor: '', direction: '', item: '', content: '', images: [] }];
    });
    const [reportTitle, setReportTitle] = useState(() => localStorage.getItem('site_report_title') || '施工照片');
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
                try { const preview = await compressImage(file); processed.push({ preview }); } catch (err) { console.error(err); }
            }
            if (processed.length > 0) {
                setEntries(prev => prev.map(ent => ent.id === id ? { ...ent, images: [...ent.images, ...processed].slice(0, 2) } : ent));
            }
        } finally {
            setIsProcessing(false);
            e.target.value = '';
        }
    };

    const generatePDF = () => {
        setIsGenerating(true);
        setTimeout(() => {
            const opt = { margin: 0, filename: `${reportTitle}_${getROCDate()}.pdf`, image: { type: 'jpeg', quality: 0.95 }, html2canvas: { scale: 2 }, jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' } };
            html2pdf().set(opt).from(reportRef.current).save().then(() => setIsGenerating(false));
        }, 800);
    };

    const chunkedEntries = [];
    for (let i = 0; i < entries.length; i += 3) chunkedEntries.push(entries.slice(i, i + 3));
    if (chunkedEntries.length === 0) chunkedEntries.push([]);

    return (
        <div className="min-h-screen bg-gray-100 p-2 md:p-8 font-sans text-gray-800">
            <div className="max-w-6xl mx-auto mb-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div className="flex flex-col gap-2">
                    <h1 className="text-2xl font-bold flex items-center gap-2">🏗️ PRO事一堆</h1>
                    <div className="flex items-center gap-4">
                        <div className="flex bg-gray-200 p-1 rounded-lg shadow-inner">
                            <button onClick={()=>setView('photo')} className={`px-4 py-1 text-xs rounded-md transition-all ${view==='photo'?'bg-white shadow text-blue-600 font-bold':'text-gray-500 hover:text-gray-700'}`}>照片黏貼</button>
                            <button onClick={()=>setView('dimension')} className={`px-4 py-1 text-xs rounded-md transition-all ${view==='dimension'?'bg-white shadow text-blue-600 font-bold':'text-gray-500 hover:text-gray-700'}`}>四周量測</button>
                            <button onClick={()=>setView('twoSide')} className={`px-4 py-1 text-xs rounded-md transition-all ${view==='twoSide'?'bg-white shadow text-blue-600 font-bold':'text-gray-500 hover:text-gray-700'}`}>兩側量測</button>
                        </div>
                        {view === 'photo' && <div className="flex items-center gap-2 border-b border-gray-400 pb-0.5 font-bold font-sans italic"><label className="text-xs text-gray-500">標題:</label><input type="text" value={reportTitle} onChange={e=>setReportTitle(e.target.value)} className="bg-transparent outline-none w-32" /></div>}
                    </div>
                </div>
                {view === 'photo' && (
                    <div className="flex gap-2">
                        <button onClick={() => {if(confirm("確定重置？")) { localStorage.clear(); window.location.reload(); }}} className="text-xs text-red-400 px-2 font-bold font-sans">重置</button>
                        <button onClick={() => setEntries([...entries, {id: Date.now(), date: getROCDate(), floor:'', direction:'', item:'', content:'', images:[] }])} className="px-4 py-2 bg-white border border-gray-300 rounded-lg text-xs font-bold shadow">+ 新增單筆</button>
                        <button onClick={generatePDF} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-xs font-bold shadow">下載 PDF</button>
                    </div>
                )}
            </div>

            {view === 'photo' ? (
                <div className="max-w-3xl mx-auto space-y-4 animate-in fade-in">
                    {entries.map((entry, idx) => (
                        <EntryEditor key={entry.id} entry={entry} index={idx} total={entries.length} onMove={(i,d)=>{const n=[...entries]; const t=d==='up'?i-1:i+1; [n[i],n[t]]=[n[t],n[i]]; setEntries(n);}} onRemove={id=>setEntries(entries.filter(e=>e.id!==id))} onChange={(id,f,v)=>setEntries(entries.map(e=>e.id===id?{...e,[f]:v}:e))} onImageUpload={handleImageUpload} onRemoveImage={(id,idx)=>setEntries(entries.map(e=>e.id===id?{...e,images:e.images.filter((_,i)=>i!==idx)}:e))} />
                    ))}
                    <button onClick={() => setEntries([...entries, {id: Date.now(), date: getROCDate(), floor:'', direction:'', item:'', content:'', images:[] }])} className="w-full py-5 border-2 border-dashed border-gray-300 rounded-2xl text-gray-400 font-bold bg-white font-sans text-lg">+ 新增照片項目</button>
                    <div style={{ position: 'absolute', left: '-9999px', top: '-9999px', pointerEvents: 'none' }}>
                        <div ref={reportRef} style={{ margin: 0, padding: 0 }}>
                            {chunkedEntries.map((items, i) => <PreviewPage key={i} pageItems={items} pageIndex={i} totalPages={chunkedEntries.length} reportTitle={reportTitle} />)}
                        </div>
                    </div>
                </div>
            ) : view === 'dimension' ? (
                <MeasurementRecorder key="horiz" defaultTitle="四周量測尺寸" mode="full" />
            ) : (
                <MeasurementRecorder key="twoSide" defaultTitle="兩側量測尺寸" mode="widthOnly" />
            )}
            
            {(isProcessing || isGenerating) && <div className="fixed inset-0 bg-black/60 z-50 flex flex-col items-center justify-center font-bold text-white backdrop-blur-sm shadow-2xl font-sans"><Icons.Loader />處理中，請稍候...</div>}
        </div>
    );
}