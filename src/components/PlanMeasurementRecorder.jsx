import { useState, useRef } from 'react';
import html2pdf from 'html2pdf.js';
import { getROCDate, compressImage } from '../utils/helpers';

const ALL_LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');

const generateNextCode = (existing) => {
    for (const l of ALL_LETTERS) if (!existing.includes(l)) return l;
    for (const a of ALL_LETTERS)
        for (const b of ALL_LETTERS) {
            const code = a + b;
            if (!existing.includes(code)) return code;
        }
    return `X${existing.length}`;
};

export const PlanMeasurementRecorder = ({ defaultTitle }) => {
    const [dimTitle, setDimTitle] = useState(defaultTitle);
    const [refImage, setRefImage] = useState(null);
    const [codes, setCodes] = useState(['A', 'B', 'C']);
    const [values, setValues] = useState({});
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
        }
        e.target.value = '';
    };

    const addNewCode = () => {
        const next = generateNextCode(codes);
        setCodes([...codes, next]);
    };

    const removeLastCode = () => {
        if (codes.length <= 1) return;
        const removed = codes[codes.length - 1];
        setCodes(codes.slice(0, -1));
        setValues(prev => { const next = { ...prev }; delete next[removed]; return next; });
    };

    const copyFromPrev = (idx) => {
        if (idx === 0) return;
        const prevCode = codes[idx - 1];
        const prevVal = values[prevCode];
        if (prevVal !== undefined && prevVal !== '') {
            setValues(prev => ({ ...prev, [codes[idx]]: prevVal }));
        }
    };

    const resetValues = () => setValues({});

    const exportExcel = () => {
        const rows = codes.map(c => [c, values[c] || '']);
        const csvContent = '﻿代號,數值(mm)\n' + rows.map(r => r.join(',')).join('\n');
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `${dimTitle}_${getROCDate()}.csv`;
        link.click();
    };

    const generatePDF = () => {
        setIsGenerating(true);
        const opt = {
            margin: 10,
            filename: `${dimTitle}_${getROCDate()}.pdf`,
            image: { type: 'jpeg', quality: 0.7 },
            html2canvas: { scale: 1.5 },
            jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
        };
        html2pdf().set(opt).from(pdfRef.current).save().then(() => setIsGenerating(false));
    };

    return (
        <div className="w-full md:max-w-6xl mx-auto p-2 md:p-4 bg-white rounded-xl shadow-lg min-h-[80vh] font-sans animate-in fade-in">
            {/* Header */}
            <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between mb-6 border-b pb-4">
                <input type="text" value={dimTitle} onChange={e => setDimTitle(e.target.value)} className="text-xl font-bold text-blue-800 border-2 border-blue-600 rounded px-3 py-2 outline-none shadow-sm w-full md:w-auto flex-grow" />
                <div className="flex flex-wrap gap-2 items-center justify-end w-full md:w-auto">
                    <button onClick={resetValues} className="text-sm text-red-500 font-bold border border-red-500 px-3 py-1.5 rounded hover:bg-red-50 transition-colors">重置</button>
                    <button onClick={generatePDF} disabled={isGenerating} className="bg-gray-800 text-white px-4 py-2 rounded-lg font-bold text-xs shadow-md disabled:bg-gray-400">{isGenerating ? '生成中...' : '生成 PDF'}</button>
                    <button onClick={exportExcel} className="bg-green-600 text-white px-4 py-2 rounded-lg font-bold text-xs shadow-md">生成 Excel</button>
                </div>
            </div>

            {/* Image Upload */}
            <div className="mb-6 w-full max-w-3xl mx-auto max-h-[40vh] aspect-video border-2 border-dashed border-gray-300 rounded-xl flex items-center justify-center overflow-hidden bg-gray-50 relative group">
                {refImage ? (
                    <>
                        <img src={refImage} alt="Reference" className="w-full h-full object-contain" />
                        <button onClick={() => setRefImage(null)} className="absolute top-2 right-2 bg-red-500 text-white px-3 py-1 rounded shadow text-xs font-bold hover:bg-red-600 opacity-0 group-hover:opacity-100 transition-opacity">移除圖片</button>
                    </>
                ) : (
                    <div className="flex flex-col items-center pointer-events-none">
                        <span className="text-gray-400 mb-2 font-bold font-sans">點擊上傳示意圖 (可略)</span>
                    </div>
                )}
                {!refImage && <input type="file" accept="image/*" onChange={handleImageUpload} className="absolute inset-0 opacity-0 cursor-pointer w-full h-full" />}
            </div>

            {/* Code Inputs */}
            <div className="bg-gray-50 p-4 md:p-6 rounded-3xl border shadow-inner">
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 mb-4">
                    {codes.map((c, idx) => (
                        <div key={c} className="flex flex-col gap-1 border border-gray-100 rounded-xl p-3 bg-white shadow-sm">
                            <span className="font-black text-lg text-gray-700">{c}:</span>
                            <input
                                type="number"
                                inputMode="decimal"
                                enterKeyHint="done"
                                value={values[c] || ''}
                                onChange={e => setValues(prev => ({ ...prev, [c]: e.target.value }))}
                                placeholder="尺寸"
                                className="w-full border-2 border-gray-300 rounded-lg p-2 text-center text-lg font-bold focus:border-blue-500 outline-none bg-white"
                            />
                            <div className="flex justify-end pt-1">
                                <button
                                    onClick={() => copyFromPrev(idx)}
                                    disabled={idx === 0}
                                    className="text-[10px] bg-gray-200 text-gray-600 font-bold px-2 py-1 rounded hover:bg-gray-300 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                                >↑ 上欄相同</button>
                            </div>
                        </div>
                    ))}
                </div>
                <div className="flex items-center justify-between border-t border-gray-200 pt-4 flex-wrap gap-2">
                    <div className="flex gap-2">
                        <button onClick={addNewCode} className="text-xs bg-gray-800 text-white font-bold px-3 py-2 rounded-lg hover:bg-gray-700">+ 新增欄位</button>
                        <button onClick={removeLastCode} disabled={codes.length <= 1} className="text-xs bg-red-100 text-red-600 font-bold px-3 py-2 rounded-lg hover:bg-red-200 disabled:opacity-50">- 移除欄位</button>
                    </div>
                    <span className="text-[10px] text-gray-400">A–Z 後接 AA, AB…</span>
                </div>
            </div>

            {/* PDF Hidden Area */}
            <div style={{ position: 'absolute', left: '-9999px', top: '-9999px', pointerEvents: 'none' }}>
                <div ref={pdfRef} style={{ padding: '20mm', backgroundColor: 'white', color: 'black', width: '210mm', minHeight: '297mm' }}>
                    <h1 style={{ textAlign: 'center', fontSize: '24pt', marginBottom: '15px', fontWeight: 'bold' }}>{dimTitle}表 (單位: mm)</h1>
                    {refImage && (
                        <div style={{ width: '100%', height: '80mm', display: 'flex', justifyContent: 'center', marginBottom: '20px' }}>
                            <img src={refImage} style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} alt="Reference" />
                        </div>
                    )}
                    <table style={{ width: '50%', margin: '0 auto', borderCollapse: 'collapse', border: '2px solid black' }}>
                        <thead>
                            <tr style={{ backgroundColor: '#f0f0f0' }}>
                                <th style={{ border: '2px solid black', padding: '8px', width: '80px', textAlign: 'center' }}>代號</th>
                                <th style={{ border: '2px solid black', padding: '8px', textAlign: 'center' }}>數值 (mm)</th>
                            </tr>
                        </thead>
                        <tbody>
                            {codes.map(c => (
                                <tr key={c}>
                                    <td style={{ border: '1px solid black', padding: '8px', textAlign: 'center', fontWeight: 'bold' }}>{c}</td>
                                    <td style={{ border: '1px solid black', padding: '8px', textAlign: 'center', fontWeight: 'bold' }}>{values[c] || ''}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {isGenerating && <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center font-bold text-white backdrop-blur-sm">處理中，請稍候...</div>}
        </div>
    );
};
