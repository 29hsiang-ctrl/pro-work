import { Icons } from './icons';
import { FLOOR_OPTIONS, ITEM_QUICK_SELECT, CHECK_OPTIONS } from '../utils/constants';

const DirectionBtn = ({ dir, label, currentDir, onChange, id }) => (
    <button onClick={() => onChange(id, 'direction', dir)} className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold border transition-all ${currentDir === dir ? 'bg-blue-600 text-white border-blue-600 shadow-sm' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-100'}`}>
        {label}
    </button>
);

export const EntryEditor = ({ entry, index, total, onMove, onRemove, onChange, onImageUpload, onRemoveImage }) => {
    return (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5 mb-4 font-sans">
            <div className="flex justify-between items-start mb-4">
                <span className="bg-blue-100 text-blue-800 text-xs font-bold px-2 py-1 rounded">#{index + 1}</span>
                <div className="flex gap-1">
                    <button onClick={() => onMove(index, 'up')} disabled={index === 0} className="p-1.5 text-gray-400 hover:text-blue-600 disabled:opacity-30 rounded"><Icons.MoveUp /></button>
                    <button onClick={() => onMove(index, 'down')} disabled={index === total - 1} className="p-1.5 text-gray-400 hover:text-blue-600 disabled:opacity-30 rounded"><Icons.MoveDown /></button>
                    <button onClick={() => onRemove(entry.id)} className="p-1.5 text-gray-400 hover:text-red-500 rounded ml-2"><Icons.Trash2 /></button>
                </div>
            </div>
            <div className="space-y-4">
                <div className="w-full">
                    <label className="block text-sm font-medium text-gray-700 mb-1">現場照片 ({entry.images?.length || 0}/2)</label>
                    <div className="grid grid-cols-2 gap-2 mb-2">
                        {entry.images?.map((img, idx) => (
                            <div key={idx} className="relative aspect-square border rounded-lg overflow-hidden">
                                <img src={img.preview} alt={`preview-${idx}`} className="w-full h-full object-cover" loading="lazy" />
                                <button onClick={() => onRemoveImage(entry.id, idx)} className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-1 opacity-80"><Icons.X /></button>
                            </div>
                        ))}
                    </div>
                    {(!entry.images || entry.images.length < 2) && (
                        <div className="relative h-24 border-2 border-dashed border-gray-300 rounded-lg flex flex-col items-center justify-center hover:border-blue-400 cursor-pointer">
                            <input type="file" accept="image/*" multiple onChange={(e) => onImageUpload(entry.id, e)} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10" />
                            <Icons.Plus /> <span className="text-xs text-gray-500">點擊上傳</span>
                        </div>
                    )}
                </div>
                <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1"><label className="text-xs font-bold text-gray-500 flex items-center gap-1"><Icons.Calendar /> 日期</label><input type="text" value={entry.date} onChange={(e) => onChange(entry.id, 'date', e.target.value)} className="w-full px-3 py-2 border rounded-lg text-sm outline-none shadow-sm" /></div>
                        <div className="space-y-1"><label className="text-xs font-bold text-gray-500 flex items-center gap-1"><Icons.Layers /> 樓層</label><select value={entry.floor} onChange={(e) => onChange(entry.id, 'floor', e.target.value)} className="w-full px-3 py-2 border rounded-lg text-sm bg-white shadow-sm font-bold"><option value="">選擇樓層...</option>{FLOOR_OPTIONS.map(f => <option key={f} value={f}>{f}</option>)}</select></div>
                    </div>
                    <div><label className="text-xs font-bold text-gray-500 mb-1">方位</label><div className="grid grid-cols-3 gap-1 w-fit border p-2 rounded-lg bg-gray-50 shadow-inner"><div className="col-start-2"><DirectionBtn currentDir={entry.direction} id={entry.id} onChange={onChange} dir="北" label="北" /></div><div className="col-start-1"><DirectionBtn currentDir={entry.direction} id={entry.id} onChange={onChange} dir="西" label="西" /></div><div className="col-start-2 flex justify-center items-center"><div className="w-1.5 h-1.5 rounded-full bg-gray-400"></div></div><div className="col-start-3"><DirectionBtn currentDir={entry.direction} id={entry.id} onChange={onChange} dir="東" label="東" /></div><div className="col-start-2"><DirectionBtn currentDir={entry.direction} id={entry.id} onChange={onChange} dir="南" label="南" /></div></div></div>
                    <div><div className="flex justify-between items-center mb-1"><label className="text-xs font-bold text-gray-500 flex items-center gap-1"><Icons.CheckSquare /> 項目</label><select className="text-xs border rounded p-1 bg-gray-50" onChange={(e) => {if(e.target.value) onChange(entry.id, 'item', e.target.value); e.target.value='';}}><option value="">快速選擇...</option>{ITEM_QUICK_SELECT.map(opt => <option key={opt} value={opt}>{opt}</option>)}</select></div><textarea value={entry.item} onChange={(e) => onChange(entry.id, 'item', e.target.value)} rows={2} className="w-full px-3 py-2 border rounded-lg text-sm outline-none resize-none shadow-sm font-bold" /></div>
                    <div><div className="flex justify-between items-center mb-1"><label className="text-xs font-bold text-gray-500 flex items-center gap-1"><Icons.FileText /> 查驗內容</label><select className="text-xs border rounded p-1 bg-gray-50" onChange={(e) => {if(e.target.value) onChange(entry.id, 'content', e.target.value); e.target.value='';}}><option value="">快速選擇...</option>{CHECK_OPTIONS.map(opt => <option key={opt} value={opt}>{opt}</option>)}</select></div><textarea value={entry.content} onChange={(e) => onChange(entry.id, 'content', e.target.value)} rows={2} className="w-full px-3 py-2 border rounded-lg text-sm outline-none resize-none shadow-sm font-bold" /></div>
                </div>
            </div>
        </div>
    );
};
