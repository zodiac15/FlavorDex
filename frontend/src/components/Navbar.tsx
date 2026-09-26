"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { useAuth } from "../contexts/AuthContext";

type NavLink = {
  label: string;
  href: string;
  icon: string;
};

const guestNavLinks: NavLink[] = [
  { label: "Home", href: "/", icon: "⌂" },
  { label: "The Dex", href: "/collection", icon: "▦" },
  { label: "Recipes", href: "/recipes", icon: "✦" },
];

const authNavLinks: NavLink[] = [
  { label: "The Dex", href: "/collection", icon: "▦" },
  { label: "Recipes", href: "/recipes", icon: "✦" },
  { label: "Kitchen", href: "/crafting", icon: "♨" },
  { label: "Test Kitchen", href: "/test-kitchen", icon: "⌁" },
  { label: "Dashboard", href: "/dashboard", icon: "◈" },
];

function isLinkActive(pathname: string, href: string) {
  return pathname === href || (href !== "/" && pathname.startsWith(`${href}/`));
}

export default function Navbar() {
  const { user, logout } = useAuth();
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [profileDropdownOpen, setProfileDropdownOpen] = useState(false);

  const isAuthenticated = Boolean(user);
  const isModerator = user?.role === "moderator";
  const activeLinks = isAuthenticated
    ? isModerator
      ? [...authNavLinks, { label: "Admin Console", href: "/admin", icon: "⚑" }]
      : authNavLinks
    : guestNavLinks;

  return (
    <>
      <header className="sticky top-0 z-50 border-b border-white/[0.08] bg-[#080b10]/85 px-4 py-3 backdrop-blur-xl sm:px-6">
        <div className="mx-auto flex max-w-7xl items-center justify-between">
          <div className="flex items-center gap-7">
            <Link
              href={isAuthenticated ? "/dashboard" : "/"}
              className="group flex items-center gap-2.5 rounded-lg focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#e9b65c]"
              aria-label="FlavorDex home"
            >
              <span className="grid h-8 w-8 place-items-center rounded-lg border border-[#e77a9b]/50 bg-[#e77a9b]/10 font-display text-sm font-bold text-[#f08aaa] transition group-hover:border-[#e77a9b]">
                F
              </span>
              <span className="font-display text-lg font-bold tracking-[-0.02em] text-[#f7f3eb] sm:text-xl">
                Flavor<span className="text-[#e77a9b]">Dex</span>
              </span>
            </Link>

            <nav aria-label="Primary navigation" className="hidden items-center gap-1 lg:flex">
              {activeLinks.map((link) => {
                const active = isLinkActive(pathname, link.href);
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    aria-current={active ? "page" : undefined}
                    className={`flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold transition ${
                      active
                        ? "bg-white/[0.09] text-[#f7f3eb]"
                        : "text-[#8f98a6] hover:bg-white/[0.05] hover:text-[#f7f3eb]"
                    }`}
                  >
                    <span className={active ? "text-[#e9b65c]" : "text-[#687483]"} aria-hidden="true">{link.icon}</span>
                    {link.label}
                  </Link>
                );
              })}
            </nav>
          </div>

          <div className="flex items-center gap-2.5">
            {isAuthenticated ? (
              <div className="relative">
                <button
                  type="button"
                  aria-label="Open account menu"
                  aria-expanded={profileDropdownOpen}
                  aria-haspopup="menu"
                  onClick={() => setProfileDropdownOpen((open) => !open)}
                  className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] p-1.5 pr-2.5 transition hover:border-white/25 hover:bg-white/[0.08] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#e9b65c]"
                >
                  <span className="grid h-8 w-8 place-items-center rounded-lg bg-gradient-to-br from-[#e77a9b] to-[#6174d6] text-xs font-bold text-white">
                    {(user?.username || "U")[0].toUpperCase()}
                  </span>
                  <span className="hidden text-left sm:block">
                    <span className="block max-w-24 truncate text-xs font-bold text-[#f7f3eb]">{user?.username}</span>
                    <span className="block text-[10px] text-[#e9b65c]">Rank {user?.rank || 1} · {user?.xp || 0} XP</span>
                  </span>
                  <span className="hidden text-xs text-[#687483] sm:block" aria-hidden="true">⌄</span>
                </button>

                <AnimatePresence>
                  {profileDropdownOpen && (
                    <>
                      <button
                        type="button"
                        aria-label="Close account menu"
                        className="fixed inset-0 z-40 h-full w-full cursor-default"
                        onClick={() => setProfileDropdownOpen(false)}
                      />
                      <motion.div
                        role="menu"
                        initial={{ opacity: 0, y: -6, scale: 0.98 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: -6, scale: 0.98 }}
                        transition={{ duration: 0.15 }}
                        className="absolute right-0 z-50 mt-2 w-60 rounded-2xl border border-white/10 bg-[#121820] p-2 text-sm shadow-2xl shadow-black/50"
                      >
                        <div className="border-b border-white/10 px-3 pb-3 pt-2">
                          <p className="truncate text-xs font-bold text-[#f7f3eb]">{user?.username}</p>
                          <p className="mt-1 truncate text-[11px] text-[#687483]">{user?.email}</p>
                        </div>
                        <Link role="menuitem" href="/profile" onClick={() => setProfileDropdownOpen(false)} className="mt-1 flex items-center gap-3 rounded-xl px-3 py-2.5 text-xs font-semibold text-[#b4bdc9] transition hover:bg-white/[0.07] hover:text-[#f7f3eb]">
                          <span aria-hidden="true">◉</span> My profile and stats
                        </Link>
                        <Link role="menuitem" href="/dashboard" onClick={() => setProfileDropdownOpen(false)} className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-xs font-semibold text-[#b4bdc9] transition hover:bg-white/[0.07] hover:text-[#f7f3eb]">
                          <span aria-hidden="true">◈</span> Daily booster packs
                        </Link>
                        {isModerator && (
                          <Link role="menuitem" href="/admin" onClick={() => setProfileDropdownOpen(false)} className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-xs font-semibold text-[#d9c4f4] transition hover:bg-[#b58ae7]/10 hover:text-white">
                            <span aria-hidden="true">⚑</span> Admin console
                          </Link>
                        )}
                        <div className="mt-1 border-t border-white/10 pt-1">
                          <button type="button" onClick={() => { setProfileDropdownOpen(false); logout(); }} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-xs font-semibold text-[#e77a9b] transition hover:bg-[#e77a9b]/10">
                            <span aria-hidden="true">↪</span> Sign out
                          </button>
                        </div>
                      </motion.div>
                    </>
                  )}
                </AnimatePresence>
              </div>
            ) : (
              <div className="hidden items-center gap-2 sm:flex">
                <Link href="/auth" className="rounded-lg px-3 py-2 text-xs font-semibold text-[#a4acb8] transition hover:text-[#f7f3eb]">
                  Sign in
                </Link>
                <Link href="/auth" className="rounded-lg bg-[#e77a9b] px-4 py-2.5 text-xs font-bold text-[#230f19] transition hover:bg-[#f08aaa]">
                  Get started
                </Link>
              </div>
            )}

            <button
              type="button"
              aria-label={mobileMenuOpen ? "Close navigation menu" : "Open navigation menu"}
              aria-expanded={mobileMenuOpen}
              onClick={() => setMobileMenuOpen((open) => !open)}
              className="grid h-10 w-10 place-items-center rounded-xl border border-white/10 bg-white/[0.04] text-base text-[#a4acb8] transition hover:border-white/25 hover:text-[#f7f3eb] lg:hidden"
            >
              {mobileMenuOpen ? "×" : "☰"}
            </button>
          </div>
        </div>

        <AnimatePresence>
          {mobileMenuOpen && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="mx-auto max-w-7xl overflow-hidden lg:hidden"
            >
              <nav aria-label="Mobile navigation" className="space-y-1 border-t border-white/[0.08] pb-2 pt-3">
                {activeLinks.map((link) => {
                  const active = isLinkActive(pathname, link.href);
                  return (
                    <Link
                      key={link.href}
                      href={link.href}
                      aria-current={active ? "page" : undefined}
                      onClick={() => setMobileMenuOpen(false)}
                      className={`flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-semibold ${
                        active ? "bg-white/[0.08] text-[#f7f3eb]" : "text-[#8f98a6] hover:bg-white/[0.05] hover:text-[#f7f3eb]"
                      }`}
                    >
                      <span className="w-5 text-center text-[#e9b65c]" aria-hidden="true">{link.icon}</span>
                      {link.label}
                    </Link>
                  );
                })}
                {!isAuthenticated && (
                  <Link href="/auth" onClick={() => setMobileMenuOpen(false)} className="mt-2 block rounded-xl bg-[#e77a9b] px-4 py-3 text-center text-sm font-bold text-[#230f19]">
                    Get started
                  </Link>
                )}
              </nav>
            </motion.div>
          )}
        </AnimatePresence>
      </header>

      <nav aria-label="Quick navigation" className="fixed inset-x-0 bottom-0 z-40 flex items-center justify-around border-t border-white/10 bg-[#080b10]/95 px-3 py-2.5 backdrop-blur-xl lg:hidden">
        {(isAuthenticated
          ? [
              { label: "Dex", href: "/collection", icon: "▦" },
              { label: "Recipes", href: "/recipes", icon: "✦" },
              { label: "Booster", href: "/dashboard", icon: "◈" },
              { label: "Kitchen", href: "/crafting", icon: "♨" },
              { label: "Profile", href: "/profile", icon: "◉" },
            ]
          : guestNavLinks
        ).map((link) => {
          const active = isLinkActive(pathname, link.href);
          return (
            <Link
              key={link.href}
              href={link.href}
              aria-current={active ? "page" : undefined}
              className={`flex min-w-14 flex-col items-center gap-1 rounded-lg px-2 py-1 text-[10px] font-semibold transition ${
                active ? "text-[#e9b65c]" : "text-[#687483] hover:text-[#f7f3eb]"
              }`}
            >
              <span className="text-lg leading-none" aria-hidden="true">{link.icon}</span>
              {link.label}
            </Link>
          );
        })}
      </nav>
    </>
  );
}
