import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import ShiftHistoryView from './components/shift-history-view'

// Helper to get start of current week (Monday)
function getStartOfWeek() {
    const now = new Date()
    const day = now.getDay()
    const diff = now.getDate() - day + (day === 0 ? -6 : 1) // adjust when day is sunday
    const monday = new Date(now.setDate(diff))
    monday.setHours(0, 0, 0, 0)
    return monday.toISOString()
}

// Helper to get start of current month
function getStartOfMonth() {
    const now = new Date()
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
    startOfMonth.setHours(0, 0, 0, 0)
    return startOfMonth.toISOString()
}

export default async function ShiftsPage({
    searchParams,
}: {
    searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
    const supabase = await createClient()

    // 1. Auth Guard
    const {
        data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
        return redirect('/login')
    }

    // 2. Fetch Profile for Hourly Rate
    const { data: profile } = await supabase
        .from('profiles')
        .select('hourly_rate')
        .eq('id', user.id)
        .single()

    const hourlyRate = profile?.hourly_rate || 0

    // 3. Determine Filter
    // Default to 'month' if no param
    const resolvedParams = await searchParams
    const filter = (resolvedParams.filter as string) || 'month'

    let query = supabase
        .from('shifts')
        .select('*')
        .eq('user_id', user.id)
        .eq('status', 'completed')
        .order('start_time', { ascending: false })
    //.limit(200) Removing limit as requested for "All Time"

    if (filter === 'week') {
        const startOfWeek = getStartOfWeek()
        query = query.gte('start_time', startOfWeek)
    } else if (filter === 'month') {
        const startOfMonth = getStartOfMonth()
        query = query.gte('start_time', startOfMonth)
    }
    // 'all' -> no extra filter

    const { data: shifts, error } = await query

    if (error) {
        console.error('Error fetching shifts:', error)
    }

    // 4. Transform data for client
    return (
        <ShiftHistoryView
            profile={{ hourly_rate: hourlyRate }}
            shifts={shifts || []}
            initialFilter={filter}
        />
    )
}
