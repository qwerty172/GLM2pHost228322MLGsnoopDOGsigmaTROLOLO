import { createContext, useContext, useEffect, useRef, useState } from "react";

interface AuthContextType {
  hostToken: string | null;
  setHostToken: (token: string | null) => void;
  logout: () => void;
  accessToken: string | null;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const ACCESS_STORAGE = "streamline.accessJwt";

function consumeTokenFromUrl(setHostToken: (token: string | null) => void): void {
  const params = new URLSearchParams(window.location.search);
  const token = params.get("token");
  if (token) {
    setHostToken(token);
    params.delete("token");
    const qs = params.toString();
    const next = `${window.location.pathname}${qs ? `?${qs}` : ""}${window.location.hash}`;
    window.history.replaceState({}, "", next);
  }
}

async function exchangeLegacyForJwt(legacyToken: string): Promise<string | null> {
  try {
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ legacyToken }),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { accessToken?: string };
    return data.accessToken ?? null;
  } catch {
    return null;
  }
}

async function refreshAccessJwt(): Promise<string | null> {
  try {
    const res = await fetch("/api/auth/refresh", {
      method: "POST",
      credentials: "include",
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { accessToken?: string };
    return data.accessToken ?? null;
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [hostToken, setToken] = useState<string | null>(() => {
    return localStorage.getItem("streamline.hostToken");
  });
  const [accessToken, setAccessToken] = useState<string | null>(() => {
    return sessionStorage.getItem(ACCESS_STORAGE);
  });
  const refreshTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const setHostToken = (token: string | null) => {
    if (token) {
      localStorage.setItem("streamline.hostToken", token);
    } else {
      localStorage.removeItem("streamline.hostToken");
      sessionStorage.removeItem(ACCESS_STORAGE);
      setAccessToken(null);
      void fetch("/api/auth/logout", { method: "POST", credentials: "include" });
    }
    setToken(token);
  };

  useEffect(() => {
    consumeTokenFromUrl(setHostToken);
  }, []);

  useEffect(() => {
    if (!hostToken) return;
    void exchangeLegacyForJwt(hostToken).then((jwt) => {
      if (jwt) {
        sessionStorage.setItem(ACCESS_STORAGE, jwt);
        setAccessToken(jwt);
      }
    });
  }, [hostToken]);

  useEffect(() => {
    if (!hostToken) return;
    if (refreshTimerRef.current) clearInterval(refreshTimerRef.current);
    refreshTimerRef.current = setInterval(() => {
      void refreshAccessJwt().then((jwt) => {
        if (jwt) {
          sessionStorage.setItem(ACCESS_STORAGE, jwt);
          setAccessToken(jwt);
        }
      });
    }, 12 * 60 * 1000);
    return () => {
      if (refreshTimerRef.current) clearInterval(refreshTimerRef.current);
    };
  }, [hostToken]);

  const logout = () => {
    setHostToken(null);
  };

  return (
    <AuthContext.Provider value={{ hostToken, setHostToken, logout, accessToken }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
