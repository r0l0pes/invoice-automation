import LogoutButton from '@/components/LogoutButton'
import { createClient } from '@/utils/supabase/server'
import { getAdminSupabaseClient } from '@/utils/supabaseAdmin'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'

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

type PageProps = {
    searchParams?: {
        start?: string
        end?: string
    }
}

export default async function ManagerShiftsPage({ searchParams }: PageProps) {
    // 1. Auth & Role Check (Standard Client)
    const supabase = await createClient()

    const {
        data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
        redirect('/login')
    }

    // Verify role is manager


    // 2. Fetch Data (Admin Client)
    const adminSupabase = getAdminSupabaseClient()

    // Date handling
    const today = new Date().toISOString().slice(0, 10)
    let startDate = searchParams?.start || today
    let endDate = searchParams?.end || today

    // Swap if start > end
    if (startDate > endDate) {
        const temp = startDate
        startDate = endDate
        endDate = temp
    }

    // Step 2a: Fetch Shifts based on selected date
    // We filter by 'date' column which stores YYYY-MM-DD
    const { data: shifts, error: shiftsError } = await adminSupabase
        .from('shifts')
        .select(`
            id, user_id, date, start_time, end_time, status, 
            raw_hours, effective_hours, break_start, break_end, break_duration_minutes
        `)
        .gte('date', startDate)
        .lte('date', endDate)
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

    const formatDuration = (hours: number | null | undefined): string => {
        if (hours === null || hours === undefined) return ''

        if (hours < 1) {
            const minutes = Math.round(hours * 60)
            return `${minutes} min`
        }

        // >= 1 hour
        const rounded = Math.round(hours * 100) / 100
        return `${rounded}h`
    }

    return (
        <div className="max-w-xl mx-auto px-4 py-8 text-slate-900">
            <header className="flex flex-wrap justify-between items-center mb-6 gap-2">
                <div>
                    <div className="flex items-center gap-2 mb-1">
                        <Link href="/manager/dashboard" className="text-sm text-slate-400 hover:text-slate-200 flex items-center gap-1 transition-colors">
                            <ArrowLeft size={16} /> Back to dashboard
                        </Link>
                    </div>
                    <h1 className="text-xl font-semibold text-slate-50">Manager shifts</h1>
                    <div className="flex items-center gap-2 mt-1">
                        <span className="text-sm text-slate-400">Overview from</span>
                        <form className="flex items-center gap-2">
                            <input
                                type="date"
                                name="start"
                                defaultValue={startDate}
                                className="rounded-md border border-slate-700 bg-slate-800 px-2 py-1 text-slate-100 text-xs sm:text-sm shadow-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
                            />
                            <span className="text-sm text-slate-400">to</span>
                            <input
                                type="date"
                                name="end"
                                defaultValue={endDate}
                                className="rounded-md border border-slate-700 bg-slate-800 px-2 py-1 text-slate-100 text-xs sm:text-sm shadow-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
                            />
                            <button
                                type="submit"
                                className="rounded-md bg-blue-600 hover:bg-blue-700 px-3 py-1 text-xs sm:text-sm text-white font-medium transition-colors"
                            >
                                Go
                            </button>
                        </form>
                    </div>
                </div>
                <div className="shrink-0">
                    <LogoutButton />
                </div>
            </header>

            {/* Summary Card */}
            <div className="bg-white rounded-2xl shadow-md p-5 border border-slate-100 mb-6 flex justify-between text-center sm:px-8">
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
                        No shifts found for {startDate} to {endDate}.
                    </div>
                ) : (
                    safeShifts.map((shift) => {
                        const packerName = profilesMap[shift.user_id] || 'Unknown User'

                        // Status Logic
                        let statusLabel = 'Completed'
                        let badgeClass = 'bg-slate-100 text-slate-600'
                        let hoursDisplay = formatDuration(shift.effective_hours ?? shift.raw_hours ?? 0)

                        const isCompleted = !!shift.end_time

                        // Use consistent badge logic
                        if (shift.status === 'cancelled') {
                            statusLabel = 'Cancelled'
                            badgeClass = 'bg-red-100 text-red-700'
                        } else if (!isCompleted) {
                            if (shift.status === 'on_break' || (shift.break_start && !shift.break_end)) {
                                statusLabel = 'On Break'
                                badgeClass = 'bg-amber-100 text-amber-700'
                                hoursDisplay = 'Pending'
                            } else {
                                statusLabel = 'Active'
                                badgeClass = 'bg-green-100 text-green-700'
                                hoursDisplay = 'Pending'
                            }
                        }

                        const endTimeDisplay = shift.end_time ? formatTime(shift.end_time) : 'Active'

                        return (
                            <Link
                                key={shift.id}
                                href={`/manager/shifts/${shift.id}?from=/manager/shifts&start=${startDate}&end=${endDate}`}
                                className="block transition-transform active:scale-[0.99]"
                            >
                                <div className="bg-white rounded-xl shadow-sm p-4 border border-slate-100 text-sm hover:border-blue-300 hover:shadow-md transition-all cursor-pointer">
                                    <div className="flex justify-between items-start mb-3">
                                        <span className="font-semibold text-slate-900 text-base">{packerName}</span>
                                        <span className={`px-2 py-1 rounded-full font-medium text-xs ${badgeClass}`}>
                                            {statusLabel}
                                        </span>
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <div className="flex flex-col text-slate-500">
                                                <span className="text-xs uppercase tracking-wide mb-0.5">Time</span>
                                                <span className="text-slate-900 font-medium">
                                                    {formatTime(shift.start_time)} – {endTimeDisplay}
                                                </span>
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <div className="flex flex-col text-slate-500">
                                                <span className="text-xs uppercase tracking-wide mb-0.5">Hours</span>
                                                <span className={`font-medium ${!isCompleted ? 'text-slate-400' : 'text-slate-900'}`}>
                                                    {hoursDisplay}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </Link>
                        )
                    })
                )}
            </div>
        </div>
    )
}
