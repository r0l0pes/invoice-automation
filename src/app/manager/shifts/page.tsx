import LogoutButton from '@/components/LogoutButton'
import { createClient } from '@/utils/supabase/server'
import { getAdminSupabaseClient } from '@/utils/supabaseAdmin'
import { redirect } from 'next/navigation'

interface Shift {
    id: number
    user_id: string
    date: string | null
    start_time: string
    end_time: string | null
    status: string
    raw_hours: number | null
    effective_hours: number | null
    break_start: string | null
    break_end: string | null
    break_duration_minutes: number | null
}

export default async function ManagerShiftsPage() {
    // 1. Auth & Role Check (Standard Client)
    const supabase = await createClient()

    const {
        data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
        redirect('/login')
    }

    // Verify role is manager
    const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single()

    if (!profile || profile.role !== 'manager') {
        redirect('/app/dashboard')
    }

    // 2. Fetch Data (Admin Client)
    // Use service role to bypass RLS for fetching other users' shifts and names
    const adminSupabase = getAdminSupabaseClient()
    const today = new Date().toISOString().slice(0, 10)

    // Step 2a: Fetch Shifts
    const { data: shifts, error: shiftsError } = await adminSupabase
        .from('shifts')
        .select(`
            id, user_id, date, start_time, end_time, status, 
            raw_hours, effective_hours, break_start, break_end, break_duration_minutes
        `)
        .eq('date', today)
        .order('start_time', { ascending: true })

    if (shiftsError) {
        console.error('Error fetching shifts:', shiftsError)
        return (
            <div className="max-w-md mx-auto px-4 py-6 text-red-600">
                Failed to load shifts. Please try again.
            </div>
        )
    }

    const safeShifts = (shifts as Shift[]) || []

    // Step 2b: Fetch Profiles for these shifts
    const userIds = Array.from(new Set(safeShifts.map((s) => s.user_id)))
    const profilesMap: Record<string, string> = {}

    if (userIds.length > 0) {
        const { data: profiles, error: profilesError } = await adminSupabase
            .from('profiles')
            .select('id, full_name')
            .in('id', userIds)

        if (profilesError) {
            console.error('Error fetching profiles:', profilesError)
            // We just log this error and continue; names will default to "Unknown User"
        } else if (profiles) {
            profiles.forEach((p) => {
                profilesMap[p.id] = p.full_name || 'Unknown User'
            })
        }
    }

    // 3. Calculate Summaries
    const totalShifts = safeShifts.length
    const activeShiftsCount = safeShifts.filter((s) => {
        // Active OR on break (not completed)
        return !s.end_time || s.status === 'active' || s.status === 'on_break'
    }).length

    const totalHours = safeShifts.reduce((acc, s) => {
        const h = s.effective_hours ?? s.raw_hours ?? 0
        return acc + h
    }, 0)

    // Helper to format time HH:mm
    const formatTime = (iso: string) => {
        return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }

    return (
        <div className="max-w-md mx-auto px-4 py-6 text-slate-900">
            <header className="flex justify-between items-center mb-6">
                <div>
                    <h1 className="text-xl font-semibold text-slate-50">Manager shifts</h1>
                    <p className="text-sm text-slate-400">Today’s overview</p>
                </div>
                <LogoutButton />
            </header>

            {/* Summary Card */}
            <div className="bg-white rounded-2xl shadow-md p-5 border border-slate-100 mb-6 flex justify-between text-center">
                <div>
                    <div className="text-2xl font-bold text-slate-900">{totalShifts}</div>
                    <div className="text-xs text-slate-500 uppercase tracking-wide font-medium">Total</div>
                </div>
                <div>
                    <div className="text-2xl font-bold text-green-600">{activeShiftsCount}</div>
                    <div className="text-xs text-slate-500 uppercase tracking-wide font-medium">Active</div>
                </div>
                <div>
                    <div className="text-2xl font-bold text-blue-600">{totalHours.toFixed(1)}h</div>
                    <div className="text-xs text-slate-500 uppercase tracking-wide font-medium">Hours</div>
                </div>
            </div>

            {/* Shifts List */}
            <div className="space-y-4">
                {safeShifts.length === 0 ? (
                    <div className="bg-white rounded-2xl shadow-sm p-8 text-center text-slate-500">
                        No shifts for today yet.
                    </div>
                ) : (
                    safeShifts.map((shift) => {
                        const packerName = profilesMap[shift.user_id] || 'Unknown User'

                        // Status Logic
                        let statusLabel = 'Completed'
                        let badgeClass = 'bg-slate-100 text-slate-600'
                        let hoursDisplay = `${(shift.effective_hours ?? shift.raw_hours ?? 0).toFixed(2)}`

                        const isCompleted = !!shift.end_time

                        if (!isCompleted) {
                            if (shift.status === 'on_break' || (shift.break_start && !shift.break_end)) {
                                statusLabel = 'On Break'
                                badgeClass = 'bg-amber-100 text-amber-700'
                                hoursDisplay = '–' // Pending
                            } else {
                                statusLabel = 'Active'
                                badgeClass = 'bg-green-100 text-green-700'
                                hoursDisplay = '–' // Pending
                            }
                        }

                        // Determine end time display
                        const endTimeDisplay = shift.end_time ? formatTime(shift.end_time) : 'Active'

                        // If on break, maybe show "On break"? The requirements say:
                        // "Start / End / Status pill"
                        // Keep End as "Active" if not completed, but pill is "On Break" if on break

                        return (
                            <div key={shift.id} className="bg-white rounded-xl shadow-sm p-4 border border-slate-100">
                                <div className="flex justify-between items-start mb-2">
                                    <span className="font-semibold text-slate-900">{packerName}</span>
                                    <span className={`text-xs px-2 py-1 rounded-full font-medium ${badgeClass}`}>
                                        {statusLabel}
                                    </span>
                                </div>
                                <div className="flex justify-between text-sm text-slate-600">
                                    <div>
                                        <div className="flex items-center gap-2">
                                            <span className="w-16 text-slate-400 text-xs">Start</span>
                                            <span>{formatTime(shift.start_time)}</span>
                                        </div>
                                        <div className="flex items-center gap-2 mt-1">
                                            <span className="w-16 text-slate-400 text-xs">End</span>
                                            <span>{endTimeDisplay}</span>
                                        </div>
                                    </div>
                                    <div className="text-right flex flex-col justify-end">
                                        <span className="text-xs text-slate-400">Hours</span>
                                        <span className={`font-medium ${!isCompleted ? 'text-slate-400 text-xs' : 'text-slate-900'}`}>
                                            {isCompleted ? hoursDisplay : 'Pending'}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        )
                    })
                )}
            </div>
        </div>
    )
}
