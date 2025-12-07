'use server'

import { createClient } from '@/utils/supabase/server'
import { revalidatePath } from 'next/cache'

export type ActionState = {
    error?: string
    success?: boolean
    message?: string
}

export async function clockIn(
    prevState: ActionState,
    formData: FormData
): Promise<ActionState> {
    console.log('[clockIn] Action started')
    const supabase = await createClient()

    // Get user
    const {
        data: { user },
        error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
        console.error('[clockIn] Auth error or no user:', authError)
        return { error: 'Not authenticated', success: false }
    }
    console.log('[clockIn] User found:', user.id)

    // Check if active shift exists
    const { data: activeShift, error: fetchError } = await supabase
        .from('shifts')
        .select('id, start_time, end_time, status')
        .eq('user_id', user.id)
        .is('end_time', null)
        .maybeSingle()

    if (fetchError) {
        console.error('[clockIn] Error checking active shift:', fetchError)
        return {
            error: `Error checking shift status: ${fetchError.message}`,
            success: false,
        }
    }

    if (activeShift) {
        console.warn('[clockIn] User already active:', activeShift)
        return { error: 'You already have an active shift.', success: false }
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
            success: false,
        }
    }

    console.log('[clockIn] Insert success, revalidating...')
    revalidatePath('/app/dashboard')
    return { success: true, message: 'Clocked in successfully' }
}

export async function startBreak(
    prevState: ActionState,
    formData: FormData
): Promise<ActionState> {
    console.log('[startBreak] Action started')
    const supabase = await createClient()

    const {
        data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
        return { error: 'Not authenticated', success: false }
    }

    // Check for active shift that is NOT on break
    const { data: shift, error: fetchError } = await supabase
        .from('shifts')
        .select('id, start_time, status')
        .eq('user_id', user.id)
        .is('end_time', null)
        .is('break_start', null)
        .single() // Should strictly have one active shift not on break

    if (fetchError || !shift) {
        console.error('[startBreak] No suitable active shift found:', fetchError)
        return { error: 'No active shift found or already on break.', success: false }
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
            success: false,
        }
    }

    revalidatePath('/app/dashboard')
    return { success: true, message: 'Break started' }
}

export async function endBreak(
    prevState: ActionState,
    formData: FormData
): Promise<ActionState> {
    console.log('[endBreak] Action started')
    const supabase = await createClient()

    const {
        data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
        return { error: 'Not authenticated', success: false }
    }

    // Check for shift currently ON BREAK
    const { data: shift, error: fetchError } = await supabase
        .from('shifts')
        .select('id, break_start')
        .eq('user_id', user.id)
        .is('end_time', null)
        .not('break_start', 'is', null)
        .is('break_end', null)
        .single()

    if (fetchError || !shift) {
        console.error('[endBreak] No active break found:', fetchError)
        return { error: 'No active break found.', success: false }
    }

    const now = new Date()
    const nowIso = now.toISOString()
    const breakStart = new Date(shift.break_start)
    const diffMs = now.getTime() - breakStart.getTime()
    const minutes = Math.floor(diffMs / 60000)

    const { error: updateError } = await supabase
        .from('shifts')
        .update({
            break_end: nowIso,
            break_duration_minutes: minutes,
            status: 'active',
        })
        .eq('id', shift.id)
        .eq('user_id', user.id)

    if (updateError) {
        console.error('[endBreak] Update error:', updateError)
        return {
            error: `Failed to end break: ${updateError.message}`,
            success: false,
        }
    }

    revalidatePath('/app/dashboard')
    return { success: true, message: 'Break ended' }
}

export async function clockOut(
    shiftId: number,
    prevState: ActionState,
    formData: FormData
): Promise<ActionState> {
    console.log('[clockOut] Action started for shift:', shiftId)
    const supabase = await createClient()
    const {
        data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
        return { error: 'Not authenticated', success: false }
    }

    // Fetch the shift to get/verify state
    const { data: shift, error: fetchError } = await supabase
        .from('shifts')
        .select('start_time, break_start, break_end, break_duration_minutes')
        .eq('id', shiftId)
        .eq('user_id', user.id)
        .single()

    if (fetchError || !shift) {
        console.error('[clockOut] Shift not found or access denied:', fetchError)
        return { error: 'Shift not found', success: false }
    }

    const now = new Date()
    const endTimeIso = now.toISOString()

    // 1. Handle open break if exists
    let breakDurationMinutes = shift.break_duration_minutes || 0
    let breakEndIso = shift.break_end

    if (shift.break_start && !shift.break_end) {
        const breakStart = new Date(shift.break_start)
        const breakDiffMs = now.getTime() - breakStart.getTime()
        const currentBreakMinutes = Math.floor(breakDiffMs / 60000)

        breakDurationMinutes = currentBreakMinutes // Assuming single break, overwrite or add if supporting accumulated (we support 1)
        breakEndIso = endTimeIso // End break when ending shift
    }

    // 2. Calculate Hours
    const startTime = new Date(shift.start_time)
    const diffMs = now.getTime() - startTime.getTime()
    let rawHours = diffMs / (1000 * 60 * 60)

    // Calculate effective hours (raw - break)
    // breakDurationMinutes is in minutes, convert to hours
    const breakHours = breakDurationMinutes / 60
    let effectiveHours = rawHours - breakHours

    // Clamp to non-negative
    if (effectiveHours < 0) effectiveHours = 0

    // Round to 2 decimal places
    rawHours = Math.round(rawHours * 100) / 100
    effectiveHours = Math.round(effectiveHours * 100) / 100

    console.log('[clockOut] Updating shift:', { rawHours, effectiveHours, breakDurationMinutes })

    // Prepare update payload
    // We use a specific type or just let TypeScript infer from the object literal which is compatible with Supabase types
    const updatePayload = {
        end_time: endTimeIso,
        status: 'completed',
        raw_hours: rawHours,
        effective_hours: effectiveHours,
        break_duration_minutes: breakDurationMinutes,
        // Only include break_end if we computed a new one (or it exists). 
        // If it was null and we didn't close a break, it stays null (we don't need to send undefined).
        // But if we have a value we want to ensure it is set.
        ...(breakEndIso ? { break_end: breakEndIso } : {})
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
            success: false,
        }
    }

    console.log('[clockOut] Shift updated successfully')
    revalidatePath('/app/dashboard')
    return { success: true, message: 'Clocked out successfully' }
}
