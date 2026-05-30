import { useEffect } from "react";
import { useSession } from "src/hooks/useSession";
import { userRolesState } from "src/state/userRolesState";
import api from "src/lib/axios";

export const usePermissions = () => {
  const { data: session, user, isLoading } = useSession();

  useEffect(() => {
    if (!user) {
      userRolesState.setState(() => []);
      return;
    }

    // Fetch roles from backend /me endpoint
    api
      .get("/me")
      .then((res) => {
        const roles = res.data.roles || [];
        userRolesState.setState(() => roles);
      })
      .catch(() => {
        userRolesState.setState(() => []);
      });
  }, [user]);

  return { isLoading, session };
};
