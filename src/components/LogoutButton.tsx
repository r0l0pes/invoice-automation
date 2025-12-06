'use client'

import { createClient } from '@/utils/supabase/client'
import { useRouter } from 'next/navigation'
import { useState } from 'react'

export default function LogoutButton() {
    const router = useRouter()
    const [loading, setLoading] = useState(false)

    const handleLogout = async () => {
        setLoading(true)
        const supabase = createClient()

        await supabase.auth.signOut()
        router.push('/login')
        router.refresh()
    }

    return (
        <button
            onClick={handleLogout}
            disabled={loading}
            className="text-sm font-medium text-gray-600 hover:text-gray-900 px-3 py-2 rounded-md hover:bg-gray-100 transition-colors disabled:opacity-50"
        >
            {loading ? 'Logging out...' : 'Log out'}
        </button>
    )
}
