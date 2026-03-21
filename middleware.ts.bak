import { NextResponse, type NextRequest } from 'next/server';

const SESSION_COOKIE_NAME = 'voter_session';
const PUBLIC_ROUTES = new Set(['/onboarding', '/login', '/signup']);

export function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  const isApi = pathname.startsWith('/api');
  const isStaticAsset =
    pathname.startsWith('/_next') ||
    pathname.startsWith('/icons') ||
    pathname.startsWith('/workbox-') ||
    pathname === '/sw.js' ||
    pathname === '/manifest.json' ||
    pathname === '/favicon.ico';

  if (isApi || isStaticAsset) return NextResponse.next();

  const hasSession = Boolean(request.cookies.get(SESSION_COOKIE_NAME)?.value);
  const isPublicRoute = PUBLIC_ROUTES.has(pathname);

  if (!hasSession && !isPublicRoute) {
    const url = request.nextUrl.clone();
    url.pathname = '/onboarding';
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)']
};
