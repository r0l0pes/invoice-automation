'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Trash2 } from 'lucide-react'
import { deleteShift } from './actions'

export default function DeleteShiftButton({ shiftId }: { shiftId: number }) {

    const router = useRouter()
    const [isDeleting, setIsDeleting] = useState(false)

    const handleDelete = async () => {
        const confirmed = window.confirm('Are you sure you want to delete this shift? This action cannot be undone.')
        if (!confirmed) return

        setIsDeleting(true)
        try {
            const res = await deleteShift(shiftId)
            if (res && res.error) {
                alert(res.error)
                setIsDeleting(false)
            } else if (res && res.success) {
                router.push('/manager/shifts')
                router.refresh()
            }
        } catch (error) {
            console.error(error)
            alert('Failed to delete shift')
            setIsDeleting(false)
        }
    }

    return (
        <button
            onClick={handleDelete}
            disabled={isDeleting}
            className="w-full flex items-center justify-center gap-2 bg-white border border-red-200 text-red-600 font-medium py-3 rounded-xl hover:bg-red-50 transition-colors disabled:opacity-50"
        >
            <Trash2 size={18} />
            {isDeleting ? 'Deleting...' : 'Delete Shift'}
        </button>
    )
}
