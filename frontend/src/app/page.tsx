"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import Navbar from "../components/Navbar";
import { apiUrl } from "../lib/api";

type PublicStats = {
  ingredients: number;
  recipes: number;
  users: number;
};

const features = [
  {
    number: "01",
    icon: "🎴",
    title: "Open a daily pack",
    description: "Pull ingredient cards, chase rare finds, and keep your streak alive.",
    accent: "from-[#e77a9b] to-[#ba4d76]",
  },
  {
    number: "02",
    icon: "🍳",
    title: "Build the recipe",
    description: "Turn your pantry into dishes by combining cards in the Kitchen.",
    accent: "from-[#e9b65c] to-[#c97838]",
  },
  {
    number: "03",
    icon: "🔬",
    title: "Shape the Dex",
    description: "Test unknown ingredients and help the community make better calls.",
    accent: "from-[#8ea4f4] to-[#6174d6]",
  },
];

const rarities = [
  { name: "Common", detail: "Everyday staples", color: "#8d9aaa", tone: "bg-[#8d9aaa]" },
  { name: "Uncommon", detail: "Worth a second look", color: "#a6c36f", tone: "bg-[#a6c36f]" },
  { name: "Rare", detail: "Harder to find", color: "#7c9ff2", tone: "bg-[#7c9ff2]" },
  { name: "Epic", detail: "Kitchen game changer", color: "#b58ae7", tone: "bg-[#b58ae7]" },
  { name: "Legendary", detail: "Collector's prize", color: "#efb75d", tone: "bg-[#efb75d]" },
  { name: "Mythic", detail: "Almost folklore", color: "#e77a9b", tone: "bg-[#e77a9b]" },
];

const reveal = {
  hidden: { opacity: 0, y: 18 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.55, ease: "easeOut" as const } },
};

const stagger = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.1 } },
};

function Stat({ value, label }: { value: number | null; label: string }) {
  return (
    <div className="flex items-center gap-3 border-l border-white/10 pl-4 first:border-l-0 first:pl-0">
      <span className="font-display text-2xl font-bold tracking-tight text-[#f7f3eb]">
        {value === null ? "—" : value.toLocaleString()}
      </span>
      <span className="max-w-20 text-[11px] font-medium leading-tight text-[#8f98a6]">{label}</span>
    </div>
  );
}

export default function Home() {
  const [stats, setStats] = useState<PublicStats | null>(null);

  useEffect(() => {
    const controller = new AbortController();

    fetch(apiUrl("/public/stats"), { signal: controller.signal })
      .then((response) => {
        if (!response.ok) {
          throw new Error(`Stats request failed with status ${response.status}`);
        }
        return response.json() as Promise<PublicStats>;
      })
      .then(setStats)
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        console.error("Unable to load public stats", error);
      });

    return () => controller.abort();
  }, []);

  return (
    <div className="min-h-screen overflow-x-hidden bg-[#080b10] text-[#f7f3eb] selection:bg-[#e77a9b]/30">
      <Navbar />

      <main className="pb-24 lg:pb-0">
        <section className="relative isolate overflow-hidden border-b border-white/[0.07]">
          <div className="market-grid absolute inset-0 -z-10 opacity-50" />
          <div className="absolute -left-40 top-24 -z-10 h-[30rem] w-[30rem] rounded-full bg-[#ba4d76]/15 blur-[120px]" />
          <div className="absolute -right-32 top-12 -z-10 h-[26rem] w-[26rem] rounded-full bg-[#6174d6]/15 blur-[110px]" />
          <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
            <span className="sparkle sparkle-one" />
            <span className="sparkle sparkle-two" />
            <span className="sparkle sparkle-three" />
          </div>

          <div className="mx-auto grid min-h-[710px] max-w-7xl items-center gap-14 px-6 py-20 lg:grid-cols-[1.05fr_0.95fr] lg:px-10">
            <motion.div initial="hidden" animate="visible" variants={stagger} className="max-w-2xl">
              <motion.div variants={reveal} className="mb-7 flex items-center gap-3 text-xs font-semibold tracking-[0.18em] text-[#e9b65c]">
                <span className="h-px w-8 bg-[#e9b65c]" />
                FlavorDex field guide
              </motion.div>
              <motion.h1
                variants={reveal}
                className="font-display max-w-xl text-5xl font-bold leading-[0.98] tracking-[-0.045em] text-[#f7f3eb] sm:text-7xl lg:text-[5.8rem]"
              >
                Your pantry,
                <span className="block text-[#e77a9b]">now collectible.</span>
              </motion.h1>
              <motion.p variants={reveal} className="mt-7 max-w-lg text-base leading-7 text-[#a4acb8] sm:text-lg">
                Find unusual ingredients, unlock recipes, and turn every meal into a small adventure.
              </motion.p>
              <motion.div variants={reveal} className="mt-9 flex flex-col gap-3 sm:flex-row">
                <Link
                  href="/auth"
                  className="inline-flex min-h-12 items-center justify-center rounded-xl bg-[#e77a9b] px-6 text-sm font-bold text-[#230f19] shadow-[0_12px_40px_rgba(231,122,155,0.22)] transition hover:-translate-y-0.5 hover:bg-[#f08aaa] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#e9b65c]"
                >
                  Open today&apos;s pack
                </Link>
                <Link
                  href="/collection"
                  className="inline-flex min-h-12 items-center justify-center rounded-xl border border-white/15 bg-white/[0.03] px-6 text-sm font-semibold text-[#f7f3eb] transition hover:border-white/30 hover:bg-white/[0.08] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#e9b65c]"
                >
                  Browse the Dex
                </Link>
              </motion.div>
              <motion.div variants={reveal} className="mt-14 flex flex-wrap gap-x-7 gap-y-4">
                <Stat value={stats?.ingredients ?? null} label="ingredients catalogued" />
                <Stat value={stats?.recipes ?? null} label="recipes to unlock" />
                <Stat value={stats?.users ?? null} label="active collectors" />
              </motion.div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, x: 28, rotate: 2 }}
              animate={{ opacity: 1, x: 0, rotate: 0 }}
              transition={{ duration: 0.7, delay: 0.25, ease: "easeOut" }}
              className="relative mx-auto w-full max-w-[430px]"
            >
              <div className="absolute -inset-5 rounded-[2rem] bg-[#e77a9b]/10 blur-2xl" />
              <div className="relative rotate-1 rounded-[1.6rem] border border-white/15 bg-[#121820]/95 p-4 shadow-2xl shadow-black/40">
                <div className="rounded-[1.1rem] border border-white/10 bg-[#1b222c] p-5">
                  <div className="flex items-start justify-between border-b border-white/10 pb-5">
                    <div>
                      <p className="text-[10px] font-semibold tracking-[0.2em] text-[#e9b65c]">Daily pull</p>
                      <h2 className="mt-2 font-display text-3xl font-bold tracking-tight">Market basket</h2>
                    </div>
                    <span className="rounded-full border border-[#a6c36f]/40 bg-[#a6c36f]/10 px-3 py-1 text-[11px] font-semibold text-[#c7e09a]">
                      Fresh
                    </span>
                  </div>
                  <div className="space-y-3 py-5">
                    {[
                      { icon: "🍋", name: "Meyer lemon", meta: "Rare", color: "#7c9ff2" },
                      { icon: "🌿", name: "Thai basil", meta: "Uncommon", color: "#a6c36f" },
                      { icon: "🌶️", name: "Aji amarillo", meta: "Epic", color: "#b58ae7" },
                    ].map((item) => (
                      <div key={item.name} className="flex items-center gap-3 rounded-xl bg-white/[0.045] px-3 py-3">
                        <span className="grid h-10 w-10 place-items-center rounded-lg bg-[#0e131a] text-xl">{item.icon}</span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold text-[#f7f3eb]">{item.name}</p>
                          <p className="mt-0.5 text-xs text-[#8993a1]">Ingredient card</p>
                        </div>
                        <span className="text-xs font-semibold" style={{ color: item.color }}>{item.meta}</span>
                      </div>
                    ))}
                  </div>
                  <div className="flex items-center justify-between border-t border-white/10 pt-4 text-xs text-[#8993a1]">
                    <span>Pack no. 0148</span>
                    <span className="text-[#f7f3eb]">3 cards found</span>
                  </div>
                </div>
              </div>
              <div className="absolute -bottom-5 -left-5 rounded-xl border border-[#e9b65c]/30 bg-[#17140f]/95 px-4 py-3 shadow-xl">
                <p className="text-[10px] font-semibold tracking-[0.15em] text-[#e9b65c]">Collection streak</p>
                <p className="mt-1 font-display text-xl font-bold text-[#f7f3eb]">07 days</p>
              </div>
            </motion.div>
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-6 py-24 lg:px-10 lg:py-32">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-80px" }}
            variants={stagger}
            className="mb-12 max-w-xl"
          >
            <motion.p variants={reveal} className="text-xs font-semibold tracking-[0.18em] text-[#e77a9b]">The loop</motion.p>
            <motion.h2 variants={reveal} className="mt-3 font-display text-4xl font-bold tracking-[-0.03em] sm:text-5xl">
              Collect with a reason.
            </motion.h2>
            <motion.p variants={reveal} className="mt-4 text-base leading-7 text-[#8f98a6]">
              Every card gives your next cooking session somewhere to go.
            </motion.p>
          </motion.div>
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-80px" }}
            variants={stagger}
            className="grid gap-4 md:grid-cols-3"
          >
            {features.map((feature) => (
              <motion.article
                key={feature.number}
                variants={reveal}
                className="group relative overflow-hidden rounded-2xl border border-white/10 bg-[#10161e] p-7 transition duration-300 hover:-translate-y-1 hover:border-white/20"
              >
                <div className={`absolute inset-x-0 top-0 h-1 bg-gradient-to-r ${feature.accent}`} />
                <div className="flex items-start justify-between">
                  <span className="grid h-12 w-12 place-items-center rounded-xl bg-white/[0.06] text-2xl">{feature.icon}</span>
                  <span className="font-mono text-xs text-[#667180]">{feature.number}</span>
                </div>
                <h3 className="mt-8 font-display text-2xl font-bold">{feature.title}</h3>
                <p className="mt-3 text-sm leading-6 text-[#8f98a6]">{feature.description}</p>
              </motion.article>
            ))}
          </motion.div>
        </section>

        <section className="border-y border-white/[0.07] bg-[#0d1219]">
          <div className="mx-auto max-w-7xl px-6 py-24 lg:px-10 lg:py-28">
            <div className="flex flex-col justify-between gap-6 sm:flex-row sm:items-end">
              <div>
                <p className="text-xs font-semibold tracking-[0.18em] text-[#e9b65c]">Card taxonomy</p>
                <h2 className="mt-3 font-display text-4xl font-bold tracking-[-0.03em] sm:text-5xl">Chase the unusual.</h2>
              </div>
              <p className="max-w-xs text-sm leading-6 text-[#8f98a6]">Six tiers. One very good excuse to keep checking the pantry.</p>
            </div>
            <div className="mt-12 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
              {rarities.map((rarity, index) => (
                <motion.div
                  key={rarity.name}
                  initial={{ opacity: 0, y: 12 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: index * 0.06 }}
                  className="group relative min-h-44 overflow-hidden rounded-xl border border-white/10 bg-[#151d27] p-4 transition hover:border-white/25"
                >
                  <div className={`absolute inset-x-0 top-0 h-1 ${rarity.tone}`} />
                  <div className="flex h-full flex-col justify-between">
                    <span className="grid h-9 w-9 place-items-center rounded-full border border-white/10 bg-[#0b1016] text-sm font-bold" style={{ color: rarity.color }}>
                      {index + 1}
                    </span>
                    <div>
                      <h3 className="text-sm font-bold">{rarity.name}</h3>
                      <p className="mt-1 text-xs leading-5 text-[#7f8997]">{rarity.detail}</p>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        <section className="relative overflow-hidden px-6 py-28 text-center lg:py-36">
          <div className="absolute left-1/2 top-1/2 -z-10 h-72 w-[42rem] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#e77a9b]/10 blur-[100px]" />
          <p className="text-xs font-semibold tracking-[0.18em] text-[#e77a9b]">Your next card is out there</p>
          <h2 className="mx-auto mt-4 max-w-2xl font-display text-4xl font-bold tracking-[-0.04em] sm:text-6xl">
            Make dinner more interesting.
          </h2>
          <p className="mx-auto mt-5 max-w-md text-base leading-7 text-[#8f98a6]">
            Start with one pack. Build a collection that tastes like you.
          </p>
          <Link
            href="/auth"
            className="mt-9 inline-flex min-h-12 items-center justify-center rounded-xl bg-[#f7f3eb] px-7 text-sm font-bold text-[#121820] transition hover:-translate-y-0.5 hover:bg-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#e9b65c]"
          >
            Start collecting
          </Link>
        </section>

        <footer className="border-t border-white/[0.07] px-6 py-8 lg:px-10">
          <div className="mx-auto flex max-w-7xl flex-col gap-4 text-xs text-[#667180] sm:flex-row sm:items-center sm:justify-between">
            <span>© 2026 FlavorDex. Built for curious cooks.</span>
            <div className="flex gap-5">
              <Link href="#" className="transition hover:text-[#f7f3eb]">Privacy</Link>
              <Link href="#" className="transition hover:text-[#f7f3eb]">Terms</Link>
              <Link href="#" className="transition hover:text-[#f7f3eb]">Discord</Link>
            </div>
          </div>
        </footer>
      </main>
    </div>
  );
}
