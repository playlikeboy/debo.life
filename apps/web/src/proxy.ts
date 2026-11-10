import type { NextRequest } from "next/server";
import { getAuth } from "@/lib/auth/server";

// Signed-in pages. The public site (landing page, robots.txt, share image)
// stays outside this matcher. Pages still check the session themselves.
export default function proxy(request: NextRequest) {
  return getAuth().middleware({ loginUrl: "/auth/sign-in" })(request);
}

export const config = {
  matcher: ["/home/:path*"],
};
