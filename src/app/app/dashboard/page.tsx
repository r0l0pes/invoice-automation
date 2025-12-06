
import { createClient } from '@/utils/supabase/server'
import LogoutButton from '@/components/LogoutButton'

export default async function DashboardPage() {
    const supabase = await createClient()

    const { data: { user } } = await supabase.auth.getUser()

    const { data: profile } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('id', user?.id)
        .single()

    return (
        <div className="p-6">
            <header className="flex justify-between items-center mb-6 border-b pb-4">
                <h1 className="text-xl font-bold text-gray-900">Dashboard</h1>
                <LogoutButton />
            </header>

            <p className="text-gray-700 mb-4">
                Welcome back, <span className="font-semibold">{profile?.full_name || user?.email}</span>
            </p>

            <div className="p-4 bg-white rounded shadow text-sm text-gray-500">
                Packer View (v1)
            </div>
        </div>
    )
}
