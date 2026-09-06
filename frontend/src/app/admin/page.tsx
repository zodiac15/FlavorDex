'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../../contexts/AuthContext';
import Navbar from '../../components/Navbar';
import { apiUrl } from '../../lib/api';

const easeOut = [0.16, 1, 0.3, 1] as const;

type Stats = { total_users: number, total_ingredients: number, total_recipes: number };
type User = { id: number, username: string, email: string, role: string, xp: number, rank: string };
interface Ingredient {
  id: number;
  name: string;
  category: string;
  rarity: string;
  origin?: string;
  description?: string;
}

interface Recipe {
  id: number;
  title: string;
  difficulty: number;
  dietary_tags?: string[];
  instructions?: string;
  ingredients?: any[];
};

interface SpiderStatus {
  status: string;
  recipes_harvested: number;
  ingredients_added: number;
  anomalies_flagged: number;
  current_target: string;
  started_at: string | null;
  logs: string[];
}

const rarityColors: Record<string, string> = {
  Common: 'bg-gray-500/20 text-gray-300 border-gray-500/30',
  Uncommon: 'bg-green-500/20 text-green-300 border-green-500/30',
  Rare: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
  Epic: 'bg-purple-500/20 text-purple-300 border-purple-500/30',
};

const CUISINES = [
  "All Global Cuisines", "Italian", "Mexican", "Japanese", "Indian", "French", 
  "Thai", "Spanish", "Greek", "Moroccan", "Jamaican", "British", 
  "American", "Vietnamese", "Turkish", "Korean", "Portuguese", "Egyptian"
];

export default function AdminDashboard() {
  const { user, logout } = useAuth();
  
  const [activeTab, setActiveTab] = useState<'Users' | 'Ingredients' | 'Recipes' | 'Web Spider'>('Web Spider');
  const [stats, setStats] = useState<Stats | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [ingredientSearch, setIngredientSearch] = useState('');

  // Web Spider state
  const [spiderStatus, setSpiderStatus] = useState<SpiderStatus>({
    status: "idle",
    recipes_harvested: 0,
    ingredients_added: 0,
    anomalies_flagged: 0,
    current_target: "None",
    started_at: null,
    logs: []
  });
  const [crawlLimit, setCrawlLimit] = useState(20);
  const [crawlArea, setCrawlArea] = useState("All Global Cuisines");
  const [isTriggeringSpider, setIsTriggeringSpider] = useState(false);

  const fetchSpiderStatus = async () => {
    const token = localStorage.getItem("flavordex_token");
    if (!token) return;
    try {
      const res = await fetch(apiUrl("/admin/crawler/status"), {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setSpiderStatus(data);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const fetchData = async () => {
    const token = localStorage.getItem("flavordex_token");
    if (!token) {
      setError('No authentication token found. Please log in.');
      setLoading(false);
      return;
    }

    const headers = { 'Authorization': `Bearer ${token}` };
    
    try {
      const [statsRes, usersRes, ingredientsRes, recipesRes] = await Promise.all([
        fetch(apiUrl('/admin/stats'), { headers }),
        fetch(apiUrl('/admin/users'), { headers }),
        fetch(apiUrl('/admin/ingredients'), { headers }),
        fetch(apiUrl('/admin/recipes'), { headers })
      ]);

      if (statsRes.status === 401 || statsRes.status === 403 ||
          usersRes.status === 401 || usersRes.status === 403 ||
          ingredientsRes.status === 401 || ingredientsRes.status === 403 ||
          recipesRes.status === 401 || recipesRes.status === 403) {
        setError('Unauthorized. You do not have admin access or your token expired.');
        setLoading(false);
        return;
      }

      if (!statsRes.ok || !usersRes.ok || !ingredientsRes.ok || !recipesRes.ok) {
        throw new Error('Failed to fetch some admin data.');
      }

      const [statsData, usersData, ingredientsData, recipesData] = await Promise.all([
        statsRes.json(),
        usersRes.json(),
        ingredientsRes.json(),
        recipesRes.json()
      ]);

      setStats(statsData);
      setUsers(usersData);
      setIngredients(ingredientsData);
      setRecipes(recipesData);
      setLoading(false);
    } catch (err: any) {
      setError(err.message || 'An error occurred while fetching admin data.');
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    fetchSpiderStatus();
  }, []);

  // Poll spider status when on the spider tab or when running
  useEffect(() => {
    const interval = setInterval(() => {
      fetchSpiderStatus();
    }, 2500);
    return () => clearInterval(interval);
  }, []);

  const handleStartSpider = async () => {
    const token = localStorage.getItem("flavordex_token");
    if (!token) return;

    setIsTriggeringSpider(true);
    try {
      const res = await fetch(apiUrl("/admin/crawler/start"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          limit: crawlLimit,
          category: crawlArea === "All Global Cuisines" ? "all" : crawlArea
        })
      });
      if (res.ok) {
        fetchSpiderStatus();
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsTriggeringSpider(false);
    }
  };

  const handleStopSpider = async () => {
    const token = localStorage.getItem("flavordex_token");
    if (!token) return;
    try {
      await fetch(apiUrl("/admin/crawler/stop"), {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` }
      });
      fetchSpiderStatus();
    } catch (e) {
      console.error(e);
    }
  };

  const filteredIngredients = ingredients.filter(i => 
    i.name.toLowerCase().includes(ingredientSearch.toLowerCase()) ||
    i.category.toLowerCase().includes(ingredientSearch.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-[#0d0d0f] text-white font-sans selection:bg-orange-500/30">
      {/* Universal Navbar */}
      <Navbar />

      <main className="max-w-7xl mx-auto px-8 py-10 space-y-10 pb-24">
        {error ? (
          <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-6 rounded-2xl text-center">
            <p>{error}</p>
          </div>
        ) : loading ? (
          <div className="flex items-center justify-center h-[50vh]">
            <div className="w-8 h-8 rounded-full border-2 border-red-500 border-t-transparent animate-spin" />
          </div>
        ) : (
          <>
            {/* Header Title */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-white/5 pb-6">
              <div>
                <span className="text-[10px] text-red-400 font-bold uppercase tracking-widest bg-red-500/10 border border-red-500/20 px-3 py-1 rounded-full">
                  🛡️ Moderator Command Center
                </span>
                <h1 className="text-3xl font-black font-display tracking-tight text-white mt-2">
                  Admin <span className="bg-clip-text text-transparent bg-gradient-to-r from-red-400 to-orange-400">Dashboard</span>
                </h1>
              </div>
              <button
                onClick={() => {
                  fetchData();
                  fetchSpiderStatus();
                }}
                className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-white text-xs font-bold uppercase tracking-wider transition-all border border-white/10 flex items-center gap-1.5"
              >
                <span>🔄</span> Refresh Database Data
              </button>
            </div>

            {/* Stats Overview */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
              <div className="bg-[#151518]/60 border border-white/5 rounded-2xl p-6 relative overflow-hidden backdrop-blur-md">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-white/50 uppercase tracking-wider">Total Users</span>
                  <span className="text-xl">👥</span>
                </div>
                <div className="text-3xl font-extrabold text-white mt-3 font-mono">
                  {stats?.total_users ?? 0}
                </div>
              </div>

              <div className="bg-[#151518]/60 border border-white/5 rounded-2xl p-6 relative overflow-hidden backdrop-blur-md">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-white/50 uppercase tracking-wider">Cataloged Ingredients</span>
                  <span className="text-xl">🧪</span>
                </div>
                <div className="text-3xl font-extrabold text-white mt-3 font-mono">
                  {stats?.total_ingredients ?? 0}
                </div>
              </div>

              <div className="bg-[#151518]/60 border border-white/5 rounded-2xl p-6 relative overflow-hidden backdrop-blur-md">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-white/50 uppercase tracking-wider">Live Recipes</span>
                  <span className="text-xl">📋</span>
                </div>
                <div className="text-3xl font-extrabold text-white mt-3 font-mono">
                  {stats?.total_recipes ?? 0}
                </div>
              </div>

              <div className="bg-[#151518]/60 border border-white/5 rounded-2xl p-6 relative overflow-hidden backdrop-blur-md">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-white/50 uppercase tracking-wider">Spider Status</span>
                  <span className="text-xl">🕷️</span>
                </div>
                <div className="text-sm font-extrabold mt-3 flex items-center gap-2">
                  <span className={`w-2.5 h-2.5 rounded-full ${spiderStatus.status === 'crawling' ? 'bg-emerald-400 animate-pulse' : 'bg-gray-500'}`} />
                  <span className={spiderStatus.status === 'crawling' ? 'text-emerald-400 font-mono' : 'text-gray-400 font-mono'}>
                    {spiderStatus.status.toUpperCase()}
                  </span>
                </div>
              </div>
            </div>

            {/* Navigation Tabs */}
            <div className="space-y-6">
              <div className="flex bg-[#151518]/80 p-1.5 rounded-2xl border border-white/5 max-w-2xl gap-1">
                {(['Web Spider', 'Recipes', 'Ingredients', 'Users'] as const).map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    className={`flex-1 py-2.5 text-xs font-extrabold rounded-xl transition-all uppercase tracking-wider flex items-center justify-center gap-1.5 ${
                      activeTab === tab 
                        ? 'bg-gradient-to-r from-red-500 to-orange-500 text-white shadow-[0_0_15px_rgba(239,68,68,0.3)]' 
                        : 'text-white/50 hover:text-white hover:bg-white/5'
                    }`}
                  >
                    <span>
                      {tab === 'Web Spider' && '🕷️'}
                      {tab === 'Recipes' && '🍲'}
                      {tab === 'Ingredients' && '🧪'}
                      {tab === 'Users' && '👥'}
                    </span>
                    <span>{tab}</span>
                  </button>
                ))}
              </div>

              <AnimatePresence mode="wait">
                {/* TAB 1: Web Spider Control Panel */}
                {activeTab === 'Web Spider' && (
                  <motion.div
                    key="spider"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ duration: 0.3, ease: easeOut }}
                    className="space-y-6"
                  >
                    {/* Spider Controls & Stats */}
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                      {/* Configuration Card */}
                      <div className="bg-[#151518]/80 border border-white/10 rounded-3xl p-6 lg:col-span-1 shadow-xl flex flex-col justify-between">
                        <div>
                          <div className="flex items-center gap-2 mb-2">
                            <span className="text-xl">🕷️</span>
                            <h2 className="text-lg font-bold text-white">Spider Mission Config</h2>
                          </div>
                          <p className="text-xs text-gray-400 mb-6">
                            Configure target cuisines and harvest limits. The automated crawler extracts recipes, normalizes ingredients, and stores them in the Dex.
                          </p>

                          <div className="space-y-4">
                            <div>
                              <label className="block text-xs font-bold uppercase tracking-wider text-gray-400 mb-2">
                                Target Culinary Sector
                              </label>
                              <select
                                value={crawlArea}
                                onChange={(e) => setCrawlArea(e.target.value)}
                                disabled={spiderStatus.status === 'crawling'}
                                className="w-full bg-[#090a0f] border border-white/10 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-red-400"
                              >
                                {CUISINES.map((c) => (
                                  <option key={c} value={c}>{c}</option>
                                ))}
                              </select>
                            </div>

                            <div>
                              <label className="block text-xs font-bold uppercase tracking-wider text-gray-400 mb-2">
                                Harvest Limit ({crawlLimit} Recipes)
                              </label>
                              <input
                                type="range"
                                min={5}
                                max={100}
                                step={5}
                                value={crawlLimit}
                                onChange={(e) => setCrawlLimit(Number(e.target.value))}
                                disabled={spiderStatus.status === 'crawling'}
                                className="w-full accent-orange-500"
                              />
                              <div className="flex justify-between text-[10px] text-gray-500 font-mono mt-1">
                                <span>5</span>
                                <span>50</span>
                                <span>100</span>
                              </div>
                            </div>
                          </div>
                        </div>

                        <div className="pt-6 border-t border-white/5 mt-6 flex items-center gap-3">
                          {spiderStatus.status === 'crawling' ? (
                            <button
                              onClick={handleStopSpider}
                              className="w-full py-3 rounded-xl bg-red-500/20 hover:bg-red-500/30 text-red-300 border border-red-500/40 font-bold text-xs uppercase tracking-wider transition-all"
                            >
                              🛑 Stop Spider
                            </button>
                          ) : (
                            <button
                              onClick={handleStartSpider}
                              disabled={isTriggeringSpider}
                              className="w-full py-3 rounded-xl bg-gradient-to-r from-red-500 via-orange-500 to-amber-500 text-black font-black text-xs uppercase tracking-widest shadow-[0_0_20px_rgba(239,68,68,0.4)] hover:shadow-[0_0_30px_rgba(239,68,68,0.6)] disabled:opacity-50 transition-all"
                            >
                              {isTriggeringSpider ? "Launching..." : "🚀 Launch Spider Crawl"}
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Live Terminal & Metrics */}
                      <div className="bg-[#11141f]/90 border border-white/10 rounded-3xl p-6 lg:col-span-2 shadow-2xl flex flex-col justify-between">
                        <div>
                          <div className="flex items-center justify-between border-b border-white/5 pb-4 mb-4">
                            <div className="flex items-center gap-2">
                              <span className="w-2.5 h-2.5 rounded-full bg-orange-400 animate-pulse" />
                              <h3 className="font-mono text-xs font-bold uppercase tracking-wider text-gray-300">
                                Live Crawler Feed & Activity Log
                              </h3>
                            </div>
                            <span className="text-[11px] font-mono text-gray-500">
                              Sector: <strong className="text-orange-400">{spiderStatus.current_target}</strong>
                            </span>
                          </div>

                          {/* Quick Live Stats Pill Bar */}
                          <div className="grid grid-cols-3 gap-3 mb-4">
                            <div className="bg-[#090a0f] p-3 rounded-xl border border-white/5 text-center">
                              <span className="text-[10px] text-gray-500 uppercase font-bold block">Harvested</span>
                              <span className="text-xl font-bold font-mono text-emerald-400">
                                {spiderStatus.recipes_harvested}
                              </span>
                            </div>

                            <div className="bg-[#090a0f] p-3 rounded-xl border border-white/5 text-center">
                              <span className="text-[10px] text-gray-500 uppercase font-bold block">New Ingredients</span>
                              <span className="text-xl font-bold font-mono text-cyan-400">
                                {spiderStatus.ingredients_added}
                              </span>
                            </div>

                            <div className="bg-[#090a0f] p-3 rounded-xl border border-white/5 text-center">
                              <span className="text-[10px] text-gray-500 uppercase font-bold block">Anomalies</span>
                              <span className="text-xl font-bold font-mono text-purple-400">
                                {spiderStatus.anomalies_flagged}
                              </span>
                            </div>
                          </div>

                          {/* Live Console Output */}
                          <div className="bg-[#090a0f] border border-white/5 rounded-2xl p-4 h-64 overflow-y-auto font-mono text-xs text-gray-300 space-y-1.5">
                            {spiderStatus.logs && spiderStatus.logs.length > 0 ? (
                              spiderStatus.logs.map((log, index) => (
                                <div key={index} className="leading-relaxed">
                                  {log}
                                </div>
                              ))
                            ) : (
                              <div className="text-gray-600 italic py-8 text-center">
                                Spider is idle. Click 'Launch Spider Crawl' to start harvesting recipes from the web.
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                )}

                {/* TAB 2: Users Management */}
                {activeTab === 'Users' && (
                  <motion.div
                    key="users"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ duration: 0.3, ease: easeOut }}
                    className="overflow-x-auto bg-[#151518]/40 border border-white/5 rounded-2xl"
                  >
                    <table className="w-full text-left text-sm text-white/70">
                      <thead className="bg-[#151518]/60 text-xs font-semibold text-white/50 uppercase border-b border-white/5">
                        <tr>
                          <th className="px-6 py-4">User</th>
                          <th className="px-6 py-4">Email</th>
                          <th className="px-6 py-4">Role</th>
                          <th className="px-6 py-4">XP</th>
                          <th className="px-6 py-4">Rank</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/5">
                        {users.map((u) => (
                          <tr key={u.id} className="hover:bg-white/[0.02] transition-colors">
                            <td className="px-6 py-4 font-medium text-white flex items-center gap-3">
                              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-red-500 to-orange-500 flex items-center justify-center font-bold text-xs text-white">
                                {u.username[0].toUpperCase()}
                              </div>
                              {u.username}
                            </td>
                            <td className="px-6 py-4">{u.email}</td>
                            <td className="px-6 py-4">
                              <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${
                                u.role === 'moderator' 
                                  ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30' 
                                  : 'bg-white/5 text-white/60'
                              }`}>
                                {u.role}
                              </span>
                            </td>
                            <td className="px-6 py-4 font-mono">{u.xp}</td>
                            <td className="px-6 py-4 font-mono">{u.rank}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </motion.div>
                )}

                {/* TAB 3: Ingredients Management */}
                {activeTab === 'Ingredients' && (
                  <motion.div
                    key="ingredients"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ duration: 0.3, ease: easeOut }}
                    className="space-y-6"
                  >
                    <div className="flex items-center justify-between">
                      <input
                        type="text"
                        placeholder="Filter ingredients..."
                        value={ingredientSearch}
                        onChange={(e) => setIngredientSearch(e.target.value)}
                        className="bg-[#151518]/60 border border-white/10 rounded-xl px-4 py-2 text-sm text-white placeholder-white/40 focus:outline-none focus:border-red-500 w-72"
                      />
                      <span className="text-sm text-white/50">Showing {filteredIngredients.length} ingredients</span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                      {filteredIngredients.map((ing) => (
                        <div 
                          key={ing.id} 
                          className="bg-[#151518]/60 border border-white/5 rounded-xl p-4 flex flex-col justify-between hover:border-white/10 transition-colors"
                        >
                          <div>
                            <div className="flex items-center justify-between mb-2">
                              <span className="text-xs font-medium text-white/50">{ing.category}</span>
                              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${rarityColors[ing.rarity] || 'bg-white/5 text-white/60'}`}>
                                {ing.rarity}
                              </span>
                            </div>
                            <h3 className="font-semibold text-white/90">{ing.name}</h3>
                            {ing.description && (
                              <p className="text-xs text-white/50 mt-1 line-clamp-2">{ing.description}</p>
                            )}
                          </div>
                          {ing.origin && (
                            <div className="mt-4 pt-3 border-t border-white/5 text-xs text-white/40">
                              Origin: {ing.origin}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </motion.div>
                )}

                {/* TAB 4: Recipes Management */}
                {activeTab === 'Recipes' && (
                  <motion.div
                    key="recipes"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ duration: 0.3, ease: easeOut }}
                    className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4"
                  >
                    {recipes.map((recipe: any) => (
                      <div
                        key={recipe.id}
                        className="bg-[#151518]/60 border border-white/5 rounded-xl p-4 flex flex-col hover:border-white/10 transition-colors col-span-full md:col-span-1 lg:col-span-2"
                      >
                        <div className="flex-1 mb-4">
                          <h3 className="font-medium text-white/90 mb-1">{recipe.title}</h3>
                          <div className="flex items-center gap-1 mt-2 mb-3">
                            {Array.from({ length: 5 }).map((_, i) => (
                              <span key={i} className={`text-sm ${i < recipe.difficulty ? 'text-amber-500' : 'text-white/10'}`}>
                                ★
                              </span>
                            ))}
                          </div>
                          {recipe.instructions && (
                            <div className="mb-3">
                              <h4 className="text-xs font-bold text-white/70 uppercase mb-1">Instructions:</h4>
                              <p className="text-xs text-white/50 whitespace-pre-line line-clamp-3">
                                {recipe.instructions}
                              </p>
                            </div>
                          )}
                        </div>
                        {recipe.dietary_tags && recipe.dietary_tags.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-auto pt-3 border-t border-white/5">
                            {recipe.dietary_tags.map((tag: string) => (
                              <span key={tag} className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-white/5 text-white/60 border border-white/10">
                                {tag}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
