import { createAuthClient } from "better-auth/react";

export const authClient = createAuthClient({
    baseURL: (import.meta.env.VITE_API_URL || "http://localhost:3000/api") + "/auth",
});

export const { useSession, signIn, signUp, signOut } = authClient;
