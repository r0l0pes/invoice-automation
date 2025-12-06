'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/utils/supabase/server'


interface FormState {
    error?: string
}

interface Profile {
    role: string | null
    full_name: string | null
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

    const userId = data.user.id
    console.log('Login successful for user:', userId)

    // Fetch profile to check role
    // Using maybeSingle() to avoid error on 0 rows, though strict error handling will catch it.
    const { data: rawProfile, error: profileError } = await supabase
        .from('profiles')
        .select('role, full_name')
        .eq('id', userId)
        .maybeSingle()

    const profile = rawProfile as Profile | null

    if (profileError) {
        console.error('profileError', profileError)
        return { error: 'Failed to retrieve user profile. Please contact support.' }
    }

    if (!profile) {
        console.error('Profile not found for user:', userId)
        return { error: 'Failed to retrieve user profile. Please contact support.' }
    }

    console.log('Fetched profile role:', profile.role)
    console.log('Redirecting based on role...')

    revalidatePath('/', 'layout')

    // Strict redirect logic
    if (profile.role === 'manager') {
        redirect('/manager/shifts')
    } else {
        redirect('/app/dashboard')
    }
}
