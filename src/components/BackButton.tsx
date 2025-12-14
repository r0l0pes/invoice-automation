'use client'

import { useRouter } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'

interface BackButtonProps {
    fallbackRoute: string
    label?: string
}

export default function BackButton({ fallbackRoute, label = 'Back' }: BackButtonProps) {
    const router = useRouter()

    const handleBack = () => {
        if (window.history.length > 2) {
            router.back()
        } else {
            router.push(fallbackRoute)
        }
    }

    return (
        <button
            onClick={handleBack}
            className="flex items-center gap-3 group"
        >
            <div className="p-2 -ml-2 text-slate-600 group-hover:bg-slate-50 rounded-full transition-colors">
                <ArrowLeft size={20} />
            </div>
            <span className="font-semibold text-slate-700 group-hover:text-slate-900 transition-colors">{label}</span>
        </button>
    )
}
