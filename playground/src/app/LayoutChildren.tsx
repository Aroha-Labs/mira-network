import { useStore } from "@tanstack/react-store";
import Loading from "src/components/PageLoading";
import { useLogout } from "src/hooks/useLogout";
import { usePermissions } from "src/hooks/usePermissions";
import { userRolesState } from "src/state/userRolesState";
import { usePathname } from "next/navigation";
import { redirectToLogin } from "src/utils/auth";
import { isPublicRoute } from "src/config/routes";
import { useCaptchaProtection } from "src/components/withCaptchaProtection";

interface LayoutChildrenProps {
  children: React.ReactNode;
}

const LayoutChildren = ({ children }: LayoutChildrenProps) => {
  const pathname = usePathname();
  const { isLoading, session } = usePermissions();
  const userRoles = useStore(userRolesState, (state) => state);
  const logoutMutation = useLogout();
  const { isVerified } = useCaptchaProtection();

  const hasPermission = userRoles.includes("user");

  if (!isLoading && !session && !isPublicRoute(pathname)) {
    redirectToLogin(pathname);
    return <Loading fullPage />;
  }

  if (isLoading) {
    return <Loading fullPage />;
  }

  if (session && !hasPermission) {
    return (
      <div className="flex items-center justify-center flex-1 bg-gray-100">
        <div
          className="relative px-4 py-3 text-red-700 bg-red-100 border border-red-400 rounded-sm"
          role="alert"
        >
          <strong className="font-bold">Error: </strong>
          <div>You don&apos;t have permission to access this page</div>
          <button
            onClick={() => logoutMutation.mutate()}
            className={`mt-4 px-4 py-2 rounded text-white ${
              logoutMutation.isPending ? "bg-gray-500" : "bg-red-500"
            }`}
            disabled={logoutMutation.isPending}
          >
            {logoutMutation.isPending ? "Logging out..." : "Logout"}
          </button>
          {logoutMutation.isError && (
            <div className="mt-2 text-red-700">Error: {logoutMutation.error.message}</div>
          )}
        </div>
      </div>
    );
  }

  // Block access to non-public routes if not verified
  if (session && !isPublicRoute(pathname) && !isVerified) {
    return <Loading fullPage text="Verification required..." />;
  }

  return children;
};

export default LayoutChildren;
