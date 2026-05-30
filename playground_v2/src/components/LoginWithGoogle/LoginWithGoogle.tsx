import { useCallback } from "react";
import { signIn } from "src/lib/auth-client";
import { Button } from "../button";

const LoginWithGoogle = () => {
  const handleLogin = useCallback(
    async (e: React.MouseEvent<HTMLButtonElement, MouseEvent>) => {
      e.preventDefault();
      await signIn.social({
        provider: "google",
        callbackURL: window.location.origin,
      });
    },
    []
  );

  return (
    <Button
      onClick={handleLogin}
      className="text-[#FFF] text-[13px] font-[500] leading-[15.6px] tracking-[-0.26px] capitalize"
    >
      Login with Google
    </Button>
  );
};

export default LoginWithGoogle;
