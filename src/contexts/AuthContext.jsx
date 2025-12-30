import { createContext, useContext, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

const AuthContext = createContext(undefined);

const USER_STORAGE_KEY = 'service_installation_user';

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const navigate = useNavigate();

  // Load user from localStorage on initial render
  useEffect(() => {
    try {
      const storedUser = localStorage.getItem(USER_STORAGE_KEY);
      if (storedUser) {
        setUser(JSON.parse(storedUser));
      }
    } catch (err) {
      console.error("Error loading user from storage:", err);
      localStorage.removeItem(USER_STORAGE_KEY);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const login = async (id, pass) => {
    try {
      const apiUrl = import.meta.env.VITE_SHEET_API_URL;
      const sheetName = import.meta.env.VITE_SHEET_LOGIN_NAME;

      const response = await fetch(`${apiUrl}?sheet=${sheetName}`);
      const result = await response.json();

      if (!result.success || !result.data) return 'error';

      const rows = result.data;
      // Columns: A=Serial, B=Employee Code, C=Name, D=ID, E=Pass, F=Role, G=Page Access, H=Status
      let matched = null;

      for (let i = 1; i < rows.length; i++) {
        const r = rows[i];
        // Convert to strings and trim for comparison
        const sheetId = String(r[3] || '').trim();     // Column D - User ID
        const sheetPass = String(r[4] || '').trim();   // Column E - Password
        const inputId = String(id).trim();
        const inputPass = String(pass).trim();

        if (sheetId === inputId && sheetPass === inputPass) {
          // Parse page access (Column G / Index 6)
          const pageAccessRaw = r[6];
          const pageAccess = pageAccessRaw
            ? String(pageAccessRaw).split(',').map(p => p.trim()).filter(Boolean)
            : [];

          // Get status (Column H / Index 7)
          const status = r[7] || 'Activated';

          matched = {
            id: sheetId,
            employeeCode: r[1] || '',  // Column B - Employee Code
            name: r[2] || '',          // Column C - User Name
            role: r[5] || 'User',      // Column F - Role
            pageAccess: pageAccess,
            status: status
          };
          break;
        }
      }

      if (matched) {
        // Check if user is deactivated
        if (matched.status === 'Deactivated') {
          return 'deactivated';
        }

        // Check if user has page access
        if (!matched.pageAccess || matched.pageAccess.length === 0) {
          return 'no_access';
        }

        // Save to localStorage
        localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(matched));
        setUser(matched);
        return true;
      }

      return 'invalid';

    } catch (err) {
      console.error("Login error:", err);
      return 'error';
    }
  };

  const logout = () => {
    localStorage.removeItem(USER_STORAGE_KEY);
    setUser(null);
    navigate("/login");
  };

  return (
    <AuthContext.Provider value={{ user, login, logout, isLoading }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
