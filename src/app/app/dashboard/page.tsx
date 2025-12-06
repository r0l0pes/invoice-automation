
import { createClient } from '@/utils/supabase/server'

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
            <h1 className="text-2xl font-bold mb-4">Dashboard</h1>
            <p className="text-gray-700">
                Welcome back, {profile?.full_name || user?.email}
            </p>
            <div className="mt-4 p-4 bg-white rounded shadow text-sm text-gray-500">
                Packer View (v1)
            </div>
        </div>
    )
}
