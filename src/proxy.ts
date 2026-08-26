import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, authBypassed, authSecret, verifySession } from "@/lib/session";

export async function proxy(request: NextRequest) {
  const isLogin = request.nextUrl.pathname === "/login";
  const bypass = authBypassed();
  const session = bypass || (await verifySession(request.cookies.get(SESSION_COOKIE)?.value, authSecret()));
  if (!session && !isLogin) return NextResponse.redirect(new URL("/login", request.nextUrl));
  if (session && !bypass && isLogin) return NextResponse.redirect(new URL("/", request.nextUrl));
  return NextResponse.next();
}

// API route’lar o‘z himoyasiga ega (sessiya, CRON_SECRET yoki Telegram sirlari).
export const config = { matcher: ["/((?!api|_next/static|_next/image|favicon.ico|.*\\.svg$).*)"] };
