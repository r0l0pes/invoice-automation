import { createClient } from '@/utils/supabase/server'
import { getAdminSupabaseClient } from '@/utils/supabaseAdmin'
import { redirect, notFound } from 'next/navigation'
import { Clock, Package, MapPin, Coffee } from 'lucide-react'
import DeleteShiftButton from './DeleteShiftButton'
import EditShiftModal from './EditShiftModal'
import BackButton from '@/components/BackButton'

// Types
interface ShiftDetail {
    id: number
    user_id: string
    date: string | null
    start_time: string
    end_time: string | null
    status: string
    break_start: string | null
    break_end: string | null
    break_duration_minutes: number | null
    packages: number | null
    location: string | null
    notes: string | null
    raw_hours: number | null
    effective_hours: number | null
}



export default async function ManagerShiftDetailPage({ params, searchParams }: { params: Promise<{ shiftId: string }>, searchParams?: Promise<{ from?: string, start?: string, end?: string }> }) {
    const { shiftId: shiftIdStr } = await params
    const sp = await searchParams

    // Back Link Logic
    let backLink = '/manager/dashboard' // Default fallback
    if (sp?.from && sp.from.startsWith('/manager/')) {
        backLink = sp.from
        // preserve date params
        if (sp.start || sp.end) {
            const qs = new URLSearchParams()
            if (sp.start) qs.set('start', sp.start)
            if (sp.end) qs.set('end', sp.end)
            backLink += `?${qs.toString()}`
        }
    }

    const shiftId = parseInt(shiftIdStr)
    if (isNaN(shiftId)) return notFound()

    const supabase = await createClient()

    // 1. Auth & Manager Role Check
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) redirect('/login')



    // 2. Fetch Data (Admin Client to match list strategy)
    const adminSupabase = getAdminSupabaseClient()

    const { data: shift, error } = await adminSupabase
        .from('shifts')
        .select('*')
        .eq('id', shiftId)
        .single()

    if (error || !shift) {
        if (error && error.code !== 'PGRST116') {
            console.error("Error fetching shift:", error)
        }
        return notFound()
    }

    const safeShift = shift as ShiftDetail

    // 3. Fetch Worker Profile (for Name and Hourly Rate)
    const { data: workerProfile } = await adminSupabase
        .from('profiles')
        .select('full_name, hourly_rate')
        .eq('id', safeShift.user_id)
        .single()

    const workerName = workerProfile?.full_name || 'Unknown User'
    const hourlyRate = workerProfile?.hourly_rate || 0

    // 4. Calculations
    const startTime = new Date(safeShift.start_time)

    // Total Duration
    // If completed use end_time, else if active use now? 
    // Usually for detail view of active shift, we might just show "Active" or calc vs Now.
    // But let's stick to what's in DB for static display or allow "Active" state.

    let totalDurationDisplay = 'Active'
    let workingTimeDisplay = 'Active'
    let earningsDisplay = 'Active'
    let rawHours = 0
    let workingHours = 0

    if (safeShift.end_time) {
        const endTime = new Date(safeShift.end_time)
        const diffMs = Math.max(0, endTime.getTime() - startTime.getTime())
        rawHours = diffMs / (1000 * 60 * 60)

        const hours = Math.floor(rawHours)
        const mins = Math.round((rawHours - hours) * 60)
        totalDurationDisplay = `${hours}h ${mins}m`

        // Break Duration
        // Use break_duration_minutes if available, else calc from start/end
        let breakMinutes = safeShift.break_duration_minutes || 0
        if (!breakMinutes && safeShift.break_start && safeShift.break_end) {
            const bs = new Date(safeShift.break_start).getTime()
            const be = new Date(safeShift.break_end).getTime()
            breakMinutes = Math.round((be - bs) / (1000 * 60))
        }

        // Working Time
        const breakHours = breakMinutes / 60
        workingHours = Math.max(0, rawHours - breakHours)

        const wHours = Math.floor(workingHours)
        const wMins = Math.round((workingHours - wHours) * 60)
        workingTimeDisplay = `${wHours}h ${wMins}m`

        // Earnings
        const earnings = workingHours * hourlyRate
        earningsDisplay = `€${earnings.toFixed(2)}`
    }

    // Date formatting
    const formatDate = (iso: string) => {
        return new Date(iso).toLocaleDateString('en-GB', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        })
    }

    const formatTime = (iso: string | null) => {
        if (!iso) return '--:--'
        return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }

    // Break display
    const breakStartDisplay = formatTime(safeShift.break_start)
    const breakEndDisplay = formatTime(safeShift.break_end)
    let breakDurationDisplay = '0h 0m'

    // If we have break minutes
    const bMinsTotal = safeShift.break_duration_minutes || 0
    if (bMinsTotal > 0) {
        const bH = Math.floor(bMinsTotal / 60)
        const bM = bMinsTotal % 60
        breakDurationDisplay = `${bH}h ${bM}m`
    } else if (safeShift.break_start && safeShift.break_end) {
        // Calculate manually
        const bs = new Date(safeShift.break_start).getTime()
        const be = new Date(safeShift.break_end).getTime()
        const diff = Math.round((be - bs) / (1000 * 60))
        const bH = Math.floor(diff / 60)
        const bM = diff % 60
        breakDurationDisplay = `${bH}h ${bM}m`
    }

    const isCompleted = !!safeShift.end_time
    let statusLabel = 'Completed'
    let badgeClass = 'bg-slate-100 text-slate-600'
    if (safeShift.status === 'cancelled') {
        statusLabel = 'Cancelled'
        badgeClass = 'bg-red-100 text-red-700'
    } else if (!isCompleted) {
        if (safeShift.status === 'on_break') {
            statusLabel = 'On Break'
            badgeClass = 'bg-amber-100 text-amber-700'
        } else {
            statusLabel = 'Active'
            badgeClass = 'bg-green-100 text-green-700'
        }
    }


    return (
        <div className="min-h-screen bg-slate-50 pb-12">
            {/* Header / Nav */}
            <div className="bg-white px-4 py-4 shadow-sm border-b border-slate-200">
                <div className="max-w-xl mx-auto flex items-center justify-between">
                    <BackButton fallbackRoute={backLink} />
                    <EditShiftModal
                        shiftId={shiftId}
                        availableFields={Object.keys(shift)}
                        initialData={{
                            start_time: safeShift.start_time,
                            end_time: safeShift.end_time,
                            break_start: safeShift.break_start,
                            break_end: safeShift.break_end,
                            packages: safeShift.packages,
                            location: safeShift.location,
                            notes: safeShift.notes
                        }}
                    />
                </div>
            </div>

            <div className="max-w-xl mx-auto px-4 py-6 space-y-6">

                {/* Header Info */}
                <div>
                    <h1 className="text-2xl font-bold text-slate-900">{workerName}</h1>
                    <p className="text-slate-500">{formatDate(safeShift.start_time)}</p>
                </div>

                {/* Status Badge */}
                <div>
                    <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${badgeClass}`}>
                        {statusLabel}
                    </span>
                </div>

                {/* Main Details Card */}
                <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                    <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50">
                        <h2 className="font-semibold text-slate-900">Shift Details</h2>
                    </div>
                    <div className="p-6 space-y-6">

                        {/* Times */}
                        <div className="grid grid-cols-2 gap-8">
                            <div>
                                <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Clock In</div>
                                <div className="flex items-center gap-2 text-slate-900 font-medium text-lg">
                                    <Clock size={18} className="text-slate-400" />
                                    {formatTime(safeShift.start_time)}
                                </div>
                            </div>
                            <div>
                                <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Clock Out</div>
                                <div className="flex items-center gap-2 text-slate-900 font-medium text-lg">
                                    <Clock size={18} className="text-slate-400" />
                                    {formatTime(safeShift.end_time)}
                                </div>
                            </div>
                        </div>

                        {/* Breaks */}
                        <div className="grid grid-cols-2 gap-8">
                            <div>
                                <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Break Start</div>
                                <div className="flex items-center gap-2 text-slate-900">
                                    <Coffee size={18} className="text-slate-400" />
                                    {breakStartDisplay}
                                </div>
                            </div>
                            <div>
                                <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Break End</div>
                                <div className="flex items-center gap-2 text-slate-900">
                                    <Coffee size={18} className="text-slate-400" />
                                    {breakEndDisplay}
                                </div>
                            </div>
                        </div>

                        {/* Packages */}
                        <div>
                            <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Packages Packed</div>
                            <div className="flex items-center gap-2 text-slate-900 font-medium text-lg">
                                <Package size={18} className="text-slate-400" />
                                {safeShift.packages ?? 0}
                            </div>
                        </div>

                        {/* Location */}
                        <div>
                            <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Location</div>
                            <div className="flex items-center gap-2 text-slate-900">
                                <MapPin size={18} className="text-slate-400" />
                                {safeShift.location || 'Unknown Location'}
                            </div>
                        </div>

                        {/* Notes */}
                        <div>
                            <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Notes</div>
                            <div className={`p-4 rounded-xl text-sm ${safeShift.notes ? 'bg-slate-50 text-slate-700' : 'bg-slate-50 text-slate-400 italic'}`}>
                                {safeShift.notes || 'No notes for this shift.'}
                            </div>
                        </div>

                    </div>
                </div>

                {/* Calculated Card */}
                <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                    <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50">
                        <h2 className="font-semibold text-slate-900">Calculated</h2>
                    </div>
                    <div className="p-6 space-y-4">
                        <div className="flex justify-between items-center">
                            <span className="text-slate-500">Total Duration</span>
                            <span className="font-medium text-slate-900 tabular-nums">{totalDurationDisplay}</span>
                        </div>
                        <div className="flex justify-between items-center">
                            <span className="text-slate-500">Break Duration</span>
                            <span className="font-medium text-slate-900 tabular-nums">{breakDurationDisplay}</span>
                        </div>
                        <div className="flex justify-between items-center bg-slate-50 p-3 rounded-lg -mx-3">
                            <span className="text-slate-700 font-medium">Working Time</span>
                            <span className="font-bold text-slate-900 tabular-nums">{workingTimeDisplay}</span>
                        </div>
                        <div className="border-t border-slate-100 pt-4 mt-2 flex justify-between items-center">
                            <span className="text-slate-500">Earnings</span>
                            <span className="font-bold text-emerald-600 text-xl tabular-nums">{earningsDisplay}</span>
                        </div>
                    </div>
                </div>

                {/* Danger Zone */}
                <div className="border border-red-200 rounded-2xl p-6 bg-red-50/30">
                    <h3 className="text-red-600 font-bold mb-4">Danger Zone</h3>
                    <DeleteShiftButton shiftId={shiftId} />
                </div>

            </div>
        </div>
    )
}
