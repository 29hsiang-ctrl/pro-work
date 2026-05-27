export const PreviewPage = ({ pageItems, pageIndex, totalPages, reportTitle }) => (
    <div className="page-container origin-top bg-white p-[15mm] overflow-hidden" style={{ width: '210mm', height: '297mm', margin: 0 }}>
        <div className="absolute top-6 right-8 text-sm text-gray-600">第 {pageIndex + 1} / {totalPages} 頁</div>
        {pageIndex === 0 && <div className="text-center mb-6"><h1 className="text-[24pt] font-bold text-black tracking-widest border-b-2 border-black pb-2 inline-block">{reportTitle}</h1></div>}
        <table className="w-full border-collapse border border-black table-fixed">
            <thead><tr className="bg-[#dce6f1] text-center"><th className="border border-black py-2 w-[35%] text-lg">說 明</th><th className="border border-black py-2 w-[65%] text-lg">現 況 照 片</th></tr></thead>
            <tbody>
                {pageItems.map((entry) => (
                    <tr key={entry.id} style={{ height: '80mm' }}>
                        <td className="border border-black p-4 align-top text-left text-base leading-relaxed">
                            <div className="mb-2"><b>日期:</b> {entry.date}</div>
                            <div className="mb-2 flex gap-4"><span><b>樓層:</b> {entry.floor}</span><span><b>方位:</b> {entry.direction}</span></div>
                            <div className="mb-2"><b>項目:</b> {entry.item}</div>
                            <div className="whitespace-pre-wrap"><b>查驗內容:</b> {entry.content}</div>
                        </td>
                        <td className="border border-black p-1 align-middle text-center bg-white">
                            <div className="w-full h-full flex gap-1 items-center justify-center" style={{ height: '78mm' }}>
                                {entry.images?.slice(0, 2).map((img, i) => <img key={i} src={img.preview} alt={`preview-${i}`} className="w-1/2 h-full object-contain" />)}
                            </div>
                        </td>
                    </tr>
                ))}
            </tbody>
        </table>
    </div>
);
