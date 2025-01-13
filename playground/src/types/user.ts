export interface User {
  id: string;
  email: string;
  avatar_url: string;
  user_id: string;
  meta: {
    app_metadata: {
      provider: string;
      providers: string[];
    };
    user_metadata: {
      iss: string;
      sub: string;
      name: string;
      email: string;
      picture: string;
      full_name: string;
      avatar_url: string;
      provider_id: string;
      custom_claims: {
        hd: string;
      };
      email_verified: boolean;
      phone_verified: boolean;
    };
  };
  last_login_at: string;
  updated_at: string;
  full_name: string;
  provider: string;
  custom_claim: {
    roles: string[];
  } | null;
  created_at: string;
}
