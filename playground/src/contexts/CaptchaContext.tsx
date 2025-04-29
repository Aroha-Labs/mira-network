import React, { createContext, useContext, useState, useEffect } from "react";
import { useSession } from "src/hooks/useSession";
import api from "src/lib/axios";

interface CaptchaContextType {
  isVerified: boolean;
  showCaptcha: boolean;
  verify: (token: string) => Promise<void>;
  checkStatus: () => Promise<void>;
}

interface VerificationRecord {
  timestamp: number;
  verified: boolean;
  token: string;
}

const STORAGE_KEY = "mira_captcha_verification";

const CaptchaContext = createContext<CaptchaContextType>({
  isVerified: false,
  showCaptcha: false,
  verify: async () => {},
  checkStatus: async () => {},
});

export const useCaptcha = () => useContext(CaptchaContext);

export const CaptchaProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [isVerified, setIsVerified] = useState(false);
  const [showCaptcha, setShowCaptcha] = useState(false);
  const { data: session } = useSession();

  const saveVerification = (verified: boolean, token: string) => {
    const record: VerificationRecord = {
      timestamp: Date.now(),
      verified,
      token,
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(record));
  };

  const verify = async (token: string) => {
    if (!session?.user?.id) return;

    try {
      const response = await api.post("/captcha/verify", {
        token,
        user_id: session.user.id,
      });

      if (response.status !== 200) {
        throw new Error("Verification failed");
      }

      const data = response.data;
      if (data.success) {
        setIsVerified(true);
        setShowCaptcha(false);
        // Save to localStorage with the token for verification
        saveVerification(true, token);
      } else {
        setIsVerified(false);
        setShowCaptcha(true);
        localStorage.removeItem(STORAGE_KEY);
      }
    } catch (error) {
      console.error("Captcha verification failed:", error);
      setIsVerified(false);
      setShowCaptcha(true);
      localStorage.removeItem(STORAGE_KEY);
    }
  };

  const checkStatus = async () => {
    if (!session?.user?.id) return;

    try {
      // Always check with Redis first
      const response = await api.get(`/captcha/status/${session.user.id}`);
      const data = response.data;

      if (data.success) {
        setIsVerified(true);
        setShowCaptcha(false);
        // Update localStorage with the current verification
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) {
          const record: VerificationRecord = JSON.parse(stored);
          saveVerification(true, record.token);
        }
      } else {
        // If Redis says not verified, we don't trust localStorage
        setIsVerified(false);
        setShowCaptcha(true);
        localStorage.removeItem(STORAGE_KEY);
      }
    } catch (error) {
      console.error("Status check failed:", error);
      // On error, we default to requiring verification
      setIsVerified(false);
      setShowCaptcha(true);
      localStorage.removeItem(STORAGE_KEY);
    }
  };

  useEffect(() => {
    if (session?.user?.id) {
      // Check for pending token from login
      const pendingToken = localStorage.getItem("pendingCaptchaToken");
      if (pendingToken) {
        verify(pendingToken).finally(() => {
          localStorage.removeItem("pendingCaptchaToken");
        });
      } else {
        checkStatus();
      }
    } else {
      // Clear verification when user logs out
      localStorage.removeItem(STORAGE_KEY);
      setIsVerified(false);
      setShowCaptcha(false);
    }
  }, [session?.user?.id]);

  return (
    <CaptchaContext.Provider value={{ isVerified, showCaptcha, verify, checkStatus }}>
      {children}
    </CaptchaContext.Provider>
  );
};
