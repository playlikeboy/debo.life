"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { z } from "zod";
import { authClient } from "@/lib/auth/client";

const SignUp = z.object({
  name: z.string().trim().min(1, "Tell us what to call you."),
  email: z.string().trim().email("That email doesn't look right. Check it and try again."),
  password: z.string().min(8, "Use at least 8 characters for your password."),
});

const SignIn = SignUp.pick({ email: true, password: true });

type Mode = "sign-up" | "sign-in";

export function AuthForm({ mode }: { mode: Mode }) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    const form = Object.fromEntries(new FormData(event.currentTarget));
    const parsed = (mode === "sign-up" ? SignUp : SignIn).safeParse(form);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Check the form and try again.");
      return;
    }

    setPending(true);
    try {
      const result =
        mode === "sign-up"
          ? await authClient.signUp.email(parsed.data as z.infer<typeof SignUp>)
          : await authClient.signIn.email(parsed.data);
      if (result.error) {
        setError(
          mode === "sign-in"
            ? "That email and password don't match. Try again."
            : (result.error.message ?? "I couldn't create your account. Try again in a moment."),
        );
        return;
      }
      router.push("/home");
      router.refresh();
    } catch {
      setError("I couldn't reach the sign-in service. Check your connection and try again.");
    } finally {
      setPending(false);
    }
  }

  const input = "mt-2 block min-h-12 w-full rounded-[12px] border-2 border-ink bg-paper px-3 py-2";

  return (
    // method="post": if JavaScript has not loaded yet, the browser must never
    // put the email and password into the address bar as a GET request would.
    <form onSubmit={onSubmit} method="post" noValidate className="mt-8 grid gap-5">
      {mode === "sign-up" && (
        <div>
          <label htmlFor="name" className="font-semibold">
            Your name
          </label>
          <input id="name" name="name" autoComplete="name" required className={input} />
        </div>
      )}
      <div>
        <label htmlFor="email" className="font-semibold">
          Email
        </label>
        <input id="email" name="email" type="email" autoComplete="email" required className={input} />
      </div>
      <div>
        <label htmlFor="password" className="font-semibold">
          Password
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete={mode === "sign-up" ? "new-password" : "current-password"}
          required
          minLength={8}
          aria-describedby={mode === "sign-up" ? "password-hint" : undefined}
          className={input}
        />
        {mode === "sign-up" && (
          <p id="password-hint" className="mt-2 text-ink-soft">
            At least 8 characters.
          </p>
        )}
      </div>

      <p role="alert" aria-live="assertive" className="min-h-6 font-semibold">
        {error}
      </p>

      <button type="submit" disabled={pending} className="btn btn-primary justify-self-start">
        {pending ? "One moment…" : mode === "sign-up" ? "Create my account" : "Sign in"}
      </button>
    </form>
  );
}
