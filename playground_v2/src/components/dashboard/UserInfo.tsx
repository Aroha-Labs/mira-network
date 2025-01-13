import { User } from "@supabase/supabase-js";
import cn from "clsx";
import { useState } from "react";
import jetBrainsMono from "src/app/fonts/jetBrainsMono";
import { useLogout } from "src/hooks/useLogout";
import { Button } from "../button";

interface UserInfoProps {
  user?: User;
}

const UserInfo = ({ user }: UserInfoProps) => {
  const logoutMutation = useLogout();
  const [loggedOutClicked, setLoggedOutClicked] = useState(false);

  const handleLogout = async () => {
    logoutMutation.mutate();
  };

  const handleLoggedOutClicked = () => {
    setLoggedOutClicked(true);
  };

  return (
    <div className="flex flex-wrap items-center justify-between mb-8 gap-4 md:gap-0">
      <div className="flex items-center gap-[12px]">
        <span className="text-xs md:text-md">&gt;</span>
        <p
          className={cn(
            "text-black font-['JetBrains_Mono'] text-[12px] font-normal leading-[22px] tracking-[-0.156px]"
          )}
        >
          {user?.user_metadata?.full_name}
        </p>

        <p className="text-black font-['JetBrains_Mono'] text-[12px] font-medium leading-[22px] tracking-[-0.156px] list-item opacity-40 ml-4">
          {user?.user_metadata?.email}
        </p>
      </div>
      <div className="flex-grow border-t border-dashed border-[#9CB9AE] mx-4 flex-1 h-[2px]" />
      {!loggedOutClicked && (
        <button
          className={cn(
            jetBrainsMono.className,
            "text-black text-[12px] font-normal leading-[22px] tracking-[-0.156px] underline decoration-solid decoration-skip-ink-auto"
          )}
          onClick={handleLoggedOutClicked}
        >
          Logout
        </button>
      )}
      {loggedOutClicked && (
        <div className="flex items-center justify-center">
          <p className="text-md font-medium leading-[22px] tracking-[-0.013em] text-left opacity-60">
            Confirm logout
          </p>
          <div className="border-t border-dashed border-[#9CB9AE] w-[10px] h-[2px] mx-[10px]" />

          <Button
            variant="link"
            className="underline m-0 p-0"
            onClick={handleLogout}
          >
            Yes
          </Button>
          <div className="border-t border-dashed border-[#9CB9AE] w-[10px] h-[2px] mx-[10px]" />

          <Button
            variant="link"
            className="underline m-0 p-0"
            onClick={() => setLoggedOutClicked(false)}
          >
            No
          </Button>
        </div>
      )}
    </div>
  );
};

export default UserInfo;
