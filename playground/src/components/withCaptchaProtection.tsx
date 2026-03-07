import React from "react";

// CAPTCHA is disabled - always return verified
export const useCaptchaProtection = () => {
  return { isVerified: true, showCaptcha: false };
};

// CAPTCHA is disabled - just render the component directly
export const withCaptchaProtection = <P extends object>(
  Component: React.ComponentType<P>
) => {
  return function ProtectedComponent(props: P) {
    return <Component {...props} />;
  };
};
