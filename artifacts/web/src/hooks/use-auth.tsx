import { createContext, useContext, useEffect, useState } from "react";

interface AuthContextType {
  hostToken: string | null;
  setHostToken: (token: string | null) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

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

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [hostToken, setToken] = useState<string | null>(() => {
    return localStorage.getItem("streamline.hostToken");
  });

  const setHostToken = (token: string | null) => {
    if (token) {
      localStorage.setItem("streamline.hostToken", token);
    } else {
      localStorage.removeItem("streamline.hostToken");
    }
    setToken(token);
  };

  useEffect(() => {
    consumeTokenFromUrl(setHostToken);
  }, []);

  const logout = () => {
    setHostToken(null);
  };

  return (
    <AuthContext.Provider value={{ hostToken, setHostToken, logout }}>
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
