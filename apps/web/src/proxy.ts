import { type NextRequest, NextResponse } from "next/server";

// debo.life no longer shows the old app. The landing page lives at about.debo.life
// and the app at my.debo.life, so the old addresses send people there.
// Everything else stays as it was and is NOT in the matcher below: /privacy,
// every /api/* route (sign-in email webhook, voice, export, delete account),
// robots.txt, sitemap.xml, the share image and icons.
//
// These are temporary (307) redirects on purpose, so they are easy to change
// later, for example when the landing page is served from debo.life itself.

const LANDING = "https://about.debo.life";
const APP = "https://my.debo.life";

// Old signed-in screens and the screen they became in the new app.
const OLD_SCREENS: Record<string, string> = {
  "/home": "/chat",
  "/home/chat": "/chat",
  "/home/journal": "/journal",
  "/home/memories": "/knows",
  "/home/activity": "/tasks",
  "/home/voice": "/talk",
};

export default function proxy(request: NextRequest) {
  const path = request.nextUrl.pathname.replace(/\/+$/, "") || "/";
  if (path === "/") return NextResponse.redirect(LANDING, 307);
  // Sign-in and sign-up live in the new app, which has its own sign-in.
  if (path === "/auth" || path.startsWith("/auth/")) return NextResponse.redirect(APP, 307);
  return NextResponse.redirect(`${APP}${OLD_SCREENS[path] ?? "/"}`, 307);
}

export const config = {
  matcher: ["/", "/home/:path*", "/auth/:path*"],
};
