"use client";

import { useSearchParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useSession } from "src/hooks/useSession";
import React from "react";
import { supabase } from "src/utils/supabase/client";
import Loading from "src/components/PageLoading";
import { trackEvent } from "src/lib/mira";
import { Turnstile } from "@marsidev/react-turnstile";

export default function Login() {
  const router = useRouter();
  const { data: session, isLoading } = useSession();
  const searchParams = useSearchParams();
  const redirect = searchParams.get("redirect") || "/";

  if (!process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY) {
    throw new Error("NEXT_PUBLIC_TURNSTILE_SITE_KEY environment variable is required");
  }

  // Properly typed state
  const [captchaToken, setCaptchaToken] = useState<string | undefined>(undefined);
  const [isAuthenticating, setIsAuthenticating] = useState(false);

  useEffect(() => {
    if (!isLoading && session) {
      router.replace(redirect);
    }
  }, [session, isLoading, redirect, router]);

  if (isLoading || session) {
    return (
      <div className="flex flex-1">
        <Loading
          fullPage
          text={
            isLoading
              ? "Loading..."
              : `Redirecting to ${redirect === "/" ? "home" : redirect}...`
          }
        />
      </div>
    );
  }

  const handleLogin = async (e: React.MouseEvent<HTMLButtonElement, MouseEvent>) => {
    e.preventDefault();
    trackEvent('login_click', {
      provider: 'google',
      redirect_path: redirect
    });

    if (!captchaToken) {
      // Show error to user that CAPTCHA is required
      return;
    }

    try {
      setIsAuthenticating(true);

      // Store captcha token temporarily in localStorage
      localStorage.setItem("pendingCaptchaToken", captchaToken);

      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${window.location.origin}${redirect}`,
        },
      });

      if (error) throw error;
    } catch (error) {
      console.error("Error signing in with Google:", error);
      localStorage.removeItem("pendingCaptchaToken");
      // Show error to user
    } finally {
      setIsAuthenticating(false);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center flex-1 bg-gray-100">
      <img src="/img/logo.svg" alt="Mira" className="mb-4" />
      <h1 className="text-2xl font-bold">Login to Mira</h1>
      <button
        className="flex items-center px-12 py-2 my-8 text-white bg-black rounded-full shadow-sm hover:bg-gray-800 active:bg-gray-900 disabled:opacity-50"
        onClick={handleLogin}
        disabled={!captchaToken || isAuthenticating}
      >
        <img src="/img/google-icon.svg" alt="Google" className="w-5 h-5 mr-2" />
        {isAuthenticating ? "Authenticating..." : "Login with Google"}
      </button>

      <Turnstile
        siteKey={process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY}
        onSuccess={(token) => {
          setCaptchaToken(token);
        }}
        onError={() => {
          console.log("error");
          setCaptchaToken(undefined);
        }}
      />

      <p className="mt-4 text-sm">
        By logging in, you accept our{" "}
        <a href="/terms" className="text-blue-500 underline">
          Terms and Conditions
        </a>
        .
      </p>
    </div>
  );
}
