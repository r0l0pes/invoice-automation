import LogoutButton from '@/components/LogoutButton'

export default function ManagerShiftsPage() {
    return (
        <div className="p-6">
            <header className="flex justify-between items-center mb-6 border-b pb-4">
                <h1 className="text-xl font-bold text-gray-900">Manager Shifts</h1>
                <LogoutButton />
            </header>

            <p className="text-gray-700 mb-4">
                Manager shifts overview (v1)
            </p>
            <div className="p-4 bg-blue-50 rounded border border-blue-100 text-sm text-blue-700">
                Manager View
            </div>
        </div>
    )
}
