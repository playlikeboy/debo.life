import type { Metadata } from "next";
import { AuthForm } from "@/components/auth-form";

export const metadata: Metadata = { title: "Create your Debo account", robots: { index: false } };

export default function SignUpPage() {
  return (
    <main className="wrap max-w-[34rem] py-16">
      <a href="/" className="inline-flex min-h-11 items-center font-semibold underline underline-offset-4">
        Back to Debo
      </a>
      <h1 className="h-section mt-8">Create your account</h1>
      <p className="mt-4 text-ink-soft">
        Debo is still being built. Your account works, but there is not much to do with it yet. You can
        delete it any time from your home page.
      </p>
      <AuthForm mode="sign-up" />
      <p className="mt-8">
        Already have an account?{" "}
        <a href="/auth/sign-in" className="font-semibold underline underline-offset-4">
          Sign in
        </a>
      </p>
    </main>
  );
}
