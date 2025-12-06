'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/utils/supabase/server'


interface FormState {
    error?: string
}

export async function login(prevState: FormState | null, formData: FormData) {
    const supabase = await createClient()

    const email = formData.get('email') as string
    const password = formData.get('password') as string

    const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
    })

    if (error) {
        return { error: error.message }
    }

    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
        return { error: 'Authentication failed' }
    }

    // Fetch profile to check role
    const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single()

    revalidatePath('/', 'layout')

    if (profile?.role === 'manager') {
        redirect('/manager/shifts')
    }

    redirect('/app/dashboard')
}
