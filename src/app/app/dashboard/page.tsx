
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
        <div className="max-w-md mx-auto px-4 py-6">
            <header className="flex justify-between items-center mb-6">
                <div>
                    <h1 className="text-xl font-semibold text-slate-50">Dashboard</h1>
                    <p className="text-sm text-slate-400">
                        Welcome back, {profile?.full_name || user?.email}
                    </p>
                </div>
                <LogoutButton />
            </header>

            <div className="bg-white rounded-2xl shadow-md p-5 border border-slate-100">
                <p className="text-slate-900 text-sm">
                    Packer View (v1)
                </p>
            </div>
        </div>
    )
}
