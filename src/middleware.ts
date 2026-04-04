import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";

export default auth((req) => {
  const isAuthenticated = !!req.auth;
  const isAuthPage = req.nextUrl.pathname === "/login" || req.nextUrl.pathname === "/register";
  const isProtectedRoute = req.nextUrl.pathname.startsWith("/chat");
  const isApiRoute = req.nextUrl.pathname.startsWith("/api");

  // Don't protect API routes (they handle their own auth) or the landing page
  if (isApiRoute || req.nextUrl.pathname === "/") {
    return NextResponse.next();
  }

  // Redirect authenticated users away from auth pages
  if (isAuthPage && isAuthenticated) {
    return NextResponse.redirect(new URL("/chat", req.url));
  }

  // Redirect unauthenticated users to login for protected routes
  if (isProtectedRoute && !isAuthenticated) {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  return NextResponse.next();
});

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\..*).*)"],
};
