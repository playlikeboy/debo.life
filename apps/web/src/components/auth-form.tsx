"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { z } from "zod";
import { authClient } from "@/lib/auth/client";

// Sign up and sign in. Three ways in: password, a code by email, or a link by
// email. New accounts confirm their email with a 6-digit code. Codes and
// links are sent from mail.debo.life (see api/neon-auth/webhook).

const Email = z.string().trim().email("That email doesn't look right. Check it and try again.");
const SignUp = z.object({
  name: z.string().trim().min(1, "Tell us what to call you."),
  email: Email,
  password: z.string().min(8, "Use at least 8 characters for your password."),
});
const SignIn = z.object({ email: Email, password: z.string().min(1, "Type your password.") });
const Code = z.string().trim().regex(/^\d{6}$/, "The code is the 6 numbers in the email.");

type Mode = "sign-up" | "sign-in";
type Method = "password" | "code" | "link";
type Step =
  | { kind: "form" }
  | { kind: "code"; email: string; purpose: "email-verification" | "sign-in" }
  | { kind: "link-sent"; email: string };

const input = "mt-2 block min-h-12 w-full rounded-[12px] border-2 border-ink bg-paper px-3 py-2";
const OFFLINE = "I couldn't reach the sign-in service. Check your connection and try again.";

/** Plain words for the errors people can act on. */
function explain(error: { status?: number; code?: string; message?: string } | null | undefined, fallback: string) {
  if (!error) return fallback;
  if (error.status === 429) return "Too many tries. Wait a minute, then try again.";
  if (error.code?.includes("OTP") || error.code?.includes("CODE")) return "That code is wrong or has run out. Check it, or ask for a new one.";
  if (error.code === "USER_ALREADY_EXISTS") return "There is already an account with that email. Sign in instead.";
  return fallback;
}

export function AuthForm({ mode }: { mode: Mode }) {
  const router = useRouter();
  const [step, setStep] = useState<Step>({ kind: "form" });
  const [method, setMethod] = useState<Method>("password");
  const [error, setError] = useState("");
  const [note, setNote] = useState("");
  const [pending, setPending] = useState(false);
  const stepHeading = useRef<HTMLHeadingElement>(null);

  // Move focus to the new step so keyboard and screen-reader users land on it.
  useEffect(() => {
    if (step.kind !== "form") stepHeading.current?.focus();
  }, [step]);

  async function run(work: () => Promise<void>) {
    setError("");
    setNote("");
    setPending(true);
    try {
      await work();
    } catch {
      setError(OFFLINE);
    } finally {
      setPending(false);
    }
  }

  const goHome = () => {
    router.push("/home");
    router.refresh();
  };

  async function signedIn() {
    const { data } = await authClient.getSession();
    return Boolean(data?.user);
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = Object.fromEntries(new FormData(event.currentTarget));
    if (mode === "sign-up") {
      const parsed = SignUp.safeParse(form);
      if (!parsed.success) return setError(parsed.error.issues[0]?.message ?? "Check the form and try again.");
      return run(async () => {
        const result = await authClient.signUp.email(parsed.data);
        if (result.error) return setError(explain(result.error, result.error.message ?? "I couldn't create your account. Try again in a moment."));
        if (await signedIn()) return goHome();
        setStep({ kind: "code", email: parsed.data.email, purpose: "email-verification" });
      });
    }

    if (method === "password") {
      const parsed = SignIn.safeParse(form);
      if (!parsed.success) return setError(parsed.error.issues[0]?.message ?? "Check the form and try again.");
      return run(async () => {
        const result = await authClient.signIn.email(parsed.data);
        if (result.error?.status === 403 || result.error?.code === "EMAIL_NOT_VERIFIED") {
          // Neon Auth has just emailed a code to confirm the address.
          return setStep({ kind: "code", email: parsed.data.email, purpose: "email-verification" });
        }
        if (result.error) return setError(explain(result.error, "That email and password don't match. Try again."));
        goHome();
      });
    }

    const email = Email.safeParse(form.email);
    if (!email.success) return setError(email.error.issues[0]?.message ?? "Check your email and try again.");
    return run(async () => {
      if (method === "code") {
        const result = await authClient.emailOtp.sendVerificationOtp({ email: email.data, type: "sign-in" });
        if (result.error) return setError(explain(result.error, "I couldn't send a code. Try again in a moment."));
        setStep({ kind: "code", email: email.data, purpose: "sign-in" });
      } else {
        const result = await authClient.signIn.magicLink({ email: email.data, callbackURL: "/home" });
        if (result.error) return setError(explain(result.error, "I couldn't send a link. Try again in a moment."));
        setStep({ kind: "link-sent", email: email.data });
      }
    });
  }

  function onCode(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (step.kind !== "code") return;
    const code = Code.safeParse(new FormData(event.currentTarget).get("code"));
    if (!code.success) return setError(code.error.issues[0]?.message ?? "Check the code and try again.");
    run(async () => {
      const result =
        step.purpose === "sign-in"
          ? await authClient.signIn.emailOtp({ email: step.email, otp: code.data })
          : await authClient.emailOtp.verifyEmail({ email: step.email, otp: code.data });
      if (result.error) return setError(explain(result.error, "That code is wrong or has run out. Check it, or ask for a new one."));
      if (await signedIn()) return goHome();
      // Confirmed, but not signed in yet: send them to sign in with their password.
      router.push("/auth/sign-in?confirmed=1");
    });
  }

  function resend() {
    if (step.kind === "form") return;
    run(async () => {
      const result =
        step.kind === "link-sent"
          ? await authClient.signIn.magicLink({ email: step.email, callbackURL: "/home" })
          : await authClient.emailOtp.sendVerificationOtp({ email: step.email, type: step.purpose });
      if (result.error) return setError(explain(result.error, "I couldn't send it again. Try again in a moment."));
      setNote(step.kind === "link-sent" ? "A new link is on its way." : "A new code is on its way.");
    });
  }

  const startOver = () => {
    setStep({ kind: "form" });
    setError("");
    setNote("");
  };

  const messages = (
    <>
      <p role="alert" aria-live="assertive" className="min-h-6 font-semibold">
        {error}
      </p>
      <p role="status" aria-live="polite" className="font-semibold empty:hidden">
        {note}
      </p>
    </>
  );

  if (step.kind === "code") {
    return (
      <form onSubmit={onCode} method="post" noValidate className="mt-8 grid gap-5">
        <h2 ref={stepHeading} tabIndex={-1} className="text-[1.375rem]">
          {step.purpose === "sign-in" ? "Check your email for a code" : "Confirm your email"}
        </h2>
        <p className="text-ink-soft">
          We sent a 6-number code to <span className="font-semibold text-ink">{step.email}</span>. It works for a few
          minutes.
        </p>
        <div>
          <label htmlFor="code" className="font-semibold">
            Code from your email
          </label>
          <input
            id="code"
            name="code"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            required
            className={`${input} max-w-[12rem] tracking-[0.3em]`}
          />
        </div>
        {messages}
        <div className="flex flex-wrap gap-3">
          <button type="submit" disabled={pending} className="btn btn-primary">
            {pending ? "One moment…" : step.purpose === "sign-in" ? "Sign in" : "Confirm my email"}
          </button>
          <button type="button" onClick={resend} disabled={pending} className="btn btn-quiet">
            Send a new code
          </button>
          <button type="button" onClick={startOver} disabled={pending} className="btn btn-quiet">
            Use a different email
          </button>
        </div>
      </form>
    );
  }

  if (step.kind === "link-sent") {
    return (
      <div className="mt-8 grid gap-5">
        <h2 ref={stepHeading} tabIndex={-1} className="text-[1.375rem]">
          Check your email
        </h2>
        <p className="text-ink-soft">
          We sent a sign-in link to <span className="font-semibold text-ink">{step.email}</span>. Open it on this device.
          It works once, for a few minutes.
        </p>
        {messages}
        <div className="flex flex-wrap gap-3">
          <button type="button" onClick={resend} disabled={pending} className="btn btn-quiet">
            Send another link
          </button>
          <button type="button" onClick={startOver} disabled={pending} className="btn btn-quiet">
            Sign in another way
          </button>
        </div>
      </div>
    );
  }

  const showPassword = mode === "sign-up" || method === "password";

  return (
    // method="post": if JavaScript has not loaded yet, the browser must never
    // put the email and password into the address bar as a GET request would.
    <form onSubmit={onSubmit} method="post" noValidate className="mt-8 grid gap-5">
      {mode === "sign-in" && (
        <fieldset>
          <legend className="font-semibold">How do you want to sign in?</legend>
          <div className="mt-2 flex flex-wrap gap-2">
            {(
              [
                ["password", "With my password"],
                ["code", "Email me a code"],
                ["link", "Email me a link"],
              ] as const
            ).map(([value, label]) => (
              <label
                key={value}
                className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-[12px] border-2 border-ink bg-paper px-3 has-[:checked]:bg-mint"
              >
                <input
                  type="radio"
                  name="method"
                  value={value}
                  checked={method === value}
                  onChange={() => {
                    setMethod(value);
                    setError("");
                  }}
                />
                {label}
              </label>
            ))}
          </div>
        </fieldset>
      )}
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
      {showPassword && (
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
            minLength={mode === "sign-up" ? 8 : undefined}
            aria-describedby={mode === "sign-up" ? "password-hint" : undefined}
            className={input}
          />
          {mode === "sign-up" && (
            <p id="password-hint" className="mt-2 text-ink-soft">
              At least 8 characters. We will email you a code to confirm your address.
            </p>
          )}
        </div>
      )}

      {messages}

      <button type="submit" disabled={pending} className="btn btn-primary justify-self-start">
        {pending
          ? "One moment…"
          : mode === "sign-up"
            ? "Create my account"
            : method === "password"
              ? "Sign in"
              : method === "code"
                ? "Email me a code"
                : "Email me a link"}
      </button>
    </form>
  );
}
