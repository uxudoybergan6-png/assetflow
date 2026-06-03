import "next-auth";

declare module "next-auth" {
  interface Session {
    apiToken?: string;
    user: {
      id?: string;
      role?: string;
      email?: string | null;
      name?: string | null;
      image?: string | null;
    };
  }

  interface User {
    apiToken?: string;
    role?: string;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    apiToken?: string;
    role?: string;
    id?: string;
  }
}
