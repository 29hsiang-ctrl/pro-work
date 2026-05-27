import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import { useState, useRef, useEffect } from 'react';
import html2pdf from 'html2pdf.js';
import { Icons } from './components/icons';
import { EntryEditor } from './components/EntryEditor';
import { MeasurementRecorder } from './components/MeasurementRecorder';
import { CodeMeasurementRecorder } from './components/CodeMeasurementRecorder';
import { PreviewPage } from './components/PreviewPage';
import { getROCDate, compressImage } from './utils/helpers';

export default function App() {
    const [view, setView] = useState('photo'); 
    const [entries, setEntries] = useState(() => {
        try {
            const saved = localStorage.getItem('site_report_data');
            return saved ? JSON.parse(saved).map(e => ({...e, images: e.images || []})) : [{ id: Date.now(), date: getROCDate(), floor: '', direction: '', item: '', content: '', images: [] }];
        } catch {
            return [{ id: Date.now(), date: getROCDate(), floor: '', direction: '', item: '', content: '', images: [] }];
        }
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

    const generatePDF = () => {
        setIsGenerating(true);
        setTimeout(() => {
            const opt = { margin: 0, filename: `${reportTitle}_${getROCDate()}.pdf`, image: { type: 'jpeg', quality: 0.6 }, html2canvas: { scale: 1 }, jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' } };
            html2pdf().set(opt).from(reportRef.current).save().then(() => setIsGenerating(false));
        }, 800);
    };

    const generateImage = async () => {
        setIsGenerating(true);
        try {
            const filesToShare = [];

            for (let i = 0; i < entries.length; i++) {
                const entry = entries[i];
                if (!entry.images || entry.images.length === 0) continue;
                
                const watermarkText = [entry.date, entry.floor, entry.direction, entry.item].filter(Boolean).join('-');
                
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
                        const filename = `${watermarkText ? watermarkText.replace(/[\/\\?%*:|"<>]/g, '-') : '現場照片'}_${i+1}_${j+1}.jpg`;
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

    return (
        <div className="min-h-screen bg-gray-100 p-2 md:p-8 font-sans text-gray-800">
            <div className="max-w-6xl mx-auto mb-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div className="flex flex-col gap-2">
                    <h1 className="text-2xl font-bold flex items-center gap-2">🏗️ PRO事一堆</h1>
                    <div className="flex items-center gap-4 flex-wrap">
                        <div className="flex bg-gray-200 p-1 rounded-lg shadow-inner gap-1 flex-wrap">
                            <button onClick={()=>setView('photo')} className={`px-4 py-1 text-xs rounded-md transition-all ${view==='photo'?'bg-white shadow text-blue-600 font-bold':'text-gray-500 hover:text-gray-700'}`}>照片黏貼</button>
                            <button onClick={()=>setView('dimension')} className={`px-4 py-1 text-xs rounded-md transition-all ${view==='dimension'?'bg-white shadow text-blue-600 font-bold':'text-gray-500 hover:text-gray-700'}`}>四周量測</button>
                            <button onClick={()=>setView('twoSide')} className={`px-4 py-1 text-xs rounded-md transition-all ${view==='twoSide'?'bg-white shadow text-blue-600 font-bold':'text-gray-500 hover:text-gray-700'}`}>兩側量測</button>
                            <button onClick={()=>setView('code')} className={`px-4 py-1 text-xs rounded-md transition-all ${view==='code'?'bg-white shadow text-blue-600 font-bold':'text-gray-500 hover:text-gray-700'}`}>代號量測</button>
                        </div>
                        {view === 'photo' && <div className="flex items-center gap-2 border-b border-gray-400 pb-0.5 font-bold font-sans italic"><label className="text-xs text-gray-500">標題:</label><input type="text" value={reportTitle} onChange={e=>setReportTitle(e.target.value)} className="bg-transparent outline-none w-32" /></div>}
                    </div>
                </div>
                {view === 'photo' && (
                    <div className="flex gap-2">
                        <button onClick={() => { localStorage.clear(); window.location.reload(); }} className="text-xs text-red-400 px-2 font-bold font-sans">重置</button>
                        <button onClick={() => setEntries([...entries, {id: Date.now(), date: getROCDate(), floor:'', direction:'', item:'', content:'', images:[] }])} className="px-4 py-2 bg-white border border-gray-300 rounded-lg text-xs font-bold shadow">+ 新增單筆</button>
                        <button onClick={generateImage} className="px-4 py-2 bg-purple-600 text-white rounded-lg text-xs font-bold shadow">輸出圖片</button>
                        <button onClick={generatePDF} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-xs font-bold shadow">生成 PDF</button>
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
            ) : view === 'twoSide' ? (
                <MeasurementRecorder key="twoSide" defaultTitle="兩側量測尺寸" mode="widthOnly" />
            ) : (
                <CodeMeasurementRecorder key="codeMeasure" defaultTitle="代號量測尺寸" />
            )}
            
            {(isProcessing || isGenerating) && <div className="fixed inset-0 bg-black/60 z-50 flex flex-col items-center justify-center font-bold text-white backdrop-blur-sm shadow-2xl font-sans"><Icons.Loader />處理中，請稍候...</div>}
        </div>
    );
}