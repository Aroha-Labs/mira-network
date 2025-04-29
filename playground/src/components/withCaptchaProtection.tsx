import React from "react";
import { useCaptcha } from "src/contexts/CaptchaContext";
import Loading from "src/components/PageLoading";

// Hook for protecting content
export const useCaptchaProtection = () => {
  const { isVerified, showCaptcha, verify, checkStatus } = useCaptcha();
  return { isVerified, showCaptcha };
};

export const withCaptchaProtection = <P extends object>(
  Component: React.ComponentType<P>
) => {
  return function ProtectedComponent(props: P) {
    const { isVerified } = useCaptcha();

    if (!isVerified) {
      return <Loading fullPage text="Waiting for verification..." />;
    }

    return <Component {...props} />;
  };
};
