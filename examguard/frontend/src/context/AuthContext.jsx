import { createContext, useContext, useEffect, useState } from "react";
import http from "@/utils/api";

const AuthContext = createContext({ user: undefined, company: null, loading: true });

export function AuthProvider({ children }) {
  const [user, setUser] = useState(undefined); // undefined = still checking
  const [company, setCompany] = useState(null);

  useEffect(() => {
    http
      .get("/auth/me")
      .then(({ data }) => {
        setUser(data.user);
        setCompany(data.company);
      })
      .catch(() => setUser(null));
  }, []);

  return <AuthContext.Provider value={{ user, company, setUser, setCompany, loading: user === undefined }}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
