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
    <div className="min-h-screen bg-[#0d0d0f] text-white flex flex-col font-sans selection:bg-pink-500/30">
      <Navbar />

      <main className="max-w-7xl mx-auto px-6 py-8 flex-1 w-full pb-32">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8 border-b border-white/5 pb-4">
          <div>
            <h1 className="text-3xl font-black font-display tracking-widest text-white">THE DEX</h1>
            <p className="text-xs text-gray-400 mt-1">Catalog of all discovered culinary ingredients across the world.</p>
          </div>
          <div className="flex bg-[#151518] p-1 rounded-full border border-white/5 text-xs font-bold self-start">
            <span className="px-4 py-1.5 rounded-full bg-gradient-to-r from-pink-500 to-purple-600 text-white">
              Ingredients
            </span>
            <Link href="/recipes" className="px-4 py-1.5 rounded-full text-gray-400 hover:text-white transition-colors">
              Recipes Discovery →
            </Link>
          </div>
        </div>

      <div className="max-w-md mx-auto w-full mb-8">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search ingredients in Dex..."
          className="w-full bg-[#151518]/90 border border-white/10 rounded-2xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-pink-500 transition-all text-sm"
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
              className="bg-[#1a1a24] p-8 rounded-3xl border-2 border-gray-700 max-w-4xl w-full flex flex-col md:flex-row gap-12 items-center"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex-shrink-0">
                <IngredientCard name={selectedCard.name} category={selectedCard.category} rarity={selectedCard.rarity} />
              </div>
              <div className="flex-1 flex flex-col">
                <h2 className="text-4xl font-black font-display uppercase tracking-widest text-white mb-2">{selectedCard.name}</h2>
                <div className="flex gap-4 mb-8">
                  <span className="px-4 py-1 rounded-full border border-gray-500 text-gray-300 text-sm font-bold uppercase tracking-wider">{selectedCard.category}</span>
                  <span className="px-4 py-1 rounded-full bg-white text-black text-sm font-bold uppercase tracking-wider">{selectedCard.rarity}</span>
                </div>
                
                <h3 className="text-xl font-bold text-gray-400 mb-2">Flavor Profile</h3>
                <p className="text-lg text-white mb-6">{selectedCard.flavor || "Flavor profile unknown."}</p>
                
                <h3 className="text-xl font-bold text-gray-400 mb-2">Origin</h3>
                <p className="text-lg text-white mb-6">{selectedCard.origin || "Origin unknown."}</p>
                
                <button 
                  onClick={() => setSelectedCard(null)}
                  className="mt-auto self-end px-8 py-3 bg-neon-cyan text-black font-bold uppercase tracking-widest rounded-full hover:bg-white transition-colors"
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
