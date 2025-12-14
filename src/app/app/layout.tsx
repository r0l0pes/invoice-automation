import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import { ReactNode } from 'react'

export default async function AppLayout({ children }: { children: ReactNode }) {
    const supabase = await createClient()

    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
        redirect('/login')
    }

    const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single()

    // Strict Guard: Managers NOT allowed here
    if (profile?.role === 'manager') {
        redirect('/manager/dashboard')
    }

    return (
        <div className="min-h-screen bg-slate-50">
            {children}
        </div>
    )
}
