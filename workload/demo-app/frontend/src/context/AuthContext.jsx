import { createContext, useState } from "react";
import axios from "axios";

export const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);

  const login = async (username, password) => {
    try {
      const { data } = await axios.post("https://dummyjson.com/auth/login", {
        username,
        password,
      });

      console.log("Usuario autenticado:", data);

      const userId = data.id;
      const fullUserRes = await axios.get(
        `https://dummyjson.com/users/${userId}`
      );

      const fullUser = fullUserRes.data;
      setUser({
        ...fullUser,
        token: data.token,
      });      

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
