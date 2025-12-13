'use server'

import { createClient } from '@/utils/supabase/server'
import { revalidatePath } from 'next/cache'

export async function deleteShift(shiftId: number) {
    const supabase = await createClient()

    // Verify manager role
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Unauthorized')

    const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single()

    if (profile?.role !== 'manager') {
        throw new Error('Unauthorized')
    }

    const { error } = await supabase
        .from('shifts')
        .delete()
        .eq('id', shiftId)

    if (error) {
        console.error('Error deleting shift:', error)
        return { error: error.message }
    }

    revalidatePath('/manager/shifts')
    revalidatePath('/manager/shifts')
    return { success: true }
}

export async function updateShift(shiftId: number, data: Record<string, unknown>) {
    const supabase = await createClient()

    // Verify manager role
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { error: 'Unauthorized' }

    const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single()

    if (profile?.role !== 'manager') {
        return { error: 'Unauthorized' }
    }

    // Clean data (ensure we don't send undefined/null for fields that shouldn't be null if not intended)
    // For now we pass 'data' through, but we should probably validate it.

    // Recalculate derived fields if necessary?
    // For now, assume the client sends correct data or we just update what's sent.
    // Ideally we should recalculate duration/hours here if times changed.

    // Let's rely on the fields passed.

    const { error } = await supabase
        .from('shifts')
        .update(data)
        .eq('id', shiftId)

    if (error) {
        console.error('Error updating shift:', error)
        return { error: error.message }
    }

    revalidatePath('/manager/shifts')
    revalidatePath(`/manager/shifts/${shiftId}`)
    return { success: true }
}
