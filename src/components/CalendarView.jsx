import { useState, useEffect } from 'react';

const WEEKDAYS = ['日', '一', '二', '三', '四', '五', '六'];

function downloadImage(dataUrl, filename) {
    const a = document.createElement('a');
    a.href = dataUrl;
    a.download = filename;
    a.click();
}

function DownloadIcon() {
    return (
        <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M7 10l5 5 5-5M12 15V3" />
        </svg>
    );
}

function parseROCDate(str) {
    if (!str) return null;
    const parts = str.split('.');
    if (parts.length !== 3) return null;
    const y = parseInt(parts[0]);
    const m = parseInt(parts[1]);
    const d = parseInt(parts[2]);
    if (isNaN(y) || isNaN(m) || isNaN(d)) return null;
    return new Date(y + 1911, m - 1, d);
}

function sameDay(d1, d2) {
    return d1 && d2 &&
        d1.getFullYear() === d2.getFullYear() &&
        d1.getMonth() === d2.getMonth() &&
        d1.getDate() === d2.getDate();
}

function formatSelectedDate(date) {
    if (!date) return '';
    const weekdays = ['日', '一', '二', '三', '四', '五', '六'];
    return `${date.getFullYear()}年${String(date.getMonth() + 1).padStart(2, '0')}月${String(date.getDate()).padStart(2, '0')}日 (${weekdays[date.getDay()]})`;
}

export function CalendarView({ entries = [], onDeleteEntry, jumpDate, onJumped, onAddEntry, onRefresh }) {
    const today = new Date();
    const [year, setYear] = useState(today.getFullYear());
    const [month, setMonth] = useState(today.getMonth());
    const [selectedDate, setSelectedDate] = useState(today);

    useEffect(() => {
        if (!jumpDate) return;
        setYear(jumpDate.getFullYear());
        setMonth(jumpDate.getMonth());
        setSelectedDate(jumpDate);
        onJumped?.();
    }, [jumpDate]);

    const prevMonth = () => {
        if (month === 0) { setYear(y => y - 1); setMonth(11); }
        else setMonth(m => m - 1);
    };
    const nextMonth = () => {
        if (month === 11) { setYear(y => y + 1); setMonth(0); }
        else setMonth(m => m + 1);
    };

    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    // 計算每天有幾筆照片記錄
    const dotsByDay = {};
    entries.forEach(e => {
        const d = parseROCDate(e.date);
        if (d && d.getFullYear() === year && d.getMonth() === month) {
            const day = d.getDate();
            if (!dotsByDay[day]) dotsByDay[day] = [];
            dotsByDay[day].push(e);
        }
    });

    const selectedEntries = entries.filter(e => sameDay(parseROCDate(e.date), selectedDate));

    const selectedImages = selectedEntries
        .flatMap((e, ei) => (e.images || []).map((img, idx) => ({ dataUrl: img.preview, name: `${e.date}_${e.floor || ''}_${ei + 1}_${idx + 1}.jpg` })));

    const handleDownloadSelected = () => {
        selectedImages.forEach(({ dataUrl, name }, i) => setTimeout(() => downloadImage(dataUrl, name), i * 100));
    };

    const cells = [];
    for (let i = 0; i < firstDay; i++) cells.push(null);
    for (let d = 1; d <= daysInMonth; d++) cells.push(d);

    return (
        <div className="min-h-screen bg-white text-gray-800 font-sans">
            {/* 日期標題 */}
            <div className="px-5 pt-6 pb-2 flex items-center justify-between">
                <h2 className="text-xl font-bold text-gray-800">{formatSelectedDate(selectedDate)}</h2>
                <div className="flex items-center gap-2">
                {selectedImages.length > 0 && (
                    <button
                        onClick={handleDownloadSelected}
                        className="flex items-center gap-1.5 text-xs text-blue-500 hover:text-blue-700 px-3 py-1.5 border border-blue-200 hover:bg-blue-50 rounded-full transition-colors"
                    >
                        <DownloadIcon />下載照片 ({selectedImages.length})
                    </button>
                )}
                {onRefresh && (
                    <button onClick={onRefresh} className="text-xs text-gray-400 hover:text-gray-600 px-2 py-1.5 hover:bg-gray-100 rounded-full transition-colors" title="重新整理">
                        ↻
                    </button>
                )}
                </div>
            </div>

            {/* 月份導覽 */}
            <div className="flex items-center justify-between px-4 py-2">
                <button onClick={prevMonth} className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-gray-100 transition-colors">
                    <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7"/></svg>
                </button>
                <span className="text-base font-semibold text-gray-700">{year}年 {month + 1}月</span>
                <button onClick={nextMonth} className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-gray-100 transition-colors">
                    <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7"/></svg>
                </button>
            </div>

            {/* 星期標題 */}
            <div className="grid grid-cols-7 px-2">
                {WEEKDAYS.map(w => (
                    <div key={w} className="text-center text-xs text-gray-400 py-2 font-medium">{w}</div>
                ))}
            </div>

            {/* 日期格子 */}
            <div className="grid grid-cols-7 px-2 mb-4">
                {cells.map((d, i) => {
                    if (!d) return <div key={i} />;
                    const cellDate = new Date(year, month, d);
                    const isToday = sameDay(cellDate, today);
                    const isSelected = sameDay(cellDate, selectedDate);
                    const dots = dotsByDay[d] || [];
                    const dotCount = Math.min(dots.length, 3);

                    return (
                        <div key={i} className="flex flex-col items-center py-1" onClick={() => setSelectedDate(cellDate)}>
                            <div className={`w-9 h-9 flex items-center justify-center rounded-full text-sm font-medium cursor-pointer transition-all
                                ${isSelected
                                    ? 'bg-gray-900 text-white font-bold'
                                    : isToday
                                        ? 'border border-gray-400 text-gray-800'
                                        : 'text-gray-700 hover:bg-gray-100'}`}>
                                {d}
                            </div>
                            <div className="flex gap-0.5 mt-0.5 h-2 items-center">
                                {Array.from({ length: dotCount }).map((_, di) => (
                                    <div key={di} className="w-1.5 h-1.5 rounded-full bg-red-500" />
                                ))}
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* 分隔線 */}
            <div className="border-t border-gray-200 mx-4" />

            {/* 選定日期的事件列表 */}
            <div className="px-4 py-4 space-y-4">
                {selectedEntries.length === 0 ? (
                    <p className="text-gray-400 text-sm text-center py-6">此日無記錄</p>
                ) : (
                    selectedEntries.map(e => (
                        <div key={e.id} className="border-b border-gray-100 pb-4">
                            <div className="flex items-center justify-between mb-2">
                                <span className="text-xs font-medium px-3 py-1 rounded-full border border-gray-300 text-gray-600">照片黏貼</span>
                                <div className="flex items-center gap-2">
                                    {e.images?.length > 1 && (
                                        <button
                                            onClick={() => e.images.forEach((img, idx) => {
                                                setTimeout(() => downloadImage(img.preview, `${e.date}_${e.floor || ''}_${idx + 1}.jpg`), idx * 100);
                                            })}
                                            className="flex items-center gap-1 text-xs text-blue-500 hover:text-blue-700 px-2 py-1 hover:bg-blue-50 rounded transition-colors"
                                        >
                                            <DownloadIcon />全部下載
                                        </button>
                                    )}
                                    <button onClick={() => onDeleteEntry?.(e.id)} className="text-xs text-red-400 hover:text-red-600 px-2 py-1 hover:bg-red-50 rounded transition-colors">刪除</button>
                                </div>
                            </div>
                            <p className="text-sm text-gray-600 leading-relaxed">
                                {[e.date, e.floor, e.direction, e.item, e.content].filter(Boolean).join('　')}
                            </p>
                            {e.images?.length > 0 && (
                                <div className="flex gap-2 mt-3 flex-wrap">
                                    {e.images.map((img, idx) => (
                                        <div key={idx} className="flex flex-col items-center gap-1">
                                            <img src={img.preview} className="w-28 h-28 object-cover rounded-xl shadow-sm" />
                                            <button
                                                onClick={() => downloadImage(img.preview, `${e.date}_${e.floor || ''}_${idx + 1}.jpg`)}
                                                className="flex items-center gap-1 text-xs text-gray-400 hover:text-blue-500 transition-colors"
                                            >
                                                <DownloadIcon />下載
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    ))
                )}
            </div>

            {/* 底部 + 按鈕 */}
            <div className="flex justify-end px-6 py-4">
                <button
                    onClick={onAddEntry}
                    className="w-12 h-12 flex items-center justify-center text-2xl text-gray-400 hover:text-gray-600 transition-colors"
                >
                    +
                </button>
            </div>
        </div>
    );
}
