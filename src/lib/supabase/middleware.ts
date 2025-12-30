import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({
            request,
          })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // Refresh session if expired
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { pathname } = request.nextUrl

  // Public routes that don't require auth
  const publicRoutes = ['/login', '/invite']
  const isPublicRoute = publicRoutes.some(route => pathname.startsWith(route))
  const isApiRoute = pathname.startsWith('/api')

  // If no user and trying to access protected route, redirect to login
  // API routes should return 401, not redirect (handled by the route itself)
  if (!user && !isPublicRoute && !isApiRoute) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  // If user exists, check role-based routing
  if (user) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    const isCoach = profile?.role === 'coach'
    const isCoachRoute = pathname.startsWith('/coach') || pathname.startsWith('/api/coach')
    const isClientRoute = !isCoachRoute && !isPublicRoute && !isApiRoute

    // Coach trying to access client routes - redirect to coach dashboard
    if (isCoach && isClientRoute && pathname !== '/') {
      const url = request.nextUrl.clone()
      url.pathname = '/coach'
      return NextResponse.redirect(url)
    }

    // Client trying to access coach routes - redirect to client dashboard
    if (!isCoach && isCoachRoute) {
      const url = request.nextUrl.clone()
      url.pathname = '/dashboard'
      return NextResponse.redirect(url)
    }

    // Logged in user on login page - redirect to appropriate dashboard
    if (isPublicRoute && pathname === '/login') {
      const url = request.nextUrl.clone()
      url.pathname = isCoach ? '/coach' : '/dashboard'
      return NextResponse.redirect(url)
    }

    // Root path - redirect based on role
    if (pathname === '/') {
      const url = request.nextUrl.clone()
      url.pathname = isCoach ? '/coach' : '/dashboard'
      return NextResponse.redirect(url)
    }
  }

  return supabaseResponse
}
