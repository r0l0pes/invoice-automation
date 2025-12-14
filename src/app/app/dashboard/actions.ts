'use server'

import { createClient } from '@/utils/supabase/server'
import { revalidatePath } from 'next/cache'

export type ActionState = {
    error?: string
    ok: boolean
    message?: string
}

export async function clockIn(
    _prevState: ActionState,
    _formData: FormData
): Promise<ActionState> {
    try {
        console.log('[clockIn] Action started')
        const supabase = await createClient()

        // Get user
        const {
            data: { user },
            error: authError,
        } = await supabase.auth.getUser()

        if (authError || !user) {
            console.error('[clockIn] Auth error or no user:', authError)
            return { error: 'Not authenticated', ok: false }
        }
        console.log('[clockIn] User found:', user.id)

        // Check if active or on_break shift exists
        const { data: activeShift, error: fetchError } = await supabase
            .from('shifts')
            .select('id, status')
            .eq('user_id', user.id)
            .in('status', ['active', 'on_break'])
            .is('end_time', null)
            .maybeSingle()

        if (fetchError) {
            console.error('[clockIn] Error checking active shift:', fetchError)
            return {
                error: `Error checking shift status: ${fetchError.message}`,
                ok: false,
            }
        }

        if (activeShift) {
            console.warn('[clockIn] User already active or on break:', activeShift)
            return { error: 'You already have an active shift.', ok: false }
        }

        const now = new Date()
        const dateStr = now.toISOString().split('T')[0]

        console.log('[clockIn] Inserting shift...')

        const { error: insertError } = await supabase.from('shifts').insert({
            user_id: user.id,
            date: dateStr,
            start_time: now.toISOString(),
            status: 'active',
        })

        if (insertError) {
            console.error('[clockIn] Insert error:', insertError)
            return {
                error: `Failed to start shift: ${insertError.message}`,
                ok: false,
            }
        }

        console.log('[clockIn] Insert success, revalidating...')
        revalidatePath('/app/dashboard')
        return { ok: true, message: 'Clocked in successfully' }
    } catch (err) {
        console.error('[clockIn] Unexpected error:', err)
        const message = err instanceof Error ? err.message : 'An unexpected error occurred.'
        return { ok: false, error: message }
    }
}

export async function startBreak(
    _prevState: ActionState,
    _formData: FormData
): Promise<ActionState> {
    try {
        console.log('[startBreak] Action started')
        const supabase = await createClient()

        const {
            data: { user },
        } = await supabase.auth.getUser()

        if (!user) {
            return { error: 'Not authenticated', ok: false }
        }

        // Check for active shift with status='active' (implies not on break)
        // We strictly require status to be 'active' to start a break.
        const { data: shift, error: fetchError } = await supabase
            .from('shifts')
            .select('id, status, break_start')
            .eq('user_id', user.id)
            .eq('status', 'active')
            .is('end_time', null)
            .single()

        if (fetchError || !shift) {
            console.error('[startBreak] No suitable active shift found:', fetchError)
            // Check if maybe they are already on break?
            const { data: breakShift } = await supabase
                .from('shifts')
                .select('id')
                .eq('user_id', user.id)
                .eq('status', 'on_break')
                .single()

            if (breakShift) {
                return { error: 'You are already on a break.', ok: false }
            }

            return { error: 'No active shift found to start break.', ok: false }
        }

        const now = new Date().toISOString()

        const { error: updateError } = await supabase
            .from('shifts')
            .update({
                break_start: now,
                status: 'on_break',
            })
            .eq('id', shift.id)
            .eq('user_id', user.id)

        if (updateError) {
            console.error('[startBreak] Update error:', updateError)
            return {
                error: `Failed to start break: ${updateError.message}`,
                ok: false,
            }
        }

        revalidatePath('/app/dashboard')
        return { ok: true, message: 'Break started' }
    } catch (err) {
        console.error('[startBreak] Unexpected error:', err)
        const message = err instanceof Error ? err.message : 'An unexpected error occurred.'
        return { ok: false, error: message }
    }
}

export async function endBreak(
    _prevState: ActionState,
    _formData: FormData
): Promise<ActionState> {
    try {
        console.log('[endBreak] Action started')
        const supabase = await createClient()

        const {
            data: { user },
        } = await supabase.auth.getUser()

        if (!user) {
            return { error: 'Not authenticated', ok: false }
        }

        // Check for shift currently ON BREAK
        const { data: shift, error: fetchError } = await supabase
            .from('shifts')
            .select('id, break_start, break_duration_minutes, user_id, status')
            .eq('user_id', user.id)
            .eq('status', 'on_break')
            .is('end_time', null)
            .single()

        if (fetchError || !shift) {
            console.error('[endBreak] No active break found:', fetchError)
            return { error: 'No active break to end.', ok: false }
        }

        // Safety check: break_start should be present if status is on_break
        if (!shift.break_start) {
            console.error('[endBreak] Break start time not found for shift:', shift.id)
            return { error: 'Cannot end break: break start time not found.', ok: false }
        }

        const now = new Date()
        const breakStart = new Date(shift.break_start)
        const diffMs = now.getTime() - breakStart.getTime()

        // Integer number of minutes
        const breakMinutes = Math.round(diffMs / (1000 * 60))

        const previous = shift.break_duration_minutes || 0
        const totalBreakMinutes = previous + breakMinutes // Integer accumulation

        console.log('[endBreak] Calculation:', {
            breakStart: shift.break_start,
            now: now.toISOString(),
            diffMs,
            breakMinutes,
            previous,
            totalBreakMinutes
        })

        const { error: updateError } = await supabase
            .from('shifts')
            .update({
                break_end: now.toISOString(),
                break_duration_minutes: totalBreakMinutes, // Integer
                status: 'active',
            })
            .eq('id', shift.id)
            .eq('user_id', user.id)

        if (updateError) {
            console.error('[endBreak] Update error:', updateError)
            return {
                error: `Failed to end break: ${updateError.message}`,
                ok: false,
            }
        }

        revalidatePath('/app/dashboard')
        return { ok: true, message: 'Break ended' }
    } catch (err) {
        console.error('[endBreak] Unexpected error:', err)
        const message = err instanceof Error ? err.message : 'An unexpected error occurred.'
        return { ok: false, error: message }
    }
}

export async function clockOut(
    shiftId: number,
    _prevState: ActionState,
    _formData: FormData
): Promise<ActionState> {
    try {
        console.log('[clockOut] Action started for shift:', shiftId)
        const supabase = await createClient()
        const {
            data: { user },
        } = await supabase.auth.getUser()

        if (!user) {
            return { error: 'Not authenticated', ok: false }
        }

        // Fetch the shift to get/verify state
        // We strictly need start_time and break_duration_minutes
        // We also need break_start/status to handle the "clock out while on break" case
        const { data: shift, error: fetchError } = await supabase
            .from('shifts')
            .select('id, start_time, status, break_start, break_duration_minutes')
            .eq('id', shiftId)
            .eq('user_id', user.id)
            .single()

        if (fetchError || !shift) {
            console.error('[clockOut] Shift not found or access denied:', fetchError)
            return { error: 'Shift not found or already ended.', ok: false }
        }

        if (['completed', 'cancelled'].includes(shift.status)) {
            return { error: 'Shift is already ended.', ok: false }
        }

        const now = new Date()
        const endTimeIso = now.toISOString()

        // 1. Handle break calculation (Always INTEGER for minutes)
        let totalBreakMinutes = shift.break_duration_minutes || 0
        let breakEndIso: string | undefined

        // If status is on_break, we MUST calculate the finalizing segment
        if (shift.status === 'on_break') {
            if (!shift.break_start) {
                console.error('[clockOut] Shift is on_break but missing break_start')
                // Fallback: don't add extra minutes if data is corrupted, to avoid NaN
            } else {
                const breakStart = new Date(shift.break_start)
                const breakDiffMs = Math.max(0, now.getTime() - breakStart.getTime())
                const segmentMinutes = Math.round(breakDiffMs / (1000 * 60)) // Integer
                totalBreakMinutes += segmentMinutes
                breakEndIso = endTimeIso
            }
        }

        // 2. Calculate Hours
        const startTime = new Date(shift.start_time)
        const diffMs = Math.max(0, now.getTime() - startTime.getTime())

        // raw_hours (Numeric, 2 decimals)
        const rawHours = diffMs / (1000 * 60 * 60)

        // effective_hours (Numeric, 2 decimals)
        // totalBreakMinutes is Integer
        const totalBreakHours = totalBreakMinutes / 60
        let effectiveHours = rawHours - totalBreakHours

        // Clamp to non-negative
        if (effectiveHours < 0) effectiveHours = 0

        // Round to 2 decimal places for storage
        const roundedRawHours = Math.round(rawHours * 100) / 100
        const roundedEffectiveHours = Math.round(effectiveHours * 100) / 100

        console.log('[clockOut] Calculation:', {
            shiftId,
            userId: user.id,
            rawHours: roundedRawHours,
            effectiveHours: roundedEffectiveHours,
            totalBreakMinutes, // Should be int
            status: shift.status
        })

        // Prepare update payload
        const updatePayload = {
            end_time: endTimeIso,
            status: 'completed',
            raw_hours: roundedRawHours,
            effective_hours: roundedEffectiveHours,
            break_duration_minutes: undefined as number | undefined,
            break_end: undefined as string | undefined
        }

        if (shift.status === 'on_break') {
            updatePayload.break_duration_minutes = totalBreakMinutes
            updatePayload.break_end = breakEndIso
        }

        // Update shift
        const { error: updateError } = await supabase
            .from('shifts')
            .update(updatePayload)
            .eq('id', shiftId)
            .eq('user_id', user.id)

        if (updateError) {
            console.error('[clockOut] Update error:', updateError)
            return {
                error: `Failed to end shift: ${updateError.message}`,
                ok: false,
            }
        }

        console.log('[clockOut] Shift updated successfully')
        revalidatePath('/app/dashboard')
        return { ok: true, message: 'Clocked out successfully' }
    } catch (err) {
        console.error('[clockOut] Unexpected error:', err)
        const message = err instanceof Error ? err.message : 'An unexpected error occurred.'
        return { ok: false, error: message }
    }
}
