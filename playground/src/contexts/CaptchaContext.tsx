import React, { createContext, useContext } from "react";

interface CaptchaContextType {
  isVerified: boolean;
  showCaptcha: boolean;
}

const CaptchaContext = createContext<CaptchaContextType>({
  isVerified: true,
  showCaptcha: false,
});

export const useCaptcha = () => useContext(CaptchaContext);

// CAPTCHA is disabled - all users are considered verified
export const CaptchaProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  return (
    <CaptchaContext.Provider value={{ isVerified: true, showCaptcha: false }}>
      {children}
    </CaptchaContext.Provider>
  );
};
