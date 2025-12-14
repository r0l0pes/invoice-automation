import { type NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { updateSession } from '@/utils/supabase/middleware'

export async function middleware(request: NextRequest) {
    // 1. Run the official Supabase auth middleware to refresh session
    const response = await updateSession(request)

    // If updateSession returned a redirect (e.g. to /login), let it pass through
    if (response.status >= 300 && response.status < 400) {
        return response
    }

    // 2. Paths to bypass (Public & Static)
    // We already have a specific matcher in config, but good to be explicit for safety
    const path = request.nextUrl.pathname

    // Static asset bypass: extensions or specific files
    if (
        // Common static files
        path === '/robots.txt' ||
        path === '/sitemap.xml' ||
        path === '/manifest.json' ||
        // Files with extensions (css, js, images, etc.)
        /\.[a-zA-Z0-9]+$/.test(path)
    ) {
        return response
    }

    // Public app routes
    if (
        path === '/' ||
        path.startsWith('/login') ||
        path.startsWith('/auth') ||
        path.startsWith('/api') ||
        path.startsWith('/_next') ||
        path.includes('favicon.ico')
    ) {
        // Optional: Redirect root to login explicitly
        if (path === '/') {
            const rootRedirect = NextResponse.redirect(new URL('/login', request.url))
            // Copy cookies from response to rootRedirect
            response.cookies.getAll().forEach((c) => rootRedirect.cookies.set(c))
            return rootRedirect
        }
        return response
    }

    // 3. Create a Supabase client to read the user/role for the guards
    // We CORRECTLY wire cookies so it sees the *fresh* session from updateSession()
    const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
            cookies: {
                getAll() {
                    // Merge properties: request cookies < response cookies
                    const allCookies: Record<string, string> = {}

                    // 1. Start with request cookies
                    request.cookies.getAll().forEach((c) => {
                        allCookies[c.name] = c.value
                    })

                    // 2. Override with any updated cookies from the response (refreshed session)
                    response.cookies.getAll().forEach((c) => {
                        allCookies[c.name] = c.value
                    })

                    // Return as array of objects
                    return Object.entries(allCookies).map(([name, value]) => ({
                        name,
                        value,
                    }))
                },
                setAll(cookiesToSet) {
                    // Only write to the OUTGOING response
                    cookiesToSet.forEach(({ name, value, options }) =>
                        response.cookies.set(name, value, options)
                    )
                },
            },
        }
    )

    // 4. Get User (safely using the fresh tokens if rotated)
    const {
        data: { user },
    } = await supabase.auth.getUser()

    // Protected Routes Check
    // Treat section membership robustly: exact match OR starts with prefix + /
    const isAppRoute = path === '/app' || path.startsWith('/app/')
    const isManagerRoute = path === '/manager' || path.startsWith('/manager/')

    if (isAppRoute || isManagerRoute) {
        // If no user, redirect to login
        if (!user) {
            const loginRedirect = NextResponse.redirect(new URL('/login', request.url))
            response.cookies.getAll().forEach((c) => loginRedirect.cookies.set(c))
            return loginRedirect
        }

        // If user exists, check role

        const { data: profile, error } = await supabase
            .from('profiles')
            .select('role')
            .eq('id', user.id)
            .single()

        if (error || !profile) {
            // Fail SAFE: If we can't determine role, do not allow access to protected routes.
            console.error('Middleware role fetch error:', error)
            const url = new URL('/login', request.url)
            // url.searchParams.set('error', 'role_verification_failed') 
            // Better not to expose error details in URL, just redirect to login to retry
            const redirectRes = NextResponse.redirect(url)
            response.cookies.getAll().forEach((c) => redirectRes.cookies.set(c))
            return redirectRes
        }

        const role = profile.role

        if (process.env.NODE_ENV !== 'production') {
            console.log(`[Middleware] Path: ${path}, User: ${user.email}, Role: ${role}`)
        }

        if (role === 'manager') {
            // Managers cannot access /app/* -> Redirect to /manager/dashboard
            // We redirect to dashboard specifically to ensure landing on the right page
            if (isAppRoute) {
                if (process.env.NODE_ENV !== 'production') console.log('[Middleware] Redirecting Manager to /manager/dashboard')
                const url = new URL('/manager/dashboard', request.url)
                const redirectRes = NextResponse.redirect(url)
                response.cookies.getAll().forEach((c) => redirectRes.cookies.set(c))
                return redirectRes
            }
        } else {
            // Treat anyone NOT a manager as a packer (or generic user)
            // Packers cannot access /manager/* -> Redirect to /app/dashboard
            if (isManagerRoute) {
                if (process.env.NODE_ENV !== 'production') console.log('[Middleware] Redirecting Packer/Guest to /app/dashboard')
                const url = new URL('/app/dashboard', request.url)
                const redirectRes = NextResponse.redirect(url)
                response.cookies.getAll().forEach((c) => redirectRes.cookies.set(c))
                return redirectRes
            }
        }
    }

    return response
}

export const config = {
    matcher: [
        '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
    ],
}
