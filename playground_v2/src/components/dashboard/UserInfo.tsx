import { User } from "@supabase/supabase-js";
import cn from "clsx";
import jetBrainsMono from "src/app/fonts/jetBrainsMono";
import { useLogout } from "src/hooks/useLogout";

interface UserInfoProps {
  user?: User;
}

const UserInfo = ({ user }: UserInfoProps) => {
  const logoutMutation = useLogout();

  const handleLogout = async () => {
    logoutMutation.mutate();
  };

  return (
    <div className="flex flex-wrap items-center justify-between mb-8">
      <div className="flex items-center gap-2">
        <span className="text-md">&gt;</span>
        <p
          className={cn(
            "font-medium text-md leading-[22px] tracking-[-0.013em] opacity-60"
          )}
        >
          {user?.user_metadata?.full_name}
        </p>

        <p className="text-md leading-[22px] tracking-[-0.013em] list-item opacity-40 ml-4">
          {user?.user_metadata?.email}
        </p>
      </div>
      <div className="flex-grow border-t border-dashed border-[#9CB9AE] mx-4 flex-1 h-[2px]" />
      <button
        className={cn(
          jetBrainsMono.className,
          "text-md font-medium leading-[22px] tracking-[-0.013em] text-left underline decoration-solid underline-from-font decoration-skip-ink-auto opacity-60"
        )}
        onClick={handleLogout}
      >
        Logout
      </button>
    </div>
  );
};

export default UserInfo;
