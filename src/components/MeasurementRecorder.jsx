import { useState, useRef } from 'react';
import html2pdf from 'html2pdf.js';
import { FLOOR_OPTIONS } from '../utils/constants';
import { getROCDate } from '../utils/helpers';

const TripleToggle = ({ current, setter, colorClass }) => (
    <div className="flex flex-col gap-2 w-full">
        {['兩側粉刷', '兩側磁磚', '單邊磁磚'].map(label => (
            <button key={label} onClick={() => setter(label)} className={`py-3.5 px-2 rounded-xl text-base font-black border-2 transition-all active:scale-95 shadow-sm ${current === label ? `${colorClass} text-white border-transparent ring-2 ring-offset-1` : 'bg-white text-gray-500 border-gray-200'}`}>{label}</button>
        ))}
    </div>
);

export const MeasurementRecorder = ({ defaultTitle, mode = 'full' }) => {
    const isFull = mode === 'full';
    const [tableData, setTableData] = useState([]);
    const [dimTitle, setDimTitle] = useState(defaultTitle);
    const [form, setForm] = useState({ direction: '北', floor: '1F', length: '', width: '', thickness: '8' });
    const [lMode, setLMode] = useState('兩側粉刷');
    const [wMode, setWMode] = useState('兩側粉刷');
    const [isGenerating, setIsGenerating] = useState(false);
    const lengthInputRef = useRef();
    const widthInputRef = useRef();
    const pdfRef = useRef();

    const calcFinal = (base, measureMode) => {
        const val = parseFloat(base) || 0;
        const thick = parseFloat(form.thickness) || 0;
        if (measureMode === '兩側粉刷') return val - (thick * 2);
        if (measureMode === '單邊磁磚') return val - thick;
        return val;
    };

    const addRow = () => {
        if (isFull && (!form.length || !form.width)) return;
        if (!isFull && !form.width) return;
        const finalW = calcFinal(form.width, wMode);
        const statusStr = isFull ? `長:${lMode} 寬:${wMode}` : `寬:${wMode}`;
        const newEntry = { id: Date.now(), direction: form.direction, floor: form.floor, type: statusStr, measureW: form.width, finalW: finalW };
        if (isFull) { newEntry.measureL = form.length; newEntry.finalL = calcFinal(form.length, lMode); }
        setTableData([...tableData, newEntry]);
        setForm({...form, length: '', width: ''});
        if (isFull) lengthInputRef.current?.focus();
        else widthInputRef.current?.focus();
    };

    const clearTable = () => { setTableData([]); };

    const exportExcel = () => {
        if(tableData.length === 0) return;
        const headers = isFull ? ["#", "方位", "樓層", "狀態", "量測-長", "量測-寬", "最終-長", "最終-寬"] : ["#", "方位", "樓層", "狀態", "量測-寬", "最終-寬"];
        const rows = tableData.map((r, i) => isFull ? [i+1, r.direction, r.floor, r.type, r.measureL, r.measureW, r.finalL, r.finalW] : [i+1, r.direction, r.floor, r.type, r.measureW, r.finalW]);
        const csvContent = "\uFEFF" + headers.join(",") + "\n" + rows.map(e => e.join(",")).join("\n");
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement("a");
        link.href = URL.createObjectURL(blob);
        link.download = `${dimTitle}_${getROCDate()}.csv`;
        link.click();
    };

    const generatePDF = () => {
        if(tableData.length === 0) return;
        setIsGenerating(true);
        const opt = { margin: 10, filename: `${dimTitle}_${getROCDate()}.pdf`, image: { type: 'jpeg', quality: 0.6 }, html2canvas: { scale: 1 }, jsPDF: { unit: 'mm', format: 'a4', orientation: isFull ? 'landscape' : 'portrait' } };
        html2pdf().set(opt).from(pdfRef.current).save().then(() => setIsGenerating(false));
    };

    return (
        <div className="w-full md:max-w-6xl mx-auto p-2 md:p-4 bg-white rounded-xl shadow-lg min-h-[80vh] font-sans animate-in fade-in">
            <div className="mb-4">
                <input type="text" value={dimTitle} onChange={(e) => setDimTitle(e.target.value)} className="w-full text-xl font-bold text-blue-800 border-2 border-blue-600 rounded px-3 py-2 outline-none shadow-sm" />
            </div>
            <div className="flex flex-wrap gap-2 md:gap-4 items-center justify-end mb-6 border-b pb-4">
                <button onClick={clearTable} className="text-sm text-red-500 font-bold border border-red-500 px-3 py-1.5 rounded hover:bg-red-50 transition-colors flex-grow md:flex-grow-0 text-center">重置表格</button>
                <button onClick={generatePDF} disabled={isGenerating} className="bg-gray-800 text-white px-4 py-2 rounded-lg font-bold text-xs shadow-md flex-grow md:flex-grow-0 text-center">{isGenerating ? '生成中...' : '生成 PDF'}</button>
                <button onClick={exportExcel} className="bg-green-600 text-white px-4 py-2 rounded-lg font-bold text-xs shadow-md flex-grow md:flex-grow-0 text-center">生成 Excel</button>
            </div>

            <div className="border-2 border-black rounded overflow-x-auto mb-6 shadow-sm">
                <table className="w-full text-center border-collapse text-sm">
                    <thead className="bg-gray-100 border-b-2 border-black font-bold divide-x-2 divide-black">
                        <tr>
                            <th className="py-2 w-10">#</th><th className="py-2 w-16">方位</th><th className="py-2 w-20">樓層</th><th className="py-2">狀態</th>
                            {isFull && <th className="py-2">量測-長</th>}<th className="py-2">量測-寬</th>
                            {isFull && <th className="py-2 bg-blue-50 text-blue-800 font-bold">長</th>}
                            <th className="py-2 bg-blue-50 text-blue-800 font-bold">寬</th><th className="w-10"></th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-black font-bold text-gray-800 text-base text-center">
                        {tableData.map((r, i) => (
                            <tr key={r.id} className="divide-x divide-black transition-colors hover:bg-gray-50">
                                <td>{i + 1}</td><td>{r.direction}</td><td>{r.floor}</td><td className="text-[10px] text-gray-500 font-normal leading-tight">{r.type}</td>
                                {isFull && <td>{r.measureL}</td>}<td>{r.measureW}</td>
                                {isFull && <td className="bg-blue-50/30 text-blue-600 font-black">{r.finalL}</td>}
                                <td className="bg-blue-50/30 text-blue-600 font-black">{r.finalW}</td>
                                <td><button onClick={()=>setTableData(tableData.filter(x=>x.id!==r.id))} className="text-red-500 font-bold px-1">×</button></td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-6 bg-gray-50 p-4 md:p-6 rounded-3xl border shadow-inner">
                <div className="flex flex-col items-center justify-center space-y-6 lg:border-r lg:pr-6">
                    <div className="grid grid-cols-3 gap-3">
                        {['北', '西', '東', '南'].map((d) => (
                            <div key={d} className={`${d==='北'?'col-start-2':d==='西'?'col-start-1 row-start-2':d==='東'?'col-start-3 row-start-2':'col-start-2 row-start-3'}`}>
                                <button onClick={()=>setForm({...form, direction:d})} className={`w-14 h-14 rounded-full border-4 font-black transition-all active:scale-90 ${form.direction===d?'bg-blue-600 text-white border-blue-800 shadow-lg':'bg-white text-gray-300 border-gray-200'}`}>{d}</button>
                            </div>
                        ))}
                        <div className="col-start-2 row-start-2 flex items-center justify-center"><div className="w-3 h-3 bg-black rounded-full shadow-sm"></div></div>
                    </div>
                    <div className="flex items-center gap-2 bg-white px-4 py-2 rounded-xl border-2 border-gray-200 shadow-sm"><span className="text-xs font-black text-gray-500">磁磚厚度:</span><input type="text" value={form.thickness} onChange={e=>setForm({...form, thickness:e.target.value})} className="w-12 text-center font-black text-blue-600 text-lg outline-none" /></div>
                </div>
                <div className="flex flex-col items-center justify-center space-y-4 lg:border-r lg:pr-6">
                    <div className={`grid ${isFull ? 'grid-cols-2' : 'grid-cols-1'} gap-4 w-full h-full items-center`}>
                        {isFull && (<div className="space-y-2 flex flex-col items-center"><span className="text-xs font-black text-blue-600 underline">量測長度設定</span><TripleToggle current={lMode} setter={setLMode} colorClass="bg-blue-600 shadow-blue-200" /></div>)}
                        <div className="space-y-2 flex flex-col items-center"><span className="text-xs font-black text-green-600 underline">量測寬度設定</span><TripleToggle current={wMode} setter={setWMode} colorClass="bg-green-600 shadow-green-200" /></div>
                    </div>
                </div>
                <div className="space-y-4 flex flex-col justify-center">
                    <select value={form.floor} onChange={e=>setForm({...form, floor:e.target.value})} className="w-full border-2 border-gray-300 rounded-2xl p-4 font-black bg-white focus:border-blue-500 shadow-sm text-lg outline-none font-bold">{FLOOR_OPTIONS.map(f=><option key={f} value={f}>{f}</option>)}</select>
                    <div className="space-y-3">
                        {isFull && (<input ref={lengthInputRef} type="number" placeholder="量測-長 (mm)" value={form.length} onChange={e=>setForm({...form, length:e.target.value})} onKeyDown={(e) => { if(e.key === 'Enter') widthInputRef.current?.focus(); }} className="w-full border-2 border-gray-300 rounded-2xl p-4 text-center text-2xl font-bold focus:border-blue-500 outline-none" />)}
                        <input ref={widthInputRef} type="number" placeholder="量測-寬 (mm)" value={form.width} onChange={e=>setForm({...form, width:e.target.value})} onKeyDown={(e) => { if(e.key === 'Enter') addRow(); }} className="w-full border-2 border-gray-300 rounded-2xl p-4 text-center text-2xl font-bold focus:border-blue-500 outline-none" />
                    </div>
                    <button onClick={addRow} className="w-full bg-blue-600 text-white py-5 rounded-2xl font-black text-2xl hover:bg-blue-700 shadow-xl active:scale-95 transition-all">登入下一筆</button>
                </div>
            </div>
            {/* PDF 隱藏區域 */}
            <div style={{ position: 'absolute', left: '-9999px', top: '-9999px', pointerEvents: 'none' }}>
                <div ref={pdfRef} style={{ padding: '20mm', backgroundColor: 'white', color: 'black', width: isFull ? '277mm' : '210mm', minHeight: '297mm' }}>
                    <h1 style={{ textAlign: 'center', fontSize: '26pt', marginBottom: '30px', fontWeight: 'bold' }}>{dimTitle}表 (單位: mm)</h1>
                    <table style={{ width: '100%', borderCollapse: 'collapse', border: '2px solid black', tableLayout: 'fixed' }}>
                        <thead>
                            <tr style={{ backgroundColor: '#f0f0f0' }}>
                                <th style={{ border: '2px solid black', padding: '10px' }}>#</th><th style={{ border: '2px solid black', padding: '10px' }}>方位</th><th style={{ border: '2px solid black', padding: '10px' }}>樓層</th><th style={{ border: '2px solid black', padding: '10px' }}>狀態</th>
                                {isFull && <th style={{ border: '2px solid black', padding: '10px' }}>量測-長</th>}<th style={{ border: '2px solid black', padding: '10px' }}>量測-寬</th>
                                {isFull && <th style={{ border: '2px solid black', padding: '10px' }}>最終長</th>}<th style={{ border: '2px solid black', padding: '10px' }}>最終寬</th>
                            </tr>
                        </thead>
                        <tbody>
                            {tableData.map((r, i) => (
                                <tr key={r.id}>
                                    <td style={{ border: '1px solid black', padding: '8px', textAlign: 'center' }}>{i + 1}</td><td style={{ border: '1px solid black', padding: '8px', textAlign: 'center' }}>{r.direction}</td><td style={{ border: '1px solid black', padding: '8px', textAlign: 'center' }}>{r.floor}</td><td style={{ border: '1px solid black', padding: '8px', textAlign: 'center', fontSize: '10px' }}>{r.type}</td>
                                    {isFull && <td style={{ border: '1px solid black', padding: '8px', textAlign: 'center' }}>{r.measureL}</td>}
                                    <td style={{ border: '1px solid black', padding: '8px', textAlign: 'center' }}>{r.measureW}</td>
                                    {isFull && <td style={{ border: '1px solid black', padding: '8px', textAlign: 'center', fontWeight: 'bold' }}>{r.finalL}</td>}
                                    <td style={{ border: '1px solid black', padding: '8px', textAlign: 'center', fontWeight: 'bold' }}>{r.finalW}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};
