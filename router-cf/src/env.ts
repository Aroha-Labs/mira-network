import type { WorkerEnv } from "./env.d";

export interface AuthUser {
  id: string;
  email: string;
  roles: string[];
}

export interface AppContext {
  Bindings: WorkerEnv;
  Variables: {
    user: AuthUser | null;
  };
}

export type Env = WorkerEnv;
