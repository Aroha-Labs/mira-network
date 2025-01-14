import { useStore } from "@tanstack/react-store";
import Link from "next/link";
import Card from "src/components/card";
import { useLogout } from "src/hooks/useLogout";
import { usePermissions } from "src/hooks/usePermissions";
import Loading from "src/pageLoading/dashboard";
import { userRolesState } from "src/state/userRolesState";

interface LayoutChildrenProps {
  children: React.ReactNode;
}

const LayoutChildren = ({ children }: LayoutChildrenProps) => {
  const { isLoading, session } = usePermissions();
  const userRoles = useStore(userRolesState, (state) => state);
  const logoutMutation = useLogout();

  const hasPermission = userRoles.includes("user");

  if (isLoading) {
    return <Loading />;
  }

  if (session && !hasPermission) {
    return (
      <div className="flex items-center justify-center flex-1 w-[400px]">
        <Card>
          <div className="pl-[20px] pr-[20px] pt-[14px] pb-[32px]">
            <div>
              Welcome to the Voyager Testnet. To get access and free credits,
              please join our Discord server and send us a message there.
            </div>
            <div className="mt-8">
              <Link
                href="https://discord.com/invite/mira-network"
                target="_blank"
                className="px-4 py-2 text-white bg-black"
                onClick={() => logoutMutation.mutate()}
              >
                Join Discord
              </Link>
            </div>
          </div>
        </Card>
      </div>
    );
  }

  return children;
};

export default LayoutChildren;
