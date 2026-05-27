import { useState, useRef } from 'react';
import html2pdf from 'html2pdf.js';
import { FLOOR_OPTIONS } from '../utils/constants';
import { getROCDate, compressImage } from '../utils/helpers';

export const CodeMeasurementRecorder = ({ defaultTitle }) => {
    const [dimTitle, setDimTitle] = useState(defaultTitle);
    const [refImage, setRefImage] = useState(null);
    const [codes, setCodes] = useState(['A', 'B', 'C']);
    const [tableData, setTableData] = useState([]);
    const [form, setForm] = useState({ direction: '北', floor: '1F', values: {} });
    const [isGenerating, setIsGenerating] = useState(false);
    const pdfRef = useRef();

    const handleImageUpload = async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        try {
            const preview = await compressImage(file, 1200, 0.8);
            setRefImage(preview);
        } catch (err) {
            console.error(err);
            alert("圖片處理失敗！");
        }
        e.target.value = '';
    };

    const addNewCode = () => {
        const letters = "ABCDEFGHJKLMNPQRSTUVWXYZ".split('');
        const nextCode = letters.find(l => !codes.includes(l));
        if (nextCode) {
            setCodes([...codes, nextCode]);
        } else {
            setCodes([...codes, `C${codes.length}`]);
        }
    };

    const removeLastCode = () => {
        if (codes.length > 1) {
            setCodes(codes.slice(0, -1));
        }
    };

    const copyPrevious = (code) => {
        if (tableData.length === 0) return alert("沒有上一筆資料！");
        const lastVal = tableData[tableData.length - 1].values[code];
        if (lastVal !== undefined && lastVal !== '') {
            setForm(prev => ({ ...prev, values: { ...prev.values, [code]: lastVal } }));
        }
    };

    const addRow = () => {
        const hasAnyValue = codes.some(c => form.values[c]?.trim());
        if (!hasAnyValue) return alert("請至少輸入一個代號的尺寸！");
        
        const newEntry = { 
            id: Date.now(), 
            direction: form.direction, 
            floor: form.floor, 
            values: { ...form.values }
        };
        setTableData([...tableData, newEntry]);
        setForm(prev => ({ ...prev, values: {} }));
    };

    const clearTable = () => { if(confirm(`確定要重置表格資料嗎？`)) setTableData([]); };

    const exportExcel = () => {
        if(tableData.length === 0) return alert("沒數據！");
        const headers = ["#", "方位", "樓層", ...codes];
        const rows = tableData.map((r, i) => [i+1, r.direction, r.floor, ...codes.map(c => r.values[c] || '')]);
        const csvContent = "\uFEFF" + headers.join(",") + "\n" + rows.map(e => e.join(",")).join("\n");
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement("a");
        link.href = URL.createObjectURL(blob);
        link.download = `${dimTitle}_${getROCDate()}.csv`;
        link.click();
    };

    const generatePDF = () => {
        if(tableData.length === 0) return alert("沒數據！");
        setIsGenerating(true);
        const opt = { 
            margin: 10, 
            filename: `${dimTitle}_${getROCDate()}.pdf`, 
            image: { type: 'jpeg', quality: 0.98 }, 
            html2canvas: { scale: 2 }, 
            jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' } 
        };
        html2pdf().set(opt).from(pdfRef.current).save().then(() => setIsGenerating(false));
    };

    return (
        <div className="w-full md:max-w-6xl mx-auto p-2 md:p-4 bg-white rounded-xl shadow-lg min-h-[80vh] font-sans animate-in fade-in">
            {/* Header / Actions */}
            <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between mb-6 border-b pb-4">
                <input type="text" value={dimTitle} onChange={(e) => setDimTitle(e.target.value)} className="text-xl font-bold text-blue-800 border-2 border-blue-600 rounded px-3 py-2 outline-none shadow-sm w-full md:w-auto flex-grow" />
                <div className="flex flex-wrap gap-2 md:gap-4 items-center justify-end w-full md:w-auto">
                    <button onClick={clearTable} className="text-sm text-red-500 font-bold border border-red-500 px-3 py-1.5 rounded hover:bg-red-50 transition-colors">重置表格</button>
                    <button onClick={generatePDF} disabled={isGenerating} className="bg-gray-800 text-white px-4 py-2 rounded-lg font-bold text-xs shadow-md disabled:bg-gray-400">{isGenerating ? '生成中...' : '生成 PDF'}</button>
                    <button onClick={exportExcel} className="bg-green-600 text-white px-4 py-2 rounded-lg font-bold text-xs shadow-md">生成 Excel</button>
                </div>
            </div>

            {/* Image Preview Area */}
            <div className="mb-6 w-full max-w-3xl mx-auto max-h-[40vh] aspect-video border-2 border-dashed border-gray-300 rounded-xl flex items-center justify-center overflow-hidden bg-gray-50 relative group">
                {refImage ? (
                    <>
                        <img src={refImage} alt="Reference" className="w-full h-full object-contain" />
                        <button onClick={() => setRefImage(null)} className="absolute top-2 right-2 bg-red-500 text-white px-3 py-1 rounded shadow text-xs font-bold hover:bg-red-600 opacity-0 group-hover:opacity-100 transition-opacity">移除圖片</button>
                    </>
                ) : (
                    <div className="flex flex-col items-center">
                        <span className="text-gray-400 mb-2 font-bold font-sans">點擊上傳示意圖 (可略)</span>
                        <input type="file" accept="image/*" onChange={handleImageUpload} className="absolute inset-0 opacity-0 cursor-pointer w-full h-full" />
                    </div>
                )}
            </div>

            {/* Data Table */}
            <div className="border-2 border-black rounded overflow-x-auto mb-6 shadow-sm">
                <table className="w-full text-center border-collapse text-sm">
                    <thead className="bg-gray-100 border-b-2 border-black font-bold divide-x-2 divide-black">
                        <tr>
                            <th className="py-2 w-10">#</th>
                            <th className="py-2 w-16">方位</th>
                            <th className="py-2 w-20">樓層</th>
                            {codes.map(c => (
                                <th key={c} className="py-2 min-w-[60px] text-blue-800 bg-blue-50/50">{c}</th>
                            ))}
                            <th className="w-10"></th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-black font-bold text-gray-800 text-base text-center">
                        {tableData.length === 0 && (
                            <tr><td colSpan={codes.length + 4} className="py-4 text-gray-400 font-normal">尚無資料</td></tr>
                        )}
                        {tableData.map((r, i) => (
                            <tr key={r.id} className="divide-x divide-black transition-colors hover:bg-gray-50">
                                <td>{i + 1}</td>
                                <td>{r.direction}</td>
                                <td>{r.floor}</td>
                                {codes.map(c => (
                                    <td key={c} className="text-blue-600">{r.values[c] || '-'}</td>
                                ))}
                                <td><button onClick={()=>setTableData(tableData.filter(x=>x.id!==r.id))} className="text-red-500 font-bold px-1 hover:text-red-700">×</button></td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* Input Form */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-6 bg-gray-50 p-4 md:p-6 rounded-3xl border shadow-inner">
                {/* 方位選擇 */}
                <div className="flex flex-col items-center justify-center space-y-6 lg:border-r lg:pr-6">
                    <div className="grid grid-cols-3 gap-3">
                        {['北', '西', '東', '南'].map((d) => (
                            <div key={d} className={`${d==='北'?'col-start-2':d==='西'?'col-start-1 row-start-2':d==='東'?'col-start-3 row-start-2':'col-start-2 row-start-3'}`}>
                                <button onClick={()=>setForm({...form, direction:d})} className={`w-14 h-14 rounded-full border-4 font-black transition-all active:scale-90 ${form.direction===d?'bg-blue-600 text-white border-blue-800 shadow-lg':'bg-white text-gray-300 border-gray-200 hover:border-gray-300'}`}>{d}</button>
                            </div>
                        ))}
                        <div className="col-start-2 row-start-2 flex items-center justify-center"><div className="w-3 h-3 bg-black rounded-full shadow-sm"></div></div>
                    </div>
                </div>

                {/* 尺寸輸入與樓層按鈕 */}
                <div className="flex flex-col space-y-6 lg:col-span-2 justify-center">
                    <div className="flex flex-col sm:flex-row gap-4 items-end">
                        <div className="w-full sm:w-1/3">
                            <label className="block text-xs font-black text-gray-500 mb-1 ml-1">選擇樓層</label>
                            <select value={form.floor} onChange={e=>setForm({...form, floor:e.target.value})} className="w-full border-2 border-gray-300 rounded-2xl p-4 font-black bg-white focus:border-blue-500 shadow-sm text-lg outline-none">
                                {FLOOR_OPTIONS.map(f=><option key={f} value={f}>{f}</option>)}
                            </select>
                        </div>
                        <button onClick={addRow} className="w-full sm:w-2/3 bg-blue-600 text-white py-4 rounded-2xl font-black text-2xl hover:bg-blue-700 shadow-xl active:scale-95 transition-all">登入下一筆</button>
                    </div>
                    
                    <div className="bg-white p-4 rounded-2xl border shadow-sm">
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                            {codes.map(c => (
                                <div key={c} className="flex flex-col gap-1 border border-gray-100 rounded-xl p-2 bg-gray-50">
                                    <div className="flex items-center gap-2">
                                        <span className="font-black text-xl w-6 text-center text-gray-700">{c}:</span>
                                        <input type="number" value={form.values[c] || ''} onChange={e => setForm({...form, values: {...form.values, [c]: e.target.value}})} onKeyDown={(e) => { if(e.key === 'Enter') addRow(); }} placeholder="尺寸" className="flex-1 w-full border-2 border-gray-300 rounded-lg p-2 text-center text-lg font-bold focus:border-blue-500 outline-none bg-white" />
                                    </div>
                                    <div className="flex justify-end pt-1">
                                        <button onClick={() => copyPrevious(c)} className="text-[10px] bg-gray-200 text-gray-600 font-bold px-2 py-1 rounded hover:bg-gray-300 transition-colors">↑ 上筆相同</button>
                                    </div>
                                </div>
                            ))}
                        </div>
                        
                        <div className="flex items-center justify-between pt-4 mt-4 border-t border-gray-100 flex-wrap gap-2">
                            <div className="flex gap-2">
                                <button onClick={addNewCode} className="text-xs bg-gray-800 text-white font-bold px-3 py-2 rounded-lg hover:bg-gray-700">+ 新增欄位</button>
                                <button onClick={removeLastCode} disabled={codes.length <= 1} className="text-xs bg-red-100 text-red-600 font-bold px-3 py-2 rounded-lg hover:bg-red-200 disabled:opacity-50">- 移除欄位</button>
                            </div>
                            <span className="text-[10px] text-gray-400">依序新增欄位, 跳過 O 跟 I</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* PDF Generate Area (Hidden) */}
            <div style={{ position: 'absolute', left: '-9999px', top: '-9999px', pointerEvents: 'none' }}>
                <div ref={pdfRef} style={{ padding: '20mm', backgroundColor: 'white', color: 'black', width: '210mm', minHeight: '297mm' }}>
                    <h1 style={{ textAlign: 'center', fontSize: '24pt', marginBottom: '15px', fontWeight: 'bold' }}>{dimTitle}表 (單位: mm)</h1>
                    {refImage && (
                        <div style={{ width: '100%', height: '80mm', display: 'flex', justifyContent: 'center', marginBottom: '20px' }}>
                            <img src={refImage} style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} alt="Reference" />
                        </div>
                    )}
                    <table style={{ width: '100%', borderCollapse: 'collapse', border: '2px solid black', tableLayout: 'fixed' }}>
                        <thead>
                            <tr style={{ backgroundColor: '#f0f0f0' }}>
                                <th style={{ border: '2px solid black', padding: '8px', width: '40px' }}>#</th>
                                <th style={{ border: '2px solid black', padding: '8px', width: '60px' }}>方位</th>
                                <th style={{ border: '2px solid black', padding: '8px', width: '70px' }}>樓層</th>
                                {codes.map(c => <th key={c} style={{ border: '2px solid black', padding: '8px' }}>{c}</th>)}
                            </tr>
                        </thead>
                        <tbody>
                            {tableData.map((r, i) => (
                                <tr key={r.id}>
                                    <td style={{ border: '1px solid black', padding: '6px', textAlign: 'center' }}>{i + 1}</td>
                                    <td style={{ border: '1px solid black', padding: '6px', textAlign: 'center' }}>{r.direction}</td>
                                    <td style={{ border: '1px solid black', padding: '6px', textAlign: 'center' }}>{r.floor}</td>
                                    {codes.map(c => <td key={c} style={{ border: '1px solid black', padding: '6px', textAlign: 'center', fontWeight: 'bold' }}>{r.values[c] || ''}</td>)}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
            
            {isGenerating && <div className="fixed inset-0 bg-black/60 z-50 flex flex-col items-center justify-center font-bold text-white backdrop-blur-sm shadow-2xl font-sans">處理中，請稍候...</div>}
        </div>
    );
};
