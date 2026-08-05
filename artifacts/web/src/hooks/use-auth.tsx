import { createContext, useContext, useEffect, useRef, useState } from "react";
import { authLogin, authLogout, authRefresh } from "@workspace/api-client-react";

interface AuthContextType {
  hostToken: string | null;
  setHostToken: (token: string | null) => void;
  logout: () => void;
  accessToken: string | null;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const ACCESS_STORAGE = "streamline.accessJwt";
const AUTH_FETCH_OPTS: RequestInit = { credentials: "include" };

export function consumeTokenFromUrl(setHostToken: (token: string | null) => void): void {
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
    const data = await authLogin({ legacyToken }, AUTH_FETCH_OPTS);
    return data.accessToken ?? null;
  } catch {
    return null;
  }
}

async function refreshAccessJwt(): Promise<string | null> {
  try {
    const data = await authRefresh({}, AUTH_FETCH_OPTS);
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
      void authLogout(AUTH_FETCH_OPTS);
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
