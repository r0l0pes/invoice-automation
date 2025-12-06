import LogoutButton from '@/components/LogoutButton'

export default function ManagerShiftsPage() {
    return (
        <div className="max-w-md mx-auto px-4 py-6">
            <header className="flex justify-between items-center mb-6">
                <div>
                    <h1 className="text-xl font-semibold text-slate-50">Manager shifts</h1>
                </div>
                <LogoutButton />
            </header>

            <div className="bg-white rounded-2xl shadow-md p-5 border border-slate-100">
                <p className="text-slate-900 text-sm mb-4">
                    Manager View (v1)
                </p>
                <div className="p-3 bg-blue-50 rounded-lg text-xs text-blue-700 font-medium inline-block">
                    Manager Access
                </div>
            </div>
        </div>
    )
}
