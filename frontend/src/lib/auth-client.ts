import { createAuthClient } from "better-auth/react";

// Use a same-origin relative path by default: nginx proxies /api -> backend.
// This works on localhost and on any server (e.g. http://10.10.10.11) with no
// host-specific config, and avoids cross-origin cookie/CORS issues.
export const authClient = createAuthClient({
    baseURL: (import.meta.env.VITE_API_URL || "/api") + "/auth",
});

export const { useSession, signIn, signUp, signOut } = authClient;
