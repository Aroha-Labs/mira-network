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
    <div className="flex flex-wrap items-center justify-between mb-[16px] gap-4 md:gap-0">
      <div className="flex items-center gap-[12px]">
        <span className="text-xs md:text-md">&gt;</span>
        <p
          className={cn(
            "text-black text-[13px] font-normal leading-[22px] tracking-[-0.156px]"
          )}
        >
          {user?.user_metadata?.full_name}
        </p>

        <p className="text-black text-[13px] font-medium leading-[22px] tracking-[-0.156px] list-item opacity-40 ml-4">
          {user?.user_metadata?.email}
        </p>
      </div>
      <div className="flex-grow border-t border-dashed border-[#9CB9AE] mx-4 flex-1 h-[2px]" />
      {!loggedOutClicked && (
        <Button
          variant="link"
          className={cn(
            jetBrainsMono.className,
            "text-black text-[13px] font-normal leading-[22px] tracking-[-0.156px] underline decoration-solid decoration-skip-ink-auto p-0"
          )}
          onClick={handleLoggedOutClicked}
        >
          Logout
        </Button>
      )}
      {loggedOutClicked && (
        <div className="flex items-center justify-center">
          <p className="text-black text-[13px] font-normal leading-[22px] tracking-[-0.156px] decoration-solid decoration-skip-ink-auto">
            Confirm logout
          </p>
          <div className="border-t border-dashed border-[#9CB9AE] w-[10px] h-[2px] mx-[10px]" />

          <Button
            variant="link"
            className="text-black text-[13px] font-normal leading-[22px] tracking-[-0.156px] underline decoration-solid decoration-skip-ink-auto p-0"
            onClick={handleLogout}
          >
            Yes
          </Button>
          <div className="border-t border-dashed border-[#9CB9AE] w-[10px] h-[2px] mx-[10px]" />

          <Button
            variant="link"
            className="text-black text-[13px] font-normal leading-[22px] tracking-[-0.156px] underline decoration-solid decoration-skip-ink-auto p-0"
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
