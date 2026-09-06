"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "../contexts/AuthContext";

export default function Navbar() {
  const { user, logout } = useAuth();
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [profileDropdownOpen, setProfileDropdownOpen] = useState(false);

  const isAuthenticated = !!user;
  const isModerator = user?.role === "moderator";

  // Navigation Links tailored to authentication state
  const guestNavLinks = [
    { label: "Home", href: "/", icon: "🏠" },
    { label: "The Dex", href: "/collection", icon: "📖" },
    { label: "Recipes", href: "/recipes", icon: "🍲" }
  ];

  const authNavLinks = [
    { label: "The Dex", href: "/collection", icon: "📖" },
    { label: "Recipes", href: "/recipes", icon: "🍲" },
    { label: "Kitchen", href: "/crafting", icon: "🍳" },
    { label: "Test Kitchen", href: "/test-kitchen", icon: "🔬" },
    { label: "Dashboard", href: "/dashboard", icon: "🎴" }
  ];

  if (isModerator) {
    authNavLinks.push({ label: "Admin Console", href: "/admin", icon: "🛡️" });
  }

  const activeLinks = isAuthenticated ? authNavLinks : guestNavLinks;

  return (
    <>
      <header className="sticky top-0 z-50 bg-[#0d0d0f]/85 backdrop-blur-xl border-b border-white/5 px-4 sm:px-6 py-3.5">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          {/* Logo */}
          <div className="flex items-center gap-8">
            <Link
              href={isAuthenticated ? "/dashboard" : "/"}
              className="text-xl sm:text-2xl font-black tracking-widest bg-clip-text text-transparent bg-gradient-to-r from-pink-500 via-purple-500 to-indigo-500 hover:opacity-90 transition-opacity"
            >
              FLAVORDEX
            </Link>

            {/* Desktop Navigation Links */}
            <nav className="hidden lg:flex items-center gap-1.5 text-sm font-medium">
              {activeLinks.map((link) => {
                const isActive = pathname === link.href;
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    className={`px-3.5 py-1.5 rounded-full transition-all flex items-center gap-1.5 ${
                      isActive
                        ? "bg-white/10 text-white font-bold border border-white/10 shadow-sm"
                        : "text-gray-400 hover:text-white hover:bg-white/[0.04]"
                    }`}
                  >
                    <span className="text-xs">{link.icon}</span>
                    <span>{link.label}</span>
                  </Link>
                );
              })}
            </nav>
          </div>

          {/* Right Section: Auth Specific Controls */}
          <div className="flex items-center gap-3">
            {isAuthenticated ? (
              <div className="relative">
                <div className="flex items-center gap-3">
                  {/* User Rank & XP Pill */}
                  <div className="hidden sm:flex flex-col items-end text-right">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-bold text-gray-200">{user?.username}</span>
                      {isModerator && (
                        <span className="px-1.5 py-0.2 rounded bg-purple-500/20 text-purple-300 border border-purple-500/40 text-[9px] font-extrabold uppercase">
                          Mod
                        </span>
                      )}
                    </div>
                    <span className="text-[10px] text-purple-400 font-mono">
                      Rank {user?.rank || 1} • {user?.xp || 0} XP
                    </span>
                  </div>

                  {/* Avatar Dropdown Trigger */}
                  <button
                    onClick={() => setProfileDropdownOpen(!profileDropdownOpen)}
                    className="w-9 h-9 rounded-full bg-gradient-to-br from-purple-500 via-pink-500 to-indigo-600 flex items-center justify-center font-bold text-xs text-white shadow-lg ring-2 ring-white/10 hover:ring-purple-400 transition-all cursor-pointer"
                  >
                    {(user?.username || "U")[0].toUpperCase()}
                  </button>
                </div>

                {/* Profile Dropdown Menu */}
                <AnimatePresence>
                  {profileDropdownOpen && (
                    <>
                      <div
                        className="fixed inset-0 z-40"
                        onClick={() => setProfileDropdownOpen(false)}
                      />
                      <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: -5 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: -5 }}
                        transition={{ duration: 0.15 }}
                        className="absolute right-0 mt-2 w-56 bg-[#151518] border border-white/10 rounded-2xl shadow-2xl z-50 p-2 text-sm"
                      >
                        <div className="px-3 py-2 border-b border-white/5 mb-1">
                          <p className="font-bold text-white text-xs truncate">{user?.username}</p>
                          <p className="text-[11px] text-gray-500 truncate">{user?.email}</p>
                        </div>

                        <Link
                          href="/profile"
                          onClick={() => setProfileDropdownOpen(false)}
                          className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-gray-300 hover:text-white hover:bg-white/5 transition-colors text-xs font-semibold"
                        >
                          <span>👤</span>
                          <span>My Profile & Stats</span>
                        </Link>

                        <Link
                          href="/dashboard"
                          onClick={() => setProfileDropdownOpen(false)}
                          className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-gray-300 hover:text-white hover:bg-white/5 transition-colors text-xs font-semibold"
                        >
                          <span>🎴</span>
                          <span>Daily Booster Packs</span>
                        </Link>

                        {isModerator && (
                          <Link
                            href="/admin"
                            onClick={() => setProfileDropdownOpen(false)}
                            className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-purple-300 hover:text-purple-200 hover:bg-purple-500/10 transition-colors text-xs font-semibold"
                          >
                            <span>🛡️</span>
                            <span>Admin Console</span>
                          </Link>
                        )}

                        <div className="border-t border-white/5 mt-1 pt-1">
                          <button
                            onClick={() => {
                              setProfileDropdownOpen(false);
                              logout();
                            }}
                            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-red-400 hover:bg-red-500/10 transition-colors text-xs font-semibold text-left"
                          >
                            <span>🚪</span>
                            <span>Sign Out</span>
                          </button>
                        </div>
                      </motion.div>
                    </>
                  )}
                </AnimatePresence>
              </div>
            ) : (
              /* Guest Actions */
              <div className="flex items-center gap-3">
                <Link
                  href="/auth"
                  className="text-xs font-bold text-gray-300 hover:text-white px-3 py-1.5 transition-colors"
                >
                  Sign In
                </Link>

                <Link
                  href="/auth"
                  className="px-4 py-2 rounded-full bg-gradient-to-r from-pink-500 via-purple-500 to-indigo-600 text-white text-xs font-bold uppercase tracking-wider shadow-lg hover:opacity-95 transition-all"
                >
                  Get Started
                </Link>
              </div>
            )}

            {/* Mobile Hamburger Toggle */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="lg:hidden p-2 rounded-xl bg-white/5 border border-white/10 text-gray-300 hover:text-white"
            >
              {mobileMenuOpen ? "✕" : "☰"}
            </button>
          </div>
        </div>

        {/* Mobile Slide-down Menu */}
        <AnimatePresence>
          {mobileMenuOpen && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="lg:hidden border-t border-white/5 mt-3 pt-3 space-y-1.5"
            >
              {activeLinks.map((link) => {
                const isActive = pathname === link.href;
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    onClick={() => setMobileMenuOpen(false)}
                    className={`flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium transition-all ${
                      isActive
                        ? "bg-white/10 text-white font-bold border border-white/10"
                        : "text-gray-400 hover:text-white hover:bg-white/[0.04]"
                    }`}
                  >
                    <span>{link.icon}</span>
                    <span>{link.label}</span>
                  </Link>
                );
              })}

              {!isAuthenticated && (
                <div className="pt-2 border-t border-white/5 flex gap-2">
                  <Link
                    href="/auth"
                    onClick={() => setMobileMenuOpen(false)}
                    className="flex-1 text-center py-2.5 rounded-xl bg-white/5 text-xs font-bold text-white border border-white/10"
                  >
                    Sign In
                  </Link>
                  <Link
                    href="/auth"
                    onClick={() => setMobileMenuOpen(false)}
                    className="flex-1 text-center py-2.5 rounded-xl bg-gradient-to-r from-pink-500 to-purple-600 text-xs font-bold text-white shadow"
                  >
                    Register
                  </Link>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </header>

      {/* Persistent Bottom Mobile Navigation Bar */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-[#0d0d0f]/95 backdrop-blur-xl border-t border-white/5 px-4 py-2.5 flex justify-around items-center pb-safe">
        {isAuthenticated ? (
          <>
            <Link
              href="/collection"
              className={`flex flex-col items-center gap-0.5 text-xs transition-colors ${
                pathname === "/collection" ? "text-pink-400 font-bold" : "text-gray-400 hover:text-white"
              }`}
            >
              <span className="text-lg">📖</span>
              <span className="text-[10px]">Dex</span>
            </Link>

            <Link
              href="/recipes"
              className={`flex flex-col items-center gap-0.5 text-xs transition-colors ${
                pathname === "/recipes" ? "text-pink-400 font-bold" : "text-gray-400 hover:text-white"
              }`}
            >
              <span className="text-lg">🍲</span>
              <span className="text-[10px]">Recipes</span>
            </Link>

            <Link
              href="/dashboard"
              className={`flex flex-col items-center gap-0.5 text-xs transition-colors ${
                pathname === "/dashboard"
                  ? "text-purple-400 font-bold scale-110 drop-shadow-[0_0_8px_rgba(168,85,247,0.6)]"
                  : "text-gray-400 hover:text-white"
              }`}
            >
              <span className="text-lg">🎴</span>
              <span className="text-[10px]">Booster</span>
            </Link>

            <Link
              href="/crafting"
              className={`flex flex-col items-center gap-0.5 text-xs transition-colors ${
                pathname === "/crafting" ? "text-orange-400 font-bold" : "text-gray-400 hover:text-white"
              }`}
            >
              <span className="text-lg">🍳</span>
              <span className="text-[10px]">Kitchen</span>
            </Link>

            <Link
              href="/test-kitchen"
              className={`flex flex-col items-center gap-0.5 text-xs transition-colors ${
                pathname === "/test-kitchen" ? "text-cyan-400 font-bold" : "text-gray-400 hover:text-white"
              }`}
            >
              <span className="text-lg">🔬</span>
              <span className="text-[10px]">Lab</span>
            </Link>

            <Link
              href="/profile"
              className={`flex flex-col items-center gap-0.5 text-xs transition-colors ${
                pathname === "/profile" ? "text-purple-400 font-bold" : "text-gray-400 hover:text-white"
              }`}
            >
              <span className="text-lg">👤</span>
              <span className="text-[10px]">Profile</span>
            </Link>
          </>
        ) : (
          <>
            <Link
              href="/"
              className={`flex flex-col items-center gap-0.5 text-xs transition-colors ${
                pathname === "/" ? "text-pink-400 font-bold" : "text-gray-400 hover:text-white"
              }`}
            >
              <span className="text-lg">🏠</span>
              <span className="text-[10px]">Home</span>
            </Link>

            <Link
              href="/collection"
              className={`flex flex-col items-center gap-0.5 text-xs transition-colors ${
                pathname === "/collection" ? "text-pink-400 font-bold" : "text-gray-400 hover:text-white"
              }`}
            >
              <span className="text-lg">📖</span>
              <span className="text-[10px]">The Dex</span>
            </Link>

            <Link
              href="/recipes"
              className={`flex flex-col items-center gap-0.5 text-xs transition-colors ${
                pathname === "/recipes" ? "text-pink-400 font-bold" : "text-gray-400 hover:text-white"
              }`}
            >
              <span className="text-lg">🍲</span>
              <span className="text-[10px]">Recipes</span>
            </Link>

            <Link
              href="/auth"
              className="flex flex-col items-center gap-0.5 text-xs text-purple-400 font-bold"
            >
              <span className="text-lg">🔑</span>
              <span className="text-[10px]">Sign In</span>
            </Link>
          </>
        )}
      </nav>
    </>
  );
}
