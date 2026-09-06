"use client";

import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { useRouter, usePathname } from "next/navigation";
import { apiUrl } from "../lib/api";

interface User {
  username: string;
  email: string;
  xp: number;
  rank: number;
  role?: string;
}

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  login: (username: string, password: string) => Promise<void>;
  register: (username: string, email: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

const PROTECTED_ROUTES = ["/dashboard", "/collection", "/crafting", "/test-kitchen"];

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();
  const pathname = usePathname();

  const fetchUser = async (token: string) => {
    try {
      const res = await fetch(apiUrl("/users/me"), {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setUser(data);
      } else {
        localStorage.removeItem("flavordex_token");
        setUser(null);
      }
    } catch (e) {
      console.error(e);
      setUser(null);
    }
  };

  // Check for existing session on mount
  useEffect(() => {
    const token = localStorage.getItem("flavordex_token");
    if (token) {
      fetchUser(token).then(() => setIsLoading(false));
    } else {
      setIsLoading(false);
    }
  }, []);

  // Protect routes
  useEffect(() => {
    if (!isLoading && !user && PROTECTED_ROUTES.some((r) => pathname.startsWith(r))) {
      router.push("/auth");
    }
  }, [user, isLoading, pathname, router]);

  const login = async (username: string, password: string) => {
    const formData = new URLSearchParams();
    formData.append("username", username);
    formData.append("password", password);

    const res = await fetch(apiUrl("/token"), {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: formData,
    });

    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.detail || "Login failed");
    }

    const data = await res.json();
    localStorage.setItem("flavordex_token", data.access_token);
    await fetchUser(data.access_token);
    router.push("/dashboard");
  };

  const register = async (username: string, email: string, password: string) => {
    const res = await fetch(`${API_URL}/register?username=${encodeURIComponent(username)}&email=${encodeURIComponent(email)}&password=${encodeURIComponent(password)}`, {
      method: "POST",
    });

    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.detail || "Registration failed");
    }

    // Auto login after register
    await login(username, password);
  };

  const logout = () => {
    localStorage.removeItem("flavordex_token");
    setUser(null);
    router.push("/");
  };

  return (
    <AuthContext.Provider value={{ user, isLoading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}
