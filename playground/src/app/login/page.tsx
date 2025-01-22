"use client";

import React from "react";
import { supabase } from "src/utils/supabase/client";

export default function Login() {
  const handleLogin = async (e: React.MouseEvent<HTMLButtonElement, MouseEvent>) => {
    e.preventDefault();
    supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: window.location.origin,
      },
    });
  };

  return (
    <div className="flex flex-1 flex-col items-center justify-center bg-gray-100">
      <img src="/img/logo.svg" alt="Mira" className="mb-4" />
      <h1 className="text-2xl font-bold">Login to Mira</h1>
      <button
        className="flex items-center bg-black text-white py-2 px-12 rounded-full shadow my-8 hover:bg-gray-800 active:bg-gray-900"
        onClick={handleLogin}
      >
        <img src="/img/google-icon.svg" alt="Google" className="w-5 h-5 mr-2" />
        Login with Google
      </button>
      <p className="text-sm">
        By logging in, you accept our
        <a href="/terms" className="text-blue-500 underline">
          Terms and Conditions
        </a>
        .
      </p>
    </div>
  );
}
