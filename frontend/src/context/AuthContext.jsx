import { createContext, useContext, useState, useEffect } from "react";

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);

  useEffect(() => {
    const storedToken = sessionStorage.getItem("token");
    const storedUser = sessionStorage.getItem("user");
    
    if (storedToken && storedUser) {
      setToken(storedToken);
      // بنحاول نفك الـ JSON لو متخزن، أو ناخده كـ String
      try {
        setUser(JSON.parse(storedUser));
      } catch {
        setUser({ name: storedUser });
      }
    }
  }, []);

  // دالة اللوجن المعدلة لاستقبال الرد من الـ .NET
  const login = (newToken, userName) => {
    sessionStorage.setItem("token", newToken);

    // لو userName string، نخزنه ك object
    const userData = typeof userName === "string" ? { name: userName } : userName;

    sessionStorage.setItem("user", JSON.stringify(userData));
    setToken(newToken);
    setUser(userData);

    console.log("✅ User stored:", userData); // <<< debug
  };

  const logout = () => {
    sessionStorage.removeItem("token");
    sessionStorage.removeItem("user");
    setToken(null);
    setUser(null);
    window.location.href = "/";
  };

  return (
    <AuthContext.Provider value={{ user, token, login, logout, isAuthenticated: !!token }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);