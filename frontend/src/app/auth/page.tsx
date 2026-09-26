"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "../../contexts/AuthContext";
import Link from "next/link";

export default function AuthPage() {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const { login, register } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      if (mode === "login") {
        await login(username, password);
      } else {
        await register(username, email, password);
      }
    } catch (err: any) {
      setError(err.message || "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="app-page flex min-h-screen items-center justify-center overflow-hidden p-4">
      {/* Background glow */}
      <div className="absolute left-1/2 top-1/2 h-[600px] w-[600px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#e77a9b]/10 blur-[120px] pointer-events-none" />

      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="relative z-10 w-full max-w-md"
      >
        {/* Logo */}
        <Link href="/" className="mb-10 block text-center">
          <div className="mx-auto grid h-11 w-11 place-items-center rounded-xl border border-[#e77a9b]/50 bg-[#e77a9b]/10 font-display text-lg font-bold text-[#f08aaa]">F</div>
          <h1 className="mt-4 font-display text-3xl font-bold tracking-[-0.04em] text-[#f7f3eb]">
            Flavor<span className="text-[#e77a9b]">Dex</span>
          </h1>
          <p className="mt-2 text-sm text-[#8f98a6]">Collect ingredients. Find your next dish.</p>
        </Link>

        {/* Card */}
        <div className="surface p-6 backdrop-blur-xl sm:p-8">
          {/* Toggle */}
          <div className="tab-strip mb-8 flex p-1">
            <button
              onClick={() => { setMode("login"); setError(""); }}
              className={`flex-1 py-3 rounded-lg text-sm font-bold uppercase tracking-widest transition-all ${
                mode === "login"
                  ?                   "bg-[#e77a9b] text-[#230f19] shadow-lg"
                  : "text-[#8f98a6] hover:text-[#f7f3eb]"
              }`}
            >
              Sign In
            </button>
            <button
              onClick={() => { setMode("register"); setError(""); }}
              className={`flex-1 py-3 rounded-lg text-sm font-bold uppercase tracking-widest transition-all ${
                mode === "register"
                  ?                   "bg-[#e77a9b] text-[#230f19] shadow-lg"
                  : "text-[#8f98a6] hover:text-[#f7f3eb]"
              }`}
            >
              Register
            </button>
          </div>

          <form onSubmit={handleSubmit} className="flex flex-col gap-5">
            <div>
              <label className="mb-2 block text-xs font-bold tracking-widest text-[#a4acb8]">Username</label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="control-input w-full px-4 py-3.5 transition-all"
                placeholder="Your collector name"
                required
              />
            </div>

            <AnimatePresence>
              {mode === "register" && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.3 }}
                  className="overflow-hidden"
                >
                  <label className="mb-2 block text-xs font-bold tracking-widest text-[#a4acb8]">Email</label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="control-input w-full px-4 py-3.5 transition-all"
                    placeholder="you@example.com"
                    required={mode === "register"}
                  />
                </motion.div>
              )}
            </AnimatePresence>

            <div>
              <label className="mb-2 block text-xs font-bold tracking-widest text-[#a4acb8]">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="control-input w-full px-4 py-3.5 transition-all"
                placeholder={mode === "register" ? "At least 6 characters" : "Your password"}
                required
              />
            </div>

            {error && (
              <motion.p
                initial={{ opacity: 0, y: -5 }}
                animate={{ opacity: 1, y: 0 }}
                className="rounded-lg border border-[#e77a9b]/25 bg-[#e77a9b]/10 py-2 text-center text-sm text-[#f08aaa]"
              >
                {error}
              </motion.p>
            )}

            <motion.button
              type="submit"
              disabled={loading}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className="brand-button w-full rounded-xl py-4 text-lg transition hover:shadow-[0_0_30px_rgba(231,122,155,0.3)] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading ? "..." : mode === "login" ? "Sign In" : "Create Account"}
            </motion.button>
          </form>
        </div>

        <p className="mt-6 text-center text-sm text-[#687483]">
          {mode === "login" ? "Don't have an account? " : "Already have an account? "}
          <button
            onClick={() => { setMode(mode === "login" ? "register" : "login"); setError(""); }}
            className="font-bold text-[#e77a9b] hover:text-[#f08aaa]"
          >
            {mode === "login" ? "Register" : "Sign In"}
          </button>
        </p>
      </motion.div>
    </main>
  );
}
