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

    console.log('Login successful for user:', data.user.id)

    // Fetch profile to check role
    const { data: rawProfile, error: profileError } = await supabase
        .from('profiles')
        .select('role, full_name')
        .eq('id', data.user.id)
        .single()

    const profile = rawProfile as Profile | null

    if (profileError) {
        console.error('Error fetching profile:', profileError)
        return { error: 'Failed to retrieve user profile. Please contact support.' }
    }

    if (!profile) {
        console.error('Profile not found for user:', data.user.id)
        return { error: 'Profile not found.' }
    }

    console.log('Fetched profile:', profile)

    revalidatePath('/', 'layout')

    // Strict redirect logic
    if (profile.role === 'manager') {
        console.log('Redirecting to /manager/shifts')
        redirect('/manager/shifts')
    } else {
        console.log('Redirecting to /app/dashboard')
        redirect('/app/dashboard')
    }
}
