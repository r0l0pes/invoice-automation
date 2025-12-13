'use client'

import React, { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Clock, Box, Search } from 'lucide-react'

// Helper for hydration-safe time display
const TimeDisplay = ({ iso }: { iso?: string | null }) => {
    // We only render on client to avoid hydration mismatch, or use suppressHydrationWarning
    // suppressHydrationWarning is better for SEO/performance than waiting for mount
    // But formatting depends on browser locale anyway for toLocaleTimeString
    // User requested: "Do NOT use locale-dependent formatting ... Use a fixed format (e.g. 24h HH:mm) consistently"

    if (!iso) return null

    // Fixed format HH:mm (24h)
    const date = new Date(iso)
    const hours = date.getHours().toString().padStart(2, '0')
    const minutes = date.getMinutes().toString().padStart(2, '0')
    const timeStr = `${hours}:${minutes}`

    return (
        <span suppressHydrationWarning>
            {timeStr}
        </span>
    )
}

interface Shift {
    id: number
    start_time: string
    end_time: string | null
    break_duration_minutes: number | null
    packages: number | null
    status: string
    effective_hours: number | null
    raw_hours: number | null
}

interface Profile {
    hourly_rate: number
}

interface ShiftHistoryViewProps {
    profile: Profile
    shifts: Shift[]
    initialFilter: string
}

export default function ShiftHistoryView({ profile, shifts, initialFilter }: ShiftHistoryViewProps) {
    const router = useRouter()

    const [searchQuery, setSearchQuery] = useState('')

    // Filters
    const tabs = [
        { id: 'week', label: 'This Week' },
        { id: 'month', label: 'This Month' },
        { id: 'all', label: 'All Time' },
    ]

    const handleTabChange = (filterId: string) => {
        router.push(`/app/shifts?filter=${filterId}`)
    }

    const displayedShifts = useMemo(() => {
        if (!searchQuery) return shifts
        const lower = searchQuery.toLowerCase()
        return shifts.filter(s => {
            const dateStr = s.start_time
            return dateStr.includes(lower)
        })
    }, [shifts, searchQuery])

    // Calculations
    const totals = useMemo(() => {
        let count = 0
        let totalHours = 0
        let totalEarnings = 0

        displayedShifts.forEach(shift => {
            if (!shift.end_time) return

            const start = new Date(shift.start_time).getTime()
            const end = new Date(shift.end_time).getTime()
            const diffMs = Math.max(0, end - start)
            const rawHrs = diffMs / (1000 * 60 * 60)

            const breakMins = shift.break_duration_minutes || 0
            const breakHrs = breakMins / 60

            // Working hours = Total Duration - Break Duration
            const workingHrs = Math.max(0, rawHrs - breakHrs)

            count++
            totalHours += workingHrs
            totalEarnings += workingHrs * profile.hourly_rate
        })

        return { count, totalHours, totalEarnings }
    }, [displayedShifts, profile.hourly_rate])

    // Formatters
    const formatCurrency = (val: number) => `€${val.toFixed(2)}`
    const formatHours = (val: number) => `${val.toFixed(1)}h`

    // Fixed Date Format for List
    const formatDate = (iso: string) => {
        const d = new Date(iso)
        // Fixed format: "Mon, Oct 28"
        // Again, to avoid hydration mismatch on server vs client locale if server is diff
        // We use suppressHydrationWarning wrapper or just use standard locale with suppression
        return d.toLocaleDateString('en-GB', { weekday: 'short', month: 'short', day: 'numeric' })
    }

    return (
        <div className="flex flex-col min-h-screen bg-slate-50 text-slate-900 pb-24 md:pb-8">
            {/* Header */}
            <div className="bg-white px-4 py-4 shadow-sm sticky top-0 z-10">
                <div className="max-w-xl mx-auto flex items-center gap-3">
                    <Link href="/app/dashboard" className="p-2 -ml-2 text-slate-600 hover:bg-slate-50 rounded-full transition-colors">
                        <ArrowLeft size={20} />
                    </Link>
                    <div>
                        <h1 className="text-xl font-bold text-slate-900 leading-tight">Shift History</h1>
                        <p className="text-xs text-slate-500">View all your completed shifts</p>
                    </div>
                </div>
            </div>

            <div className="max-w-xl mx-auto w-full px-4 pt-4 flex-1">
                {/* Search */}
                <div className="relative mb-4">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <Search className="h-5 w-5 text-slate-400" />
                    </div>
                    <input
                        type="text"
                        placeholder="Search by date..."
                        className="block w-full pl-10 pr-3 py-3 border border-slate-200 rounded-xl leading-5 bg-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                </div>

                {/* Filter Tabs */}
                <div className="flex p-1 bg-slate-100 rounded-xl mb-6">
                    {tabs.map((tab) => {
                        const isActive = initialFilter === tab.id
                        return (
                            <button
                                key={tab.id}
                                onClick={() => handleTabChange(tab.id)}
                                className={`flex-1 py-2 text-sm font-medium rounded-lg transition-all ${isActive
                                    ? 'bg-slate-900 text-white shadow-sm'
                                    : 'text-slate-500 hover:text-slate-700'
                                    }`}
                            >
                                {tab.label}
                            </button>
                        )
                    })}
                </div>

                {/* Shift List */}
                <div className="space-y-3">
                    {displayedShifts.length === 0 ? (
                        <div className="text-center py-12 text-slate-400">
                            No shifts found for this period.
                        </div>
                    ) : (
                        displayedShifts.map((shift) => {
                            // Per Item Calculations
                            const start = new Date(shift.start_time).getTime()
                            const end = shift.end_time ? new Date(shift.end_time).getTime() : start
                            const diffMs = Math.max(0, end - start)
                            const rawHrs = diffMs / (1000 * 60 * 60)
                            const breakMins = shift.break_duration_minutes || 0
                            const breakHrs = breakMins / 60
                            const workingHrs = Math.max(0, rawHrs - breakHrs)
                            const earnings = workingHrs * profile.hourly_rate
                            const packages = shift.packages || 0

                            return (
                                <div key={shift.id} className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100">
                                    <div className="flex justify-between items-start mb-2">
                                        <div>
                                            <h3 className="font-semibold text-slate-900 text-base" suppressHydrationWarning>
                                                {formatDate(shift.start_time)}
                                            </h3>
                                            <p className="text-slate-500 text-sm mt-0.5 flex gap-1 items-center">
                                                <TimeDisplay iso={shift.start_time} />
                                                <span>–</span>
                                                {shift.end_time ? <TimeDisplay iso={shift.end_time} /> : 'Incomplete'}
                                            </p>
                                        </div>
                                        <div className="text-right">
                                            <div className="font-bold text-slate-900 text-lg tabular-nums">
                                                {formatHours(workingHrs)}
                                            </div>
                                            <div className="text-emerald-600 font-medium text-sm tabular-nums">
                                                {formatCurrency(earnings)}
                                            </div>
                                        </div>
                                    </div>

                                    <div className="border-t border-slate-100 my-3"></div>

                                    <div className="flex items-center gap-6 text-sm text-slate-600">
                                        <div className="flex items-center gap-2">
                                            <Clock size={16} className="text-slate-400" />
                                            <span>Break: {formatHours(breakHrs)}</span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <Box size={16} className="text-slate-400" />
                                            <span>{packages} packages</span>
                                        </div>
                                    </div>
                                </div>
                            )
                        })
                    )}
                </div>
            </div>

            {/* Bottom Totals Bar */}
            <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)] safe-area-pb">
                <div className="max-w-xl mx-auto px-6 py-4 grid grid-cols-3 gap-4 text-center">
                    <div>
                        <div className="text-xs text-slate-500 font-medium uppercase tracking-wider mb-1">Total Shifts</div>
                        <div className="text-lg font-bold text-slate-900">{totals.count}</div>
                    </div>
                    <div className="border-x border-slate-100">
                        <div className="text-xs text-slate-500 font-medium uppercase tracking-wider mb-1">Total Hours</div>
                        <div className="text-lg font-bold text-slate-900">{formatHours(totals.totalHours)}</div>
                    </div>
                    <div>
                        <div className="text-xs text-slate-500 font-medium uppercase tracking-wider mb-1">Total Earnings</div>
                        <div className="text-lg font-bold text-emerald-600">{formatCurrency(totals.totalEarnings)}</div>
                    </div>
                </div>
            </div>

            {/* Spacer for bottom bar */}
            <div className="h-24 md:h-0"></div>
        </div>
    )
}
