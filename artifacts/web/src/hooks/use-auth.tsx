import { createContext, useContext, useEffect, useState } from "react";

interface AuthContextType {
  hostToken: string | null;
  setHostToken: (token: string | null) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

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
