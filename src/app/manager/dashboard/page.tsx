import { createClient } from '@/utils/supabase/server'
import { getAdminSupabaseClient } from '@/utils/supabaseAdmin'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Clock, Square, Users, Calendar, ChevronRight, AlertCircle, Coffee } from 'lucide-react'

// --- Types ---

interface Shift {
    id: number
    user_id: string
    date: string | null
    start_time: string
    end_time: string | null
    status: string
    break_start: string | null
    break_end: string | null
    break_duration_minutes: number | null
    raw_hours: number | null
    effective_hours: number | null
    packages: number | null
}

interface Profile {
    id: string
    full_name: string | null
    hourly_rate: number | null
}

type PageProps = {
    searchParams?: Promise<{
        start?: string
        end?: string
    }>
}

// --- Helper Functions ---

function formatMoney(amount: number) {
    return new Intl.NumberFormat('en-IE', { style: 'currency', currency: 'EUR' }).format(amount)
}

function formatDuration(hours: number): string {
    if (hours < 0) return '0m'
    const h = Math.floor(hours)
    const m = Math.round((hours - h) * 60)
    // Match Figma style: "124.5h" -> we'll stick to our robust format or try to match
    // Figma shows "124.5h". Let's try to be closer if > 1h
    if (h > 0) {
        return `${h}h${m > 0 ? ` ${m}m` : ''}`
    }
    return `${m}m`
}

function formatTime(iso: string) {
    return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

// --- Main Component ---

export default async function ManagerDashboardPage({ searchParams }: PageProps) {
    // 1. Auth & Access Control
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
        redirect('/login')
    }



    // 2. Parse Date Range
    const sp = await searchParams
    const today = new Date().toISOString().slice(0, 10)
    let startDate = sp?.start || today
    let endDate = sp?.end || today

    if (startDate > endDate) {
        [startDate, endDate] = [endDate, startDate]
    }

    // 3. Data Fetching
    const adminSupabase = getAdminSupabaseClient()
    let shifts: Shift[] = []
    const profilesMap = new Map<string, Profile>()
    let loadError: string | null = null

    try {
        const queryEndDate = new Date(endDate)
        queryEndDate.setDate(queryEndDate.getDate() + 1)
        const queryEndDateStr = queryEndDate.toISOString().slice(0, 10)

        const { data: shiftsData, error: shiftsError } = await adminSupabase
            .from('shifts')
            .select(`
                id, user_id, date, start_time, end_time, status,
                break_start, break_end, break_duration_minutes,
                raw_hours, effective_hours, packages
            `)
            .gte('start_time', `${startDate}T00:00:00`)
            .lt('start_time', `${queryEndDateStr}T00:00:00`)
            .order('start_time', { ascending: false })

        if (shiftsError) throw shiftsError
        shifts = (shiftsData as Shift[]) || []

        const userIds = Array.from(new Set(shifts.map(s => s.user_id)))
        if (userIds.length > 0) {
            const { data: profilesData, error: profilesError } = await adminSupabase
                .from('profiles')
                .select('id, full_name, hourly_rate')
                .in('id', userIds)

            if (!profilesError && profilesData) {
                profilesData.forEach((p: Profile) => {
                    profilesMap.set(p.id, p)
                })
            }
        }

    } catch (err: unknown) {
        console.error('Safe fetch error:', err)
        loadError = 'Failed to load dashboard data.'
    }

    // 4. Calculations
    const now = new Date()

    // Summary Aggregates
    let activeWorkersCount = 0 // "Active Now"
    let onBreakCount = 0
    const totalShiftsToday = shifts.length

    let totalWorkingHours = 0
    let totalEarnings = 0
    let totalPackages = 0

    const activeShiftsList: Array<Shift & { currentDuration: number, workerName: string }> = []
    const completedShiftsList: Array<Shift & { workingDuration: number, workerName: string }> = []

    for (const shift of shifts) {
        const p = profilesMap.get(shift.user_id)
        const hourlyRate = p?.hourly_rate ?? 0
        const workerName = p?.full_name || 'Unknown'

        // Status logic
        const isCompleted = !!shift.end_time || shift.status === 'completed'
        const isCancelled = shift.status === 'cancelled'

        // Break calc
        let breakMinutes = shift.break_duration_minutes || 0
        if (!breakMinutes && shift.break_start && shift.break_end) {
            const bs = new Date(shift.break_start).getTime()
            const be = new Date(shift.break_end).getTime()
            breakMinutes = (be - bs) / (1000 * 60)
        }
        const breakHours = breakMinutes / 60

        // Determine if technically "active now" vs "on break now"
        // This is tricky without real-time state, but we can infer:
        // Active = no end time AND not cancelled.
        // On Break = active AND status='on_break' OR (break_start && !break_end)

        if (!isCompleted && !isCancelled) {
            let isOnBreak = false
            if (shift.status === 'on_break') isOnBreak = true
            if (shift.break_start && !shift.break_end) isOnBreak = true

            if (isOnBreak) {
                onBreakCount++
            } else {
                activeWorkersCount++
            }

            // Working hours so far
            const start = new Date(shift.start_time).getTime()
            const currentRaw = (now.getTime() - start) / (1000 * 60 * 60)
            const workingHours = Math.max(0, currentRaw - breakHours)

            activeShiftsList.push({ ...shift, currentDuration: workingHours, workerName })

            // Add projected earnings/hours to totals? 
            // Usually dashboard totals include "so far".
            totalWorkingHours += workingHours
            totalEarnings += (workingHours * hourlyRate)
        } else if (isCompleted && !isCancelled) {
            const start = new Date(shift.start_time).getTime()
            const end = new Date(shift.end_time!).getTime()
            const raw = (end - start) / (1000 * 60 * 60)
            const workingHours = Math.max(0, raw - breakHours)

            completedShiftsList.push({ ...shift, workingDuration: workingHours, workerName })

            totalWorkingHours += workingHours
            totalEarnings += (workingHours * hourlyRate)
        }

        if (!isCancelled) {
            totalPackages += (shift.packages || 0)
        }
    }

    const activeTotalForCard = activeWorkersCount + onBreakCount // "6 workers" active now usually implies clocked in?

    // Sort Active by start time (newest first? Or oldest?)
    activeShiftsList.sort((a, b) => new Date(b.start_time).getTime() - new Date(a.start_time).getTime())

    // Date formatting helper that is safe for server/client
    function safeFormatDate(dateStr: string) {
        // Use a fixed locale 'en-GB' or 'en-US' options to ensure consistency between server/client
        // or just parse yyyy-mm-dd manually if really paranoid.
        // But for RSC, the component runs on server. The issue is usually new Date() without args.
        // We are passing startDate/endDate which are strings.
        // Let's use verbose options but ensure no timezone shift issues by appending T12:00:00
        const d = new Date(dateStr)
        return d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })
    }

    // 5. Render
    return (
        <div className="min-h-screen bg-slate-50 pb-20">
            <div className="max-w-md mx-auto px-4 py-8">
                {/* Header Area */}
                <div className="flex flex-col gap-6 mb-8">
                    <div>
                        <h1 className="text-2xl font-bold text-slate-900 mb-1">Shift Dashboard</h1>
                        <p className="text-slate-500 text-sm">
                            {new Date(startDate).toLocaleDateString('en-GB', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
                        </p>
                    </div>

                    {/* Date Controls */}
                    <form className="bg-white border border-slate-200 rounded-xl p-4 flex items-center justify-between shadow-sm">
                        <div className="flex items-center gap-3">
                            <Calendar size={18} className="text-slate-400" />
                            <div className="flex items-center gap-2">
                                <input
                                    type="date"
                                    name="start"
                                    defaultValue={startDate}
                                    className="bg-transparent outline-none text-slate-900 text-sm font-medium w-[110px] appearance-none"
                                />
                                <span className="text-slate-400">-</span>
                                <input
                                    type="date"
                                    name="end"
                                    defaultValue={endDate}
                                    className="bg-transparent outline-none text-slate-900 text-sm font-medium w-[110px] appearance-none"
                                />
                            </div>
                        </div>
                        <button type="submit" className="bg-slate-900 text-white rounded-lg p-2 hover:bg-slate-800 transition-colors">
                            <ChevronRight size={16} />
                        </button>
                    </form>
                </div>

                {/* Error State */}
                {loadError && (
                    <div className="bg-red-50 text-red-600 p-4 rounded-xl mb-6 flex items-start gap-3 border border-red-100">
                        <AlertCircle className="shrink-0 mt-0.5" size={18} />
                        <p className="text-sm font-medium">{loadError}</p>
                    </div>
                )}

                {/* Hero Card (Green) */}
                <div className="bg-emerald-600 rounded-2xl p-6 text-white shadow-lg relative overflow-hidden mb-8">
                    {/* Decor circles */}
                    <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-10 -mt-10 blur-2xl" />

                    <div className="relative z-10">
                        <div className="flex items-center gap-3 mb-6">
                            <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center backdrop-blur-sm">
                                <Users size={20} className="text-white" />
                            </div>
                            <div>
                                <p className="text-emerald-100 text-xs font-semibold uppercase tracking-wider">Active Workforce</p>
                                <p className="text-3xl font-bold tracking-tight">{activeTotalForCard} <span className="text-lg font-medium text-emerald-200">/ {totalShiftsToday}</span></p>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4 border-t border-white/10 pt-4">
                            <div>
                                <div className="flex items-center gap-2 mb-1">
                                    <div className="w-2 h-2 bg-emerald-300 rounded-full animate-pulse" />
                                    <span className="text-xl font-bold">{activeWorkersCount}</span>
                                </div>
                                <span className="text-emerald-100 text-xs font-medium">Working Now</span>
                            </div>
                            <div>
                                <div className="flex items-center gap-2 mb-1">
                                    <Coffee size={14} className="text-emerald-200" />
                                    <span className="text-xl font-bold">{onBreakCount}</span>
                                </div>
                                <span className="text-emerald-100 text-xs font-medium">On Break</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Today's Summary */}
                <h2 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-4 px-1">Today&apos;s Performance</h2>
                <div className="grid grid-cols-2 gap-3 mb-8">
                    {/* Hours Card */}
                    <div className="bg-white border border-slate-200 p-4 rounded-2xl flex flex-col justify-between h-28 shadow-sm">
                        <div className="flex items-start justify-between mb-1">
                            <span className="text-xs text-slate-500 font-medium">Total Hours</span>
                            <Clock size={14} className="text-slate-400" />
                        </div>
                        <div>
                            <div className="text-2xl font-bold text-slate-900 mb-1">{totalWorkingHours.toFixed(1)}h</div>
                            <div className="text-xs font-medium text-emerald-600 bg-emerald-50 inline-block px-1.5 py-0.5 rounded">{formatMoney(totalEarnings)}</div>
                        </div>
                    </div>

                    {/* Packages Card */}
                    <div className="bg-white border border-slate-200 p-4 rounded-2xl flex flex-col justify-between h-28 shadow-sm">
                        <div className="flex items-start justify-between mb-1">
                            <span className="text-xs text-slate-500 font-medium">Packages</span>
                            <Square size={14} className="text-slate-400" />
                        </div>
                        <div>
                            <div className="text-2xl font-bold text-slate-900 mb-1">{new Intl.NumberFormat('en-US').format(totalPackages)}</div>
                            <div className="text-xs font-medium text-slate-500">
                                {totalWorkingHours > 0 ? (totalPackages / totalWorkingHours).toFixed(1) : '0'} /hr
                            </div>
                        </div>
                    </div>
                </div>

                {/* Lists Header + View All */}
                <div className="flex items-center justify-between mb-4 px-1">
                    <h2 className="text-sm font-bold text-slate-400 uppercase tracking-wider">Live Activity</h2>
                    {/* View All Button */}
                    <Link href={`/manager/shifts?start=${startDate}&end=${endDate}`}>
                        <div className="flex items-center gap-1 text-xs font-bold text-blue-600 hover:text-blue-700 transition-colors">
                            VIEW ALL
                            <ChevronRight size={14} />
                        </div>
                    </Link>
                </div>

                {/* Active Shifts List */}
                {activeShiftsList.length > 0 && (
                    <div className="space-y-3 mb-6">
                        {activeShiftsList.map(shift => (
                            <Link
                                key={shift.id}
                                href={`/manager/shifts/${shift.id}?from=/manager/dashboard&start=${startDate}&end=${endDate}`}
                                className="block group"
                            >
                                <div className="bg-white border border-slate-200 rounded-xl p-4 flex items-center justify-between shadow-sm group-hover:shadow-md transition-all active:scale-[0.99]">
                                    <div className="flex items-center gap-4">
                                        <div className="w-10 h-10 bg-slate-100 rounded-full flex items-center justify-center text-slate-600 font-bold text-sm border border-slate-200">
                                            {getInitials(shift.workerName)}
                                        </div>
                                        <div>
                                            <p className="font-bold text-slate-900 text-sm">{shift.workerName}</p>
                                            <p className="text-slate-500 text-xs">Started {formatTime(shift.start_time)}</p>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <div className="bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded text-[10px] font-bold uppercase inline-block mb-1">
                                            Active
                                        </div>
                                        <div className="text-slate-900 font-bold text-sm tabular-nums">
                                            {formatDuration(shift.currentDuration)}
                                        </div>
                                    </div>
                                </div>
                            </Link>
                        ))}
                    </div>
                )}

                {/* Completed Shifts List */}
                <div className="space-y-3">
                    {completedShiftsList.slice(0, 50).map(shift => (
                        <Link
                            key={shift.id}
                            href={`/manager/shifts/${shift.id}?from=/manager/dashboard&start=${startDate}&end=${endDate}`}
                            className="block group"
                        >
                            <div className="bg-white border border-slate-200 rounded-xl p-4 flex items-center justify-between active:scale-[0.99] transition-transform group-hover:border-blue-200 shadow-sm">
                                <div className="flex items-center gap-4">
                                    <div className="w-10 h-10 bg-slate-50 rounded-full flex items-center justify-center text-slate-400 font-bold text-sm border border-slate-200">
                                        {getInitials(shift.workerName)}
                                    </div>
                                    <div>
                                        <p className="font-bold text-slate-700 text-sm">{shift.workerName}</p>
                                        <p className="text-slate-400 text-xs">Ended {formatTime(shift.end_time!)}</p>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <div className="bg-slate-100 text-slate-500 px-2 py-0.5 rounded text-[10px] font-bold uppercase inline-block mb-1 border border-slate-200">
                                        Completed
                                    </div>
                                    <div className="text-slate-700 font-bold text-sm tabular-nums">
                                        {formatDuration(shift.workingDuration)}
                                    </div>
                                </div>
                            </div>
                        </Link>
                    ))}
                </div>

                {/* Empty State */}
                {shifts.length === 0 && (
                    <div className="text-center py-12 border-2 border-dashed border-slate-200 rounded-2xl bg-slate-50">
                        <p className="text-slate-500 font-medium">No shifts found</p>
                        <p className="text-slate-400 text-sm mt-1">Try adjusting the date range</p>
                    </div>
                )}
            </div>
        </div>
    )
}



function getInitials(name: string) {
    if (!name) return '??'
    return name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()
}
