'use client'

import { useState } from 'react'
import { Edit2, X, Save, AlertCircle } from 'lucide-react'
import { updateShift } from './actions'

interface ShiftData {
    start_time: string
    end_time: string | null
    break_start: string | null
    break_end: string | null
    packages: number | null
    location: string | null
    notes: string | null
}

interface EditShiftModalProps {
    shiftId: number
    initialData: ShiftData
    availableFields: string[]
}

export default function EditShiftModal({ shiftId, initialData, availableFields }: EditShiftModalProps) {
    const [isOpen, setIsOpen] = useState(false)
    const [isSaving, setIsSaving] = useState(false)
    const [error, setError] = useState<string | null>(null)

    // Helper to format ISO to datetime-local string (YYYY-MM-DDTHH:MM)
    const toLocalValue = (iso: string | null) => {
        if (!iso) return ''
        // Adjust to local time for input
        const date = new Date(iso)
        const offset = date.getTimezoneOffset()
        const local = new Date(date.getTime() - (offset * 60 * 1000))
        return local.toISOString().slice(0, 16)
    }

    // Form state
    const [formData, setFormData] = useState({
        start_time: toLocalValue(initialData.start_time),
        end_time: toLocalValue(initialData.end_time),
        break_start: toLocalValue(initialData.break_start),
        break_end: toLocalValue(initialData.break_end),
        packages: initialData.packages?.toString() || '',
        location: initialData.location || '',
        notes: initialData.notes || ''
    })

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target
        setFormData(prev => ({ ...prev, [name]: value }))
    }

    const validate = () => {
        if (!formData.start_time) return 'Start time is required'
        if (formData.end_time && formData.start_time > formData.end_time) {
            return 'End time must be after start time'
        }
        if (formData.break_start && formData.break_end) {
            if (formData.break_start > formData.break_end) {
                return 'Break end must be after break start'
            }
        }
        return null
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setError(null)

        const validationError = validate()
        if (validationError) {
            setError(validationError)
            return
        }

        setIsSaving(true)

        try {
            // Convert back to ISO
            // We need to be careful with timezones. datetime-local gives local time.
            // new Date(datetime-local string) creates date in local timezone.
            // toISOString() converts to UTC. This is what we want for Supabase generally.

            const payload: Record<string, unknown> = {
                start_time: new Date(formData.start_time).toISOString(),
            }

            // Only add fields if they are in the availableFields list (and therefore in DB)
            if (availableFields.includes('end_time')) {
                payload.end_time = formData.end_time ? new Date(formData.end_time).toISOString() : null
            }
            if (availableFields.includes('break_start')) {
                payload.break_start = formData.break_start ? new Date(formData.break_start).toISOString() : null
            }
            if (availableFields.includes('break_end')) {
                payload.break_end = formData.break_end ? new Date(formData.break_end).toISOString() : null
            }
            if (availableFields.includes('packages')) {
                payload.packages = formData.packages ? parseInt(formData.packages) : null
            }
            if (availableFields.includes('location')) {
                payload.location = formData.location || null
            }
            if (availableFields.includes('notes')) {
                payload.notes = formData.notes || null
            }


            // Recalculate derived fields?
            // If end_time exists, we should probably update raw_hours / effective_hours
            // But logic is complex (break duration etc).
            // For now, let's just update the fields and assume the server or next read handles it, 
            // OR we calculate basic hours here.

            // Basic raw_hours calculation
            if (payload.start_time && payload.end_time) {
                const start = new Date(payload.start_time as string).getTime()
                const end = new Date(payload.end_time as string).getTime()
                const durationMs = Math.max(0, end - start)
                const rawHours = durationMs / (1000 * 60 * 60)
                payload.raw_hours = Math.round(rawHours * 100) / 100

                // Calculate break duration
                let breakMinutes = 0
                if (payload.break_start && payload.break_end) {
                    const bs = new Date(payload.break_start as string).getTime()
                    const be = new Date(payload.break_end as string).getTime()
                    breakMinutes = Math.round((be - bs) / (1000 * 60))
                }
                payload.break_duration_minutes = breakMinutes

                const breakHours = breakMinutes / 60
                const eff = Math.max(0, rawHours - breakHours)
                payload.effective_hours = Math.round(eff * 100) / 100
            }

            const res = await updateShift(shiftId, payload)
            if (res.error) {
                setError(res.error)
            } else {
                setIsOpen(false)
            }
        } catch (err) {
            console.error(err)
            setError('An unexpected error occurred')
        } finally {
            setIsSaving(false)
        }
    }

    if (!isOpen) {
        return (
            <button
                onClick={() => setIsOpen(true)}
                className="items-center gap-2 bg-slate-900 hover:bg-slate-800 text-white px-4 py-2 rounded-lg font-medium transition-colors text-sm flex"
            >
                <Edit2 size={16} />
                Edit
            </button>
        )
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <div className="bg-white rounded-2xl w-full max-w-lg shadow-xl overflow-hidden max-h-[90vh] flex flex-col">
                <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                    <h2 className="text-lg font-bold text-slate-900">Edit Shift</h2>
                    <button onClick={() => setIsOpen(false)} className="text-slate-400 hover:text-slate-600 transition-colors">
                        <X size={20} />
                    </button>
                </div>

                <div className="p-6 overflow-y-auto">
                    {error && (
                        <div className="mb-4 bg-red-50 text-red-600 p-3 rounded-lg text-sm flex items-center gap-2">
                            <AlertCircle size={16} />
                            {error}
                        </div>
                    )}

                    <form id="edit-shift-form" onSubmit={handleSubmit} className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Clock In</label>
                                <input
                                    type="datetime-local"
                                    name="start_time"
                                    required
                                    value={formData.start_time}
                                    onChange={handleChange}
                                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-slate-900 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                                />
                            </div>
                            {availableFields.includes('end_time') && (
                                <div>
                                    <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Clock Out</label>
                                    <input
                                        type="datetime-local"
                                        name="end_time"
                                        value={formData.end_time}
                                        onChange={handleChange}
                                        className="w-full border border-slate-200 rounded-lg px-3 py-2 text-slate-900 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                                    />
                                </div>
                            )}
                        </div>

                        {(availableFields.includes('break_start') || availableFields.includes('break_end')) && (
                            <div className="grid grid-cols-2 gap-4">
                                {availableFields.includes('break_start') && (
                                    <div>
                                        <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Break Start</label>
                                        <input
                                            type="datetime-local"
                                            name="break_start"
                                            value={formData.break_start}
                                            onChange={handleChange}
                                            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-slate-900 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                                        />
                                    </div>
                                )}
                                {availableFields.includes('break_end') && (
                                    <div>
                                        <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Break End</label>
                                        <input
                                            type="datetime-local"
                                            name="break_end"
                                            value={formData.break_end}
                                            onChange={handleChange}
                                            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-slate-900 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                                        />
                                    </div>
                                )}
                            </div>
                        )}

                        {availableFields.includes('packages') && (
                            <div>
                                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Packages Packed</label>
                                <input
                                    type="number"
                                    name="packages"
                                    value={formData.packages}
                                    onChange={handleChange}
                                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-slate-900 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                                />
                            </div>
                        )}

                        {availableFields.includes('location') && (
                            <div>
                                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Location</label>
                                <input
                                    type="text"
                                    name="location"
                                    value={formData.location}
                                    onChange={handleChange}
                                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-slate-900 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                                />
                            </div>
                        )}

                        {availableFields.includes('notes') && (
                            <div>
                                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Notes</label>
                                <textarea
                                    name="notes"
                                    rows={3}
                                    value={formData.notes}
                                    onChange={handleChange}
                                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-slate-900 text-sm focus:ring-2 focus:ring-blue-500 outline-none resize-none"
                                />
                            </div>
                        )}
                    </form>
                </div>

                <div className="px-6 py-4 border-t border-slate-100 bg-slate-50 flex justify-end gap-3">
                    <button
                        onClick={() => setIsOpen(false)}
                        className="px-4 py-2 text-slate-600 font-medium text-sm hover:text-slate-900 transition-colors"
                        disabled={isSaving}
                    >
                        Cancel
                    </button>
                    <button
                        type="submit"
                        form="edit-shift-form"
                        disabled={isSaving}
                        className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium text-sm transition-colors flex items-center gap-2 disabled:opacity-50"
                    >
                        {isSaving ? 'Saving...' : (
                            <>
                                <Save size={16} />
                                Save Changes
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    )
}
