"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import IngredientCard from "../../components/IngredientCard";
import Navbar from "../../components/Navbar";
import { apiUrl } from "../../lib/api";

export default function CollectionBook() {
  const [selectedCard, setSelectedCard] = useState<any>(null);
  const [pokedex, setPokedex] = useState<any[]>([]);

  useEffect(() => {
    const token = localStorage.getItem("flavordex_token");
    const headers: Record<string, string> = {};
    if (token) headers["Authorization"] = `Bearer ${token}`;

    Promise.all([
      fetch(apiUrl("/ingredients"), { headers }).then(res => res.json()),
      token ? fetch(apiUrl("/users/me/inventory"), { headers }).then(res => res.json()) : Promise.resolve([])
    ])
    .then(([ingredients, inventory]) => {
      const ownedIds = new Set(Array.isArray(inventory) ? inventory.map((item: any) => item.id) : []);
      const combined = (ingredients.detail ? [] : ingredients).map((item: any) => ({
        ...item,
        owned: ownedIds.has(item.id)
      }));
      setPokedex(combined);
    })
    .catch(console.error);
  }, []);

  const [search, setSearch] = useState("");

  const filteredPokedex = pokedex.filter((item) => {
    if (!search.trim()) return true;
    return item.name?.toLowerCase().includes(search.toLowerCase()) || item.category?.toLowerCase().includes(search.toLowerCase());
  }).sort((a, b) => {
    if (a.owned && !b.owned) return -1;
    if (!a.owned && b.owned) return 1;
    return (a.name || "").localeCompare(b.name || "");
  });

  return (
    <div className="app-page flex min-h-screen flex-col selection:bg-[#e77a9b]/30">
      <Navbar />

      <main className="page-wrap flex-1">
        <div className="mb-8 flex flex-col justify-between gap-4 border-b border-white/10 pb-5 sm:flex-row sm:items-center">
          <div>
            <span className="page-eyebrow">Your ingredient index</span>
            <h1 className="page-title">The Dex</h1>
            <p className="mt-2 text-sm text-[#8f98a6]">Every ingredient you have found, plus the ones still waiting in the wild.</p>
          </div>
          <div className="tab-strip flex self-start p-1 text-xs font-bold">
            <span className="rounded-lg bg-[#e77a9b] px-4 py-2 text-[#230f19]">
              Ingredients
            </span>
            <Link href="/recipes" className="rounded-lg px-4 py-2 text-[#8f98a6] transition-colors hover:text-[#f7f3eb]">
              Recipes
            </Link>
          </div>
        </div>

      <div className="mx-auto mb-8 w-full max-w-md">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search your ingredient index"
          className="control-input w-full px-4 py-3 text-sm transition-all"
        />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-8 max-w-6xl mx-auto w-full">
        {filteredPokedex.map((item) => (
          <div key={item.id} className="flex justify-center" onClick={() => item.owned && setSelectedCard(item)}>
            <div className={`transform scale-75 origin-top cursor-pointer transition-all ${!item.owned ? "opacity-20 grayscale saturate-0 hover:opacity-40" : "hover:scale-90"}`}>
              <IngredientCard name={item.owned ? item.name : "???"} category={item.category} rarity={item.owned ? item.rarity : "common"} />
            </div>
          </div>
        ))}
      </div>

      <AnimatePresence>
        {selectedCard && (
          <motion.div 
            initial={{ opacity: 0 }} 
            animate={{ opacity: 1 }} 
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm"
            onClick={() => setSelectedCard(null)}
          >
            <motion.div 
              initial={{ scale: 0.8, y: 50 }} 
              animate={{ scale: 1, y: 0 }} 
              exit={{ scale: 0.8, y: 50 }}
              className="surface w-full max-w-4xl flex flex-col items-center gap-12 p-8 md:flex-row"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex-shrink-0">
                <IngredientCard name={selectedCard.name} category={selectedCard.category} rarity={selectedCard.rarity} />
              </div>
              <div className="flex-1 flex flex-col">
                <h2 className="font-display mb-2 text-4xl font-bold tracking-tight text-[#f7f3eb]">{selectedCard.name}</h2>
                <div className="flex gap-4 mb-8">
                  <span className="rounded-full border border-white/15 px-4 py-1 text-sm font-bold capitalize tracking-wider text-[#a4acb8]">{selectedCard.category}</span>
                  <span className="rounded-full bg-[#e9b65c] px-4 py-1 text-sm font-bold capitalize tracking-wider text-[#17140f]">{selectedCard.rarity}</span>
                </div>
                
                <h3 className="mb-2 text-xs font-bold uppercase tracking-widest text-[#e9b65c]">Flavor profile</h3>
                <p className="mb-6 text-lg text-[#f7f3eb]">{selectedCard.flavor || "Flavor profile not recorded yet."}</p>
                
                <h3 className="mb-2 text-xs font-bold uppercase tracking-widest text-[#e9b65c]">Origin</h3>
                <p className="mb-6 text-lg text-[#f7f3eb]">{selectedCard.origin || "Origin not recorded yet."}</p>
                
                <button 
                  onClick={() => setSelectedCard(null)}
                  className="brand-button mt-auto self-end rounded-xl px-8 py-3 transition-colors"
                >
                  Close
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      </main>
    </div>
  );
}
