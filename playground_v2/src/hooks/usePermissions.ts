import { useEffect, useState } from "react";
import { supabase } from "src/utils/supabase/client";
import { jwtDecode } from "jwt-decode";
import { Session } from "@supabase/supabase-js";
import { userRolesState } from "src/state/userRolesState";

export const usePermissions = () => {
  const [isLoading, setIsLoading] = useState(true);
  const [session, setSession] = useState<Session | null>(null);

  useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange(async (event, session) => {
      try {
        setSession(session);
        if (session) {
          const data = jwtDecode<{ user_roles?: ("admin" | "user")[] }>(
            session.access_token
          );
          const user_roles = data.user_roles || [];
          userRolesState.setState(() => user_roles);
        } else {
          userRolesState.setState(() => []);
        }
      } catch (error) {
        console.error("Error decoding JWT:", error);
      } finally {
        setIsLoading(false);
      }
    });

    return () => {
      data.subscription.unsubscribe();
    };
  }, []);

  return { isLoading, session };
};
