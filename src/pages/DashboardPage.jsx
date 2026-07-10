import { useProject, getDrawingStatus } from '../context/ProjectContext';
import { useSettings } from '../context/SettingsContext';

export function DashboardPage() {
    const { projects, groups, drawings, factorySteps, selectedProjectId, setSelectedProjectId } = useProject();
    const { settings } = useSettings();
    const allUsers = settings.users || [];

    const memberNames = (ids) =>
        (ids || []).map(id => allUsers.find(u => u.id === id)?.name).filter(Boolean);

    // ── 統計 ────────────────────────────────────────────────────
    const allDrawings = drawings;
    const drawingStatusCounts = {
        未開始: 0, 繪圖中: 0, 已送審: 0, 已簽回: 0, 已核准: 0,
    };
    // Latest revision per group
    const latestDrawingPerGroup = {};
    allDrawings.forEach(dr => {
        const prev = latestDrawingPerGroup[dr.groupId];
        if (!prev || dr.rev > prev.rev) latestDrawingPerGroup[dr.groupId] = dr;
    });
    Object.values(latestDrawingPerGroup).forEach(dr => {
        const s = getDrawingStatus(dr).label;
        if (drawingStatusCounts[s] !== undefined) drawingStatusCounts[s]++;
    });

    const totalSteps = factorySteps.length;
    const doneSteps = factorySteps.filter(fs => fs.doneDate).length;

    // ── Per-project summary ─────────────────────────────────────
    const projectSummary = projects.map(p => {
        const pGroups = groups.filter(g => g.projectId === p.id);
        const pGroupIds = pGroups.map(g => g.id);
        const pDrawings = allDrawings.filter(dr => pGroupIds.includes(dr.groupId));
        const pSteps = factorySteps.filter(fs => pGroupIds.includes(fs.groupId));
        const latestPerGroup = {};
        pDrawings.forEach(dr => {
            const prev = latestPerGroup[dr.groupId];
            if (!prev || dr.rev > prev.rev) latestPerGroup[dr.groupId] = dr;
        });
        const approved = Object.values(latestPerGroup).filter(dr => dr.approveDate).length;
        const doneStepsP = pSteps.filter(fs => fs.doneDate).length;
        return { ...p, groupCount: pGroups.length, approved, totalGroups: pGroups.length, doneStepsP, totalSteps: pSteps.length };
    });

    return (
        <div className="min-h-screen bg-gray-50 font-sans text-gray-800 p-4 md:p-8">
            <div className="max-w-5xl mx-auto space-y-8">

                {/* 標題 */}
                <div className="flex items-center justify-between">
                    <h2 className="text-xl font-bold text-gray-900">首頁總覽</h2>
                    <span className="text-sm text-gray-500">
                        {selectedProjectId
                            ? `目前工地：${projects.find(p => p.id === selectedProjectId)?.name ?? ''}`
                            : '尚未選擇工地'}
                    </span>
                </div>

                {/* 統計卡片 */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {[
                        { label: '工地數', value: projects.length, color: 'text-gray-900' },
                        { label: '繪圖中', value: drawingStatusCounts['繪圖中'] + drawingStatusCounts['未開始'], color: 'text-yellow-600' },
                        { label: '已核准', value: drawingStatusCounts['已核准'], color: 'text-green-600' },
                        { label: '工廠完成率', value: totalSteps ? `${Math.round(doneSteps / totalSteps * 100)}%` : '—', color: 'text-blue-600' },
                    ].map(s => (
                        <div key={s.label} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
                            <p className="text-xs text-gray-400 mb-1">{s.label}</p>
                            <p className={`text-3xl font-bold ${s.color}`}>{s.value}</p>
                        </div>
                    ))}
                </div>

                {/* 工地列表 */}
                {projects.length === 0 ? (
                    <div className="text-center py-20 text-gray-300">
                        <p className="text-5xl mb-3">🏗️</p>
                        <p className="text-gray-400 font-medium">尚無工地，點右上角「+ 新增工地」開始</p>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {projectSummary.map(p => (
                            <div
                                key={p.id}
                                onClick={() => setSelectedProjectId(p.id === selectedProjectId ? null : p.id)}
                                className={`bg-white rounded-2xl border shadow-sm overflow-hidden cursor-pointer transition-all ${p.id === selectedProjectId ? 'border-gray-800 ring-2 ring-gray-800' : 'border-gray-100'}`}
                            >
                                <div className="p-5">
                                    <div className="flex items-center justify-between">
                                        <h3 className="font-bold text-base text-gray-900">{p.name}</h3>
                                        {p.id === selectedProjectId && <span className="text-xs font-semibold text-gray-800 bg-gray-100 px-2 py-0.5 rounded-full">目前選擇</span>}
                                    </div>
                                    {p.address && <p className="text-xs text-gray-400 mt-0.5">{p.address}</p>}
                                    {memberNames(p.members).length > 0 && (
                                        <div className="flex flex-wrap gap-1.5 mt-2">
                                            {memberNames(p.members).map(name => (
                                                <span key={name} className="px-2 py-0.5 text-xs bg-blue-50 text-blue-600 rounded-full">{name}</span>
                                            ))}
                                        </div>
                                    )}
                                    {p.note && (
                                        <p className="text-xs text-gray-400 mt-2 whitespace-pre-wrap leading-relaxed border-l-2 border-gray-200 pl-2">{p.note}</p>
                                    )}
                                </div>
                                <div className="grid grid-cols-3 border-t border-gray-50">
                                    <div className="p-3 text-center border-r border-gray-50">
                                        <p className="text-xs text-gray-400 mb-0.5">群組</p>
                                        <p className="font-bold text-gray-800">{p.groupCount}</p>
                                    </div>
                                    <div className="p-3 text-center border-r border-gray-50">
                                        <p className="text-xs text-gray-400 mb-0.5">已核准圖面</p>
                                        <p className="font-bold text-green-600">{p.approved} / {p.totalGroups}</p>
                                    </div>
                                    <div className="p-3 text-center">
                                        <p className="text-xs text-gray-400 mb-0.5">工廠完成</p>
                                        <p className="font-bold text-blue-600">
                                            {p.totalSteps ? `${p.doneStepsP} / ${p.totalSteps}` : '—'}
                                        </p>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
