import { createAuthClient } from "better-auth/react";

// better-auth requires an ABSOLUTE base URL. Build it from the current origin
// so it works on localhost and on any server (e.g. http://your-server) without
// host-specific config — nginx proxies /api -> backend (same origin, no CORS).
const authBase =
    import.meta.env.VITE_API_URL ||
    (typeof window !== "undefined" ? `${window.location.origin}/api` : "http://localhost/api");

export const authClient = createAuthClient({
    baseURL: authBase + "/auth",
});

export const { useSession, signIn, signUp, signOut } = authClient;
