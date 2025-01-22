export type SortField =
  | "created_at"
  | "last_login_at"
  | "credits"
  | "email"
  | "full_name";
export type SortOrder = "asc" | "desc";

export interface UsersResponse {
  users: User[];
  total: number;
  page: number;
  per_page: number;
  providers: string[];
}

export interface User {
  id: string;
  user_id: string;
  email: string;
  full_name: string;
  avatar_url?: string;
  provider: string;
  meta: {
    user_metadata: {
      avatar_url: string;
      name: string;
      email: string;
      iss: string;
      sub: string;
      picture: string;
      full_name: string;
      provider_id: string;
      custom_claims: {
        hd: string;
      };
      email_verified: boolean;
      phone_verified: boolean;
    };
    app_metadata: {
      provider: string;
      providers: string[];
    };
  };
  custom_claim?: {
    roles: string[];
  };
  credits: number;
  last_login_at: string;
  created_at: string;
  updated_at: string;
}
