import React from "react";
import { Turnstile } from "@marsidev/react-turnstile";
import { useCaptcha } from "src/contexts/CaptchaContext";

export const CaptchaModal: React.FC = () => {
  const { showCaptcha, verify } = useCaptcha();

  if (!process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY) {
    throw new Error("NEXT_PUBLIC_TURNSTILE_SITE_KEY is not set");
  }

  if (!showCaptcha) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="w-full max-w-md p-8 bg-white rounded-lg shadow-xl">
        <h2 className="mb-4 text-2xl font-bold text-center">Verify You&apos;re Human</h2>
        <p className="mb-6 text-center text-gray-600">
          Please complete the verification to continue using Mira.
        </p>

        <div className="flex justify-center">
          <Turnstile
            siteKey={process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY}
            onSuccess={(token) => {
              verify(token);
            }}
            onError={() => {
              console.error("Captcha verification failed");
            }}
          />
        </div>
      </div>
    </div>
  );
};
