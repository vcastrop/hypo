import { createContext, useState } from "react";
import { api } from "../lib/api";

export const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);

  const login = async (username, password) => {
    try {
      const { data } = await api.post("/api/users/login", {
        username,
        password,
      });
      setUser(data);
    } catch (err) {
      throw new Error(err.response?.data?.message || "Credenciales inválidas");
    }
  };

  const logout = () => {
    setUser(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        login,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};
