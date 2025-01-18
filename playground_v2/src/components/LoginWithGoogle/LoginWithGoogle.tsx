import { useCallback } from "react";
import { supabase } from "src/utils/supabase/client";
import { Button } from "../button";

const LoginWithGoogle = () => {
  const handleLogin = useCallback(
    async (e: React.MouseEvent<HTMLButtonElement, MouseEvent>) => {
      e.preventDefault();
      await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: window.location.origin,
        },
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
