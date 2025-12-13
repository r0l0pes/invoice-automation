'use client'

import { useActionState, useEffect, useState } from 'react'
import Link from 'next/link'
import { clockIn, clockOut, startBreak, endBreak } from './actions'

interface Shift {
    id: number
    start_time: string
    end_time: string | null
    break_start: string | null
    break_end: string | null
    break_duration_minutes: number | null
    date: string | null
    status: string
    raw_hours: number | null
    effective_hours: number | null
}

interface DashboardFeatureProps {
    userProfile: { full_name: string | null } | null
    userEmail?: string
    activeShift: Shift | null
    history: Shift[]
}

const formatTime = (isoString?: string) => {
    if (!isoString) return ''
    const d = new Date(isoString)
    const h = d.getHours().toString().padStart(2, '0')
    const m = d.getMinutes().toString().padStart(2, '0')
    return `${h}:${m}`
}

const formatDateLabel = (isoString?: string) => {
    if (!isoString) return ''
    const d = new Date(isoString)
    const today = new Date()
    const isToday = d.toDateString() === today.toDateString()

    const dayStr = d.toLocaleDateString([], { day: 'numeric', month: 'short' })
    return isToday ? `Today – ${dayStr}` : dayStr
}


export default function DashboardFeature({ userProfile, userEmail, activeShift, history }: DashboardFeatureProps) {
    const [inState, inAction, inPending] = useActionState(clockIn, { success: false })

    // Group history by day
    const groupedHistory = history.reduce((acc, shift) => {
        const dateKey = shift.date || shift.start_time.split('T')[0]
        if (!acc[dateKey]) acc[dateKey] = []
        acc[dateKey].push(shift)
        return acc
    }, {} as Record<string, Shift[]>)

    // Sort days descending
    const sortedDays = Object.keys(groupedHistory).sort((a, b) => new Date(b).getTime() - new Date(a).getTime())

    return (
        <div className="flex min-h-[calc(100vh-80px)] flex-col items-center px-4 py-8 text-slate-900">
            <header className="w-full max-w-xl flex justify-between items-center mb-6">
                <div>
                    <h1 className="text-xl font-semibold text-slate-50">Dashboard</h1>
                    <p className="text-sm text-slate-400">
                        {userProfile?.full_name || userEmail}
                    </p>
                </div>
            </header>

            {/* Active Shift Card */}
            <div className="w-full max-w-xl bg-white rounded-2xl shadow-md p-6 mb-6">
                <h2 className="text-lg sm:text-xl font-semibold mb-4 text-slate-900">Current Status</h2>

                {activeShift ? (
                    <ActiveShiftControl activeShift={activeShift} />
                ) : (
                    <div className="text-center">
                        <div className="mb-4">
                            <span className="inline-block px-3 py-1 rounded-full bg-slate-100 text-slate-600 text-sm font-medium">
                                Clocked Out
                            </span>
                        </div>
                        <p className="text-slate-500 mb-6">
                            Ready to start your shift?
                        </p>

                        <form action={inAction}>
                            {inState?.error && (
                                <div className="mb-4 p-3 bg-red-50 text-red-600 text-sm rounded-lg border border-red-200">
                                    {inState.error}
                                </div>
                            )}
                            <button
                                type="submit"
                                disabled={inPending}
                                className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-semibold py-3 px-4 rounded-xl transition-colors"
                            >
                                {inPending ? 'Starting Shift...' : 'Start Shift'}
                            </button>
                        </form>
                    </div>
                )}
            </div>

            {/* Recent History */}
            {history && history.length > 0 && (
                <div className="w-full max-w-xl bg-white rounded-3xl shadow-lg px-6 py-6">
                    <div className="flex justify-between items-baseline mb-4">
                        <h3 className="text-lg sm:text-xl font-semibold text-slate-900">Recent activity</h3>
                        <Link href="/app/shifts" className="text-sm font-medium text-blue-600 hover:text-blue-700 transition-colors">
                            View Full History
                        </Link>
                    </div>

                    <div className="space-y-6">
                        {sortedDays.map((dayKey) => (
                            <div key={dayKey}>
                                <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-400 mb-2">
                                    {formatDateLabel(dayKey)}
                                </div>
                                <ul className="space-y-2">
                                    {groupedHistory[dayKey].map(shift => (
                                        <HistoryItem key={shift.id} shift={shift} />
                                    ))}
                                </ul>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    )
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

function HistoryItem({ shift }: { shift: Shift }) {
    const isCompleted = !!shift.end_time
    const isActive = !isCompleted // "Active" in the broad sense (clocked in)
    const isCancelled = shift.status === 'cancelled'

    // Status Logic
    let statusLabel = 'Completed'
    let badgeClass = 'bg-slate-100 text-slate-600'
    let rowBg = 'bg-slate-50'

    if (isCancelled) {
        statusLabel = 'Cancelled'
        badgeClass = 'bg-red-100 text-red-700'
    } else if (isActive) {
        if (shift.status === 'on_break') {
            statusLabel = 'On Break'
            badgeClass = 'bg-amber-100 text-amber-700'
        } else {
            statusLabel = 'Active'
            badgeClass = 'bg-green-100 text-green-700'
        }
        rowBg = 'bg-emerald-50' // Highlight active rows slightly
    }

    // Line 1: Times
    const timeDisplay = isCompleted
        ? `${formatTime(shift.start_time)} — ${formatTime(shift.end_time!)}`
        : `${formatTime(shift.start_time)} — Active`

    // Line 2: Hours details
    // "Worked: 15 min" or "Worked: 1.25h"
    const workedDisplay = `Worked: ${formatDuration(shift.effective_hours ?? shift.raw_hours ?? 0)}`

    // Only show break info if there is recorded break duration > 0
    const breakMins = shift.break_duration_minutes || 0
    const breakHours = breakMins / 60
    const breakDisplay = breakMins > 0
        ? ` · Break: ${formatDuration(breakHours)}`
        : ''

    return (
        <li className={`flex items-center justify-between rounded-2xl px-4 py-3 ${isActive ? rowBg : 'bg-slate-50'}`}>
            <div>
                <div className="text-sm font-medium text-slate-900" suppressHydrationWarning>
                    {timeDisplay}
                </div>
                <div className="mt-1 text-xs text-slate-500">
                    {workedDisplay}{breakDisplay}
                </div>
            </div>
            <div>
                <span className={`inline-flex items-center justify-center rounded-full px-3 py-1 text-xs font-medium ${badgeClass}`}>
                    {statusLabel}
                </span>
            </div>
        </li>
    )
}

function ActiveShiftControl({ activeShift }: { activeShift: Shift }) {
    const isOnBreak = activeShift.status === 'on_break'

    // Actions
    const clockOutWithId = clockOut.bind(null, activeShift.id)
    const [outState, outAction, outPending] = useActionState(clockOutWithId, { success: false })

    const [breakStartState, breakStartAction, breakStartPending] = useActionState(startBreak, { success: false })
    const [breakEndState, breakEndAction, breakEndPending] = useActionState(endBreak, { success: false })

    // Timer logic
    // If on break, we show break timer (from break_start)
    // If active, we show shift timer (from start_time)
    // NOTE: If status is 'on_break', break_start MUST be set by server action. 
    // Fallback? If null, maybe use now? But that would reset timer. Rely on server.
    const startTimeProp = isOnBreak && activeShift.break_start ? activeShift.break_start : activeShift.start_time

    // Timer hook
    const [elapsed, setElapsed] = useState<string>('00:00:00')

    useEffect(() => {
        const updateTimer = () => {
            const start = new Date(startTimeProp).getTime()
            const now = new Date().getTime()
            const diff = Math.max(0, now - start)

            const totalSeconds = Math.floor(diff / 1000)
            const hours = Math.floor(totalSeconds / 3600)
            const minutes = Math.floor((totalSeconds % 3600) / 60)
            const seconds = totalSeconds % 60

            const hStr = hours.toString().padStart(2, '0')
            const mStr = minutes.toString().padStart(2, '0')
            const sStr = seconds.toString().padStart(2, '0')

            setElapsed(`${hStr}:${mStr}:${sStr}`)
        }

        updateTimer()
        const intervalId = setInterval(updateTimer, 1000)
        return () => clearInterval(intervalId)
    }, [startTimeProp])

    // Common error display
    const error = outState.error || breakStartState.error || breakEndState.error

    if (isOnBreak) {
        return (
            <div className="text-center">
                <div className="mb-4">
                    <span className="inline-block px-3 py-1 rounded-full bg-amber-100 text-amber-700 text-sm font-medium">
                        On Break
                    </span>
                </div>

                <p className="text-4xl sm:text-5xl font-bold mb-1 text-slate-900 tabular-nums tracking-tight">
                    {elapsed}
                </p>

                <div className="text-slate-500 text-sm mb-6 flex flex-col gap-1">
                    <span suppressHydrationWarning>On break since {formatTime(activeShift.break_start!)}</span>
                    <span className="text-xs" suppressHydrationWarning>Shift started at {formatTime(activeShift.start_time)}</span>
                </div>

                {error && (
                    <div className="mb-4 p-3 bg-red-50 text-red-600 text-sm rounded-lg border border-red-200">
                        {error}
                    </div>
                )}

                <div className="space-y-3">
                    <form action={breakEndAction}>
                        <button
                            type="submit"
                            disabled={breakEndPending}
                            className="w-full bg-amber-500 hover:bg-amber-600 disabled:bg-amber-400 text-white font-semibold py-3 px-4 rounded-xl transition-colors"
                        >
                            {breakEndPending ? 'Ending Break...' : 'End Break'}
                        </button>
                    </form>

                    {/* Optional: End shift directly from break? Only if requested/supported. Keeping plain End Shift button as secondary */}
                    <form action={outAction}>
                        <button
                            type="submit"
                            disabled={outPending}
                            className="w-full bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 font-medium py-3 px-4 rounded-xl transition-colors text-sm"
                        >
                            {outPending ? 'Ending Shift...' : 'End Shift'}
                        </button>
                    </form>
                </div>
            </div>
        )
    }

    // Normal Active State
    return (
        <div className="text-center">
            <div className="mb-4">
                <span className="inline-block px-3 py-1 rounded-full bg-green-100 text-green-700 text-sm font-medium">
                    Clocked In
                </span>
            </div>

            <p className="text-4xl sm:text-5xl font-bold mb-1 text-slate-900 tabular-nums tracking-tight">
                {elapsed}
            </p>

            <p className="text-slate-500 text-sm mb-6" suppressHydrationWarning>
                Started at {formatTime(activeShift.start_time)}
            </p>

            {error && (
                <div className="mb-4 p-3 bg-red-50 text-red-600 text-sm rounded-lg border border-red-200">
                    {error}
                </div>
            )}

            <div className="space-y-3">
                <form action={outAction}>
                    <button
                        type="submit"
                        disabled={outPending}
                        className="w-full bg-red-600 hover:bg-red-700 disabled:bg-red-400 text-white font-semibold py-3 px-4 rounded-xl transition-colors"
                    >
                        {outPending ? 'Ending Shift...' : 'End Shift'}
                    </button>
                </form>

                <form action={breakStartAction}>
                    <button
                        type="submit"
                        disabled={breakStartPending}
                        className="w-full bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 font-medium py-3 px-4 rounded-xl transition-colors"
                    >
                        {breakStartPending ? 'Starting Break...' : 'Start Break'}
                    </button>
                </form>
            </div>
        </div>
    )
}
