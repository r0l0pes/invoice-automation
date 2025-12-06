'use client'

import { useActionState } from 'react'
import { login } from './actions'

export default function LoginForm() {
    const [state, formAction, isPending] = useActionState(login, null)

    return (
        <form action={formAction} className="space-y-5">
            <div>
                <label
                    htmlFor="email"
                    className="block text-sm font-medium text-slate-700"
                >
                    Email
                </label>
                <input
                    id="email"
                    name="email"
                    type="email"
                    required
                    className="mt-1 block w-full rounded-lg border-slate-200 px-3 py-2 shadow-sm focus:border-slate-500 focus:outline-none focus:ring-slate-500 sm:text-sm text-slate-900 border"
                />
            </div>

            <div>
                <label
                    htmlFor="password"
                    className="block text-sm font-medium text-slate-700"
                >
                    Password
                </label>
                <input
                    id="password"
                    name="password"
                    type="password"
                    required
                    className="mt-1 block w-full rounded-lg border-slate-200 px-3 py-2 shadow-sm focus:border-slate-500 focus:outline-none focus:ring-slate-500 sm:text-sm text-slate-900 border"
                />
            </div>

            {state?.error && (
                <div className="text-red-500 text-sm text-center bg-red-50 p-2 rounded">{state.error}</div>
            )}

            <button
                type="submit"
                disabled={isPending}
                className="w-full flex justify-center py-3 px-4 border border-transparent rounded-full shadow-sm text-sm font-medium text-white bg-slate-900 hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-slate-900 disabled:opacity-50 transition-colors"
            >
                {isPending ? 'Signing in...' : 'Log in'}
            </button>
        </form>
    )
}
