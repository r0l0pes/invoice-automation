'use client'

import { usePathname } from 'next/navigation'


export default function DebugBanner({ role, userEmail }: { role: string; userEmail?: string }) {
    const pathname = usePathname()


    return (
        <div className="fixed bottom-0 left-0 right-0 bg-white/90 border-t border-slate-200 text-slate-600 text-[10px] p-1.5 z-[9999] flex items-center justify-center gap-4 font-mono shadow-sm pointer-events-none">
            <span className="font-bold text-slate-800">ENV: {process.env.NODE_ENV}</span>
            <span>ROLE: <span className={role === 'manager' ? 'text-blue-600 font-bold' : role === 'packer' ? 'text-emerald-600 font-bold' : 'text-red-600 font-bold'}>{role}</span></span>
            <span>PATH: {pathname}</span>
            <span className="hidden sm:inline">USER: {userEmail || 'none'}</span>
        </div>
    )
}
