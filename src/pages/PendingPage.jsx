import { useAuth } from '../context/AuthContext';

export function PendingPage() {
    const { logout, user } = useAuth();
    return (
        <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center px-4 font-sans">
            <div className="w-full max-w-sm text-center space-y-4">
                <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Pro Work</h1>
                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 space-y-4">
                    <div className="text-4xl">⏳</div>
                    <p className="text-base font-semibold text-gray-800">帳號審核中</p>
                    <p className="text-sm text-gray-500">
                        <span className="font-medium text-gray-700">{user?.email}</span> 的申請已送出，<br />
                        請等待管理員分配使用權限。
                    </p>
                    <p className="text-xs text-gray-400">獲得授權後，使用 Google 帳號重新登入即可進入系統。</p>
                    <button
                        onClick={logout}
                        className="w-full py-2.5 text-sm text-gray-500 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors"
                    >
                        登出
                    </button>
                </div>
            </div>
        </div>
    );
}
