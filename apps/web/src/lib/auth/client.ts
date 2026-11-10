"use client";

import { createAuthClient } from "@neon/auth/next";

// Talks to our own /api/auth routes, which forward to Neon Auth.
export const authClient = createAuthClient();
