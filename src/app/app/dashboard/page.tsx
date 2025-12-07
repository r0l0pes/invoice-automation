
import { createClient } from '@/utils/supabase/server'
import DashboardFeature from './dashboard-feature'
import LogoutButton from '@/components/LogoutButton'

export default async function DashboardPage() {
    const supabase = await createClient()

    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
        // Should be handled by middleware, but safe check
        return <div>Please log in</div>
    }

    // 1. Fetch user profile for name
    const { data: profile } = await supabase
        .from('profiles')
        .select('full_name, role')
        .eq('id', user.id)
        .single()

    // 2. Fetch active shift
    const { data: activeShift } = await supabase
        .from('shifts')
        .select('*')
        .eq('user_id', user.id)
        .is('end_time', null)
        .maybeSingle()

    // 3. Fetch recent history (limit 10)
    const { data: history } = await supabase
        .from('shifts')
        .select('*')
        .eq('user_id', user.id)
        .order('start_time', { ascending: false })
        .limit(10)

    return (
        <>
            <div className="absolute top-6 right-6 z-10">
                <LogoutButton />
            </div>
            {/* We pass data to the client component */}
            <DashboardFeature
                userProfile={profile}
                userEmail={user.email}
                activeShift={activeShift}
                history={history || []}
            />
        </>

    )
}
