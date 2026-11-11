import type { Metadata } from "next";
import { AuthForm } from "@/components/auth-form";

export const metadata: Metadata = { title: "Sign in to Debo", robots: { index: false } };

export default function SignInPage() {
  return (
    <main className="wrap max-w-[34rem] py-16">
      <a href="/" className="inline-flex min-h-11 items-center font-semibold underline underline-offset-4">
        Back to Debo
      </a>
      <h1 className="h-section mt-8">Sign in</h1>
      <AuthForm mode="sign-in" />
      <p className="mt-8">
        New here?{" "}
        <a href="/auth/sign-up" className="font-semibold underline underline-offset-4">
          Create an account
        </a>
      </p>
    </main>
  );
}
