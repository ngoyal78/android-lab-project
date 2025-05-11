import React, { createContext, useState, useContext, useEffect, ReactNode } from 'react';
import axios from 'axios';

// Define types
interface User {
  id: string;
  username: string;
  email: string;
  role: 'Admin' | 'Developer' | 'Tester';
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  error: string | null;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
  isAuthenticated: boolean;
  hasRole: (role: string | string[]) => boolean;
  authToken: string | null;
}

// Create context with default values
const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: false,
  error: null,
  login: async () => {},
  logout: () => {},
  isAuthenticated: false,
  hasRole: () => false,
  authToken: null,
});

// Custom hook to use the auth context
export const useAuth = () => useContext(AuthContext);

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Check if user is already logged in
  useEffect(() => {
    const checkAuthStatus = async () => {
      try {
        const token = localStorage.getItem('token');
        if (token) {
          // Set default auth header for all requests
          axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
          
          // Mock user data based on token for demo purposes
          // In a real app, this would be an API call to validate the token
          if (token === 'mock-jwt-token-for-admin') {
            setUser({
              id: '1',
              username: 'admin',
              email: 'admin@example.com',
              role: 'Admin'
            });
          } else if (token === 'mock-jwt-token-for-developer') {
            setUser({
              id: '2',
              username: 'developer',
              email: 'developer@example.com',
              role: 'Developer'
            });
          } else if (token === 'mock-jwt-token-for-tester') {
            setUser({
              id: '3',
              username: 'tester',
              email: 'tester@example.com',
              role: 'Tester'
            });
          } else {
            // Invalid token
            localStorage.removeItem('token');
          }
        }
      } catch (err) {
        console.error('Authentication check failed:', err);
        localStorage.removeItem('token');
      } finally {
        setLoading(false);
      }
    };

    checkAuthStatus();
  }, []);

  // Login function with mock authentication for demo purposes
  const login = async (username: string, password: string) => {
    setLoading(true);
    setError(null);
    try {
      // Mock authentication for demo purposes
      // In a real app, this would be an API call to the backend
      if (username === 'admin' && password === 'admin123') {
        const mockUser: User = {
          id: '1',
          username: 'admin',
          email: 'admin@example.com',
          role: 'Admin'
        };
        const mockToken = 'mock-jwt-token-for-admin';
        
        // Store token and set default auth header
        localStorage.setItem('token', mockToken);
        axios.defaults.headers.common['Authorization'] = `Bearer ${mockToken}`;
        
        setUser(mockUser);
      } else if (username === 'developer' && password === 'dev123') {
        const mockUser: User = {
          id: '2',
          username: 'developer',
          email: 'developer@example.com',
          role: 'Developer'
        };
        const mockToken = 'mock-jwt-token-for-developer';
        
        localStorage.setItem('token', mockToken);
        axios.defaults.headers.common['Authorization'] = `Bearer ${mockToken}`;
        
        setUser(mockUser);
      } else if (username === 'tester' && password === 'test123') {
        const mockUser: User = {
          id: '3',
          username: 'tester',
          email: 'tester@example.com',
          role: 'Tester'
        };
        const mockToken = 'mock-jwt-token-for-tester';
        
        localStorage.setItem('token', mockToken);
        axios.defaults.headers.common['Authorization'] = `Bearer ${mockToken}`;
        
        setUser(mockUser);
      } else {
        throw new Error('Invalid credentials');
      }
    } catch (err: any) {
      setError(err.message || 'Login failed. Please try again.');
      throw err;
    } finally {
      setLoading(false);
    }
  };

  // Logout function
  const logout = () => {
    localStorage.removeItem('token');
    delete axios.defaults.headers.common['Authorization'];
    setUser(null);
  };

  // Check if user has specific role(s)
  const hasRole = (role: string | string[]) => {
    if (!user) return false;
    
    if (Array.isArray(role)) {
      return role.includes(user.role);
    }
    
    return user.role === role;
  };

  // Get the token from localStorage
  const authToken = localStorage.getItem('token');
  
  const value = {
    user,
    loading,
    error,
    login,
    logout,
    isAuthenticated: !!user,
    hasRole,
    authToken,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
