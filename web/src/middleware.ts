import { NextResponse, type NextRequest } from 'next/server';
import { defaultLocale } from '@/lib/i18n';

// Redirige la racine "/" vers la langue par defaut (/fr).
export function middleware(req: NextRequest) {
  if (req.nextUrl.pathname === '/') {
    return NextResponse.redirect(new URL(`/${defaultLocale}`, req.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ['/'],
};
