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

    console.log('Attempting login for:', email)

    const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
    })

    if (error) {
        console.error('Login error:', error.message)
        return { error: error.message }
    }

    if (!data.user) {
        console.error('Login succeeded but no user returned')
        return { error: 'Authentication failed' }
    }

    console.log('Login successful for user:', data.user.id)

    // Fetch profile to check role
    // We use the supabase instance which should now have the session in memory
    const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('role, full_name')
        .eq('id', data.user.id)
        .single()

    if (profileError) {
        console.error('Error fetching profile:', profileError)
        // Fallback to dashboard if profile fetch fails, or handle error
        // For now, we'll log it and default to dashboard, but maybe we should error?
        // Let's assume default packer view if profile fails (safe fail)
    }

    console.log('Fetched profile:', profile)

    revalidatePath('/', 'layout')

    if (profile?.role === 'manager') {
        console.log('Redirecting to /manager/shifts')
        redirect('/manager/shifts')
    }

    console.log('Redirecting to /app/dashboard')
    redirect('/app/dashboard')
}
