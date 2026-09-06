"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "../../contexts/AuthContext";
import Navbar from "../../components/Navbar";
import { apiUrl } from "../../lib/api";

const easeOut = [0.25, 0.1, 0.25, 1] as const;

interface Ingredient {
  id: number;
  name: string;
  quantity?: string;
  category?: string;
  rarity?: string;
  locked?: boolean;
}

interface Recipe {
  id: number;
  title: string;
  instructions?: string;
  difficulty: number;
  dietary_tags: string[];
  image_url?: string;
  is_unlocked?: boolean;
  total_ingredients_count?: number;
  owned_ingredients_count?: number;
  revealed_count?: number;
  locked_count?: number;
  ingredients: Ingredient[];
}

export default function RecipeDiscoveryPage() {
  const { user, logout } = useAuth() || {
    user: { username: "Chef", email: "chef@example.com", xp: 0, rank: "Novice" },
    logout: () => {}
  };

  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [userInventory, setUserInventory] = useState<any[]>([]);
  const [activeGoals, setActiveGoals] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Search & Filter state
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [selectedDifficulty, setSelectedDifficulty] = useState<number | null>(null);
  const [craftableOnly, setCraftableOnly] = useState(false);
  const [unlockedOnly, setUnlockedOnly] = useState(false);
  const [selectedRecipe, setSelectedRecipe] = useState<Recipe | null>(null);
  const [goalFeedback, setGoalFeedback] = useState<string | null>(null);

  // Set of owned ingredient names (case-insensitive)
  const ownedIngredientNames = useMemo(() => {
    const set = new Set<string>();
    userInventory.forEach((item) => {
      if (item.name) set.add(item.name.toLowerCase().trim());
    });
    return set;
  }, [userInventory]);

  // Set of tracked recipe IDs in active goals
  const activeGoalRecipeIds = useMemo(() => {
    const set = new Set<number>();
    activeGoals.forEach((goal) => {
      if (goal.recipe_id) set.add(goal.recipe_id);
    });
    return set;
  }, [activeGoals]);

  const fetchRecipesList = () => {
    const token = localStorage.getItem("flavordex_token");
    const headers: Record<string, string> = {};
    if (token) headers["Authorization"] = `Bearer ${token}`;

    setLoading(true);

    Promise.all([
      fetch(apiUrl("/recipes"), { headers }).then((res) => res.json()),
      fetch(apiUrl("/recipes/categories"), { headers }).then((res) => res.json()),
      token
        ? fetch(apiUrl("/users/me/inventory"), { headers }).then((res) => res.json())
        : Promise.resolve([]),
      token
        ? fetch(apiUrl("/users/me/goals"), { headers }).then((res) => res.json())
        : Promise.resolve([])
    ])
      .then(([recipesData, categoriesData, inventoryData, goalsData]) => {
        if (Array.isArray(recipesData)) setRecipes(recipesData);
        if (Array.isArray(categoriesData)) setCategories(["All", ...categoriesData]);
        if (Array.isArray(inventoryData)) setUserInventory(inventoryData);
        if (Array.isArray(goalsData)) setActiveGoals(goalsData);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  // Fetch initial data
  useEffect(() => {
    fetchRecipesList();
  }, []);

  // Server-assisted search with debounce
  useEffect(() => {
    const handler = setTimeout(() => {
      const token = localStorage.getItem("flavordex_token");
      const headers: Record<string, string> = {};
      if (token) headers["Authorization"] = `Bearer ${token}`;

      const params = new URLSearchParams();
      if (searchQuery.trim()) params.append("q", searchQuery.trim());
      if (selectedCategory && selectedCategory !== "All") params.append("category", selectedCategory);
      if (selectedDifficulty) params.append("difficulty", selectedDifficulty.toString());

      fetch(`${apiUrl('/recipes')}?${params.toString()}`, { headers })
        .then((res) => res.json())
        .then((data) => {
          if (Array.isArray(data)) {
            setRecipes(data);
          }
        })
        .catch(console.error);
    }, 300);

    return () => clearTimeout(handler);
  }, [searchQuery, selectedCategory, selectedDifficulty]);

  // Client-side filtering for Craftable only & Unlocked only toggles
  const filteredRecipes = useMemo(() => {
    return recipes.filter((recipe) => {
      if (unlockedOnly && !recipe.is_unlocked) return false;
      if (!craftableOnly) return true;
      if (!recipe.ingredients || recipe.ingredients.length === 0) return false;
      const ownedCount = recipe.ingredients.filter((ing) =>
        !ing.locked && ownedIngredientNames.has(ing.name.toLowerCase().trim())
      ).length;
      return ownedCount > 0;
    });
  }, [recipes, craftableOnly, unlockedOnly, ownedIngredientNames]);

  // Toggle recipe goal
  const handleToggleGoal = async (recipe: Recipe) => {
    const token = localStorage.getItem("flavordex_token");
    if (!token) {
      setGoalFeedback("Please sign in to track recipes!");
      setTimeout(() => setGoalFeedback(null), 3000);
      return;
    }

    try {
      const res = await fetch(apiUrl(`/users/me/goals/${recipe.id}`), {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      const data = await res.json();
      if (res.ok) {
        if (data.status === "added") {
          setActiveGoals((prev) => [...prev, { id: Date.now(), recipe_id: recipe.id, name: recipe.title }]);
          setGoalFeedback(`🎯 "${recipe.title}" added to Active Goals!`);
        } else {
          setActiveGoals((prev) => prev.filter((g) => g.recipe_id !== recipe.id));
          setGoalFeedback(`Removed "${recipe.title}" from Active Goals.`);
        }
        setTimeout(() => setGoalFeedback(null), 3000);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const getOwnedIngredientCount = useCallback(
    (recipe: Recipe) => {
      const total = recipe.total_ingredients_count ?? (recipe.ingredients?.length || 0);
      if (typeof recipe.owned_ingredients_count === "number") {
        return { owned: recipe.owned_ingredients_count, total };
      }
      if (!recipe.ingredients) return { owned: 0, total };
      const owned = recipe.ingredients.filter((ing) =>
        !ing.locked && ownedIngredientNames.has(ing.name.toLowerCase().trim())
      ).length;
      return { owned, total };
    },
    [ownedIngredientNames]
  );

  return (
    <div className="min-h-screen bg-[#0d0d0f] text-white flex flex-col font-sans pb-28 md:pb-12 selection:bg-pink-500/30">
      {/* Universal Navbar */}
      <Navbar />

      {/* Goal Feedback Toast */}
      <AnimatePresence>
        {goalFeedback && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="fixed top-20 left-1/2 -translate-x-1/2 z-50 px-6 py-3 rounded-full bg-purple-950 border border-purple-500/50 text-purple-200 text-xs md:text-sm font-semibold shadow-2xl backdrop-blur-md"
          >
            {goalFeedback}
          </motion.div>
        )}
      </AnimatePresence>

      <main className="max-w-7xl mx-auto px-6 py-8 flex-1 w-full">
        {/* Hero & Search Header */}
        <section className="mb-10 text-center relative">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[300px] bg-gradient-to-r from-pink-600/20 via-purple-600/20 to-indigo-600/20 rounded-full blur-[120px] pointer-events-none" />

          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: easeOut }}
            className="relative z-10"
          >
            <span className="inline-block px-3 py-1 mb-3 rounded-full bg-pink-500/10 border border-pink-500/20 text-pink-400 text-xs font-bold uppercase tracking-widest">
              🍳 Recipe Quest & Mystery Codex
            </span>
            <h1 className="text-4xl md:text-5xl font-black tracking-tight mb-3 font-display">
              Discover <span className="bg-clip-text text-transparent bg-gradient-to-r from-pink-500 via-purple-400 to-indigo-400">Recipes</span>
            </h1>
            <p className="text-gray-400 text-sm md:text-base max-w-2xl mx-auto">
              Browse partial recipe clues from the global culinary codex. Search the web, import the recipe link in <strong className="text-orange-400">The Kitchen</strong>, and unlock complete secrets + ingredients into your Dex!
            </p>
          </motion.div>

          {/* Search Bar Input */}
          <div className="mt-8 max-w-2xl mx-auto relative z-10">
            <div className="relative flex items-center">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by recipe title, cuisine, or ingredients (e.g. Pasta, Garlic, Tikka)..."
                className="w-full bg-[#151518]/90 border border-white/10 focus:border-pink-500 rounded-2xl py-4 pl-12 pr-12 text-sm text-white placeholder-gray-500 shadow-2xl focus:outline-none transition-all"
              />
              <span className="absolute left-4 text-gray-500 text-lg">🔍</span>
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="absolute right-4 text-gray-400 hover:text-white text-xs uppercase font-bold bg-white/5 px-2 py-1 rounded"
                >
                  Clear
                </button>
              )}
            </div>
          </div>

          {/* Category Filter Pills */}
          <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none max-w-5xl mx-auto pt-6">
            {categories.map((cat) => {
              const active = selectedCategory === cat;
              return (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={`px-4 py-2 rounded-full text-xs font-bold uppercase tracking-wider transition-all whitespace-nowrap border ${
                    active
                      ? "bg-gradient-to-r from-pink-500 to-purple-600 text-white border-transparent shadow-[0_0_15px_rgba(236,72,153,0.3)]"
                      : "bg-[#151518]/60 text-gray-400 border-white/5 hover:border-white/20 hover:text-white"
                  }`}
                >
                  {cat}
                </button>
              );
            })}
          </div>

          {/* Sub-Filters Bar */}
          <div className="flex flex-wrap items-center justify-between gap-4 max-w-5xl mx-auto pt-3 text-xs">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-gray-500 font-bold uppercase tracking-wider">Difficulty:</span>
              <button
                onClick={() => setSelectedDifficulty(null)}
                className={`px-3 py-1.5 rounded-lg border font-semibold transition-all ${
                  selectedDifficulty === null
                    ? "bg-white/10 text-white border-white/20"
                    : "bg-[#151518]/40 text-gray-500 border-white/5 hover:text-gray-300"
                }`}
              >
                All
              </button>
              {[1, 2, 3, 4, 5].map((stars) => (
                <button
                  key={stars}
                  onClick={() => setSelectedDifficulty(selectedDifficulty === stars ? null : stars)}
                  className={`px-3 py-1.5 rounded-lg border font-semibold transition-all flex items-center gap-1 ${
                    selectedDifficulty === stars
                      ? "bg-amber-500/20 text-amber-300 border-amber-500/40 shadow-[0_0_10px_rgba(245,158,11,0.2)]"
                      : "bg-[#151518]/40 text-gray-500 border-white/5 hover:text-gray-300"
                  }`}
                >
                  <span>{stars}★</span>
                </button>
              ))}
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={() => setUnlockedOnly(!unlockedOnly)}
                className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl border transition-all ${
                  unlockedOnly
                    ? "bg-amber-500/20 border-amber-500/40 text-amber-300 shadow-[0_0_12px_rgba(245,158,11,0.2)] font-bold"
                    : "bg-[#151518]/60 border-white/5 text-gray-400 hover:text-white"
                }`}
              >
                <span>✨</span>
                <span>Unlocked Only</span>
              </button>

              <button
                onClick={() => setCraftableOnly(!craftableOnly)}
                className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl border transition-all ${
                  craftableOnly
                    ? "bg-emerald-500/20 border-emerald-500/40 text-emerald-300 shadow-[0_0_12px_rgba(16,185,129,0.2)] font-bold"
                    : "bg-[#151518]/60 border-white/5 text-gray-400 hover:text-white"
                }`}
              >
                <span>⚡</span>
                <span>Have Ingredients</span>
              </button>

              <span className="text-gray-500">
                Found <strong className="text-white">{filteredRecipes.length}</strong> recipes
              </span>
            </div>
          </div>
        </section>

        {/* Recipe Grid */}
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {Array.from({ length: 8 }).map((_, i) => (
              <div
                key={i}
                className="bg-[#151518]/40 border border-white/5 rounded-2xl h-80 animate-pulse flex flex-col p-4"
              >
                <div className="w-full h-40 bg-white/5 rounded-xl mb-4" />
                <div className="w-3/4 h-5 bg-white/5 rounded mb-2" />
                <div className="w-1/2 h-3 bg-white/5 rounded mt-auto" />
              </div>
            ))}
          </div>
        ) : filteredRecipes.length === 0 ? (
          <div className="text-center py-20 bg-[#151518]/30 rounded-3xl border border-white/5 max-w-2xl mx-auto p-8">
            <div className="text-5xl mb-4">🔍</div>
            <h3 className="text-xl font-bold text-white mb-2">No recipes found</h3>
            <p className="text-gray-400 text-sm mb-6">
              No recipes matched your search for &quot;{searchQuery}&quot; with the selected filters.
            </p>
            <button
              onClick={() => {
                setSearchQuery("");
                setSelectedCategory("All");
                setSelectedDifficulty(null);
                setCraftableOnly(false);
                setUnlockedOnly(false);
              }}
              className="px-6 py-2.5 rounded-full bg-white/10 hover:bg-white/20 text-white text-xs font-bold uppercase tracking-wider transition-all"
            >
              Reset Filters
            </button>
          </div>
        ) : (
          <motion.div
            layout
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6"
          >
            <AnimatePresence>
              {filteredRecipes.map((recipe) => {
                const { owned, total } = getOwnedIngredientCount(recipe);
                const isGoal = activeGoalRecipeIds.has(recipe.id);
                const percentOwned = total > 0 ? (owned / total) * 100 : 0;
                const isUnlocked = recipe.is_unlocked;

                return (
                  <motion.div
                    key={recipe.id}
                    layout
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    transition={{ duration: 0.25, ease: easeOut }}
                    whileHover={{ y: -4 }}
                    className={`bg-[#151518]/80 hover:bg-[#18181f] border rounded-2xl overflow-hidden flex flex-col group transition-all shadow-lg cursor-pointer relative ${
                      isUnlocked
                        ? "border-emerald-500/30 hover:border-emerald-400 hover:shadow-[0_10px_30px_rgba(16,185,129,0.15)]"
                        : "border-white/5 hover:border-amber-500/30 hover:shadow-[0_10px_30px_rgba(245,158,11,0.1)]"
                    }`}
                    onClick={() => setSelectedRecipe(recipe)}
                  >
                    {/* Cover Image */}
                    <div className="relative h-44 w-full bg-black/40 overflow-hidden">
                      {recipe.image_url ? (
                        <img
                          src={recipe.image_url}
                          alt={recipe.title}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                          loading="lazy"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-5xl bg-gradient-to-br from-purple-900/40 to-pink-900/40">
                          🍲
                        </div>
                      )}
                      <div className="absolute inset-0 bg-gradient-to-t from-[#151518] via-transparent to-black/30" />

                      {/* Difficulty Badge */}
                      <div className="absolute top-3 left-3 bg-[#0d0d0f]/80 backdrop-blur-md px-2.5 py-1 rounded-full border border-white/10 flex items-center gap-1 text-[11px] font-bold text-amber-300">
                        <span>★</span>
                        <span>{recipe.difficulty}/5</span>
                      </div>

                      {/* Unlock Status Badge */}
                      <div className="absolute top-3 right-3 flex flex-col items-end gap-1">
                        {isUnlocked ? (
                          <span className="bg-emerald-500 text-black px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider shadow-md flex items-center gap-1">
                            <span>✨</span> Unlocked
                          </span>
                        ) : (
                          <span className="bg-amber-500/90 text-black px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider shadow-md flex items-center gap-1">
                            <span>🔒</span> Partial
                          </span>
                        )}

                        {isGoal && (
                          <span className="bg-purple-500/90 text-white px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider shadow">
                            🎯 Goal
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Card Content */}
                    <div className="p-5 flex-1 flex flex-col">
                      <div className="flex flex-wrap gap-1.5 mb-2">
                        {recipe.dietary_tags &&
                          recipe.dietary_tags.slice(0, 2).map((tag) => (
                            <span
                              key={tag}
                              className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-white/5 text-gray-300 border border-white/10"
                            >
                              {tag}
                            </span>
                          ))}
                      </div>

                      <h3 className="font-bold text-base text-white mb-2 line-clamp-1 group-hover:text-pink-400 transition-colors">
                        {recipe.title}
                      </h3>

                      {!isUnlocked && (
                        <p className="text-[11px] text-amber-300/80 mb-3 flex items-center gap-1">
                          <span>🔒</span>
                          <span>{recipe.locked_count || 0} mystery ingredients hidden</span>
                        </p>
                      )}

                      {/* Ingredient Ownership Indicator */}
                      <div className="mt-auto pt-3 border-t border-white/5 space-y-2">
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-gray-400 flex items-center gap-1">
                            <span>📦</span> {total} Ingredients
                          </span>
                          <span
                            className={`font-bold ${
                              owned === total && total > 0
                                ? "text-emerald-400"
                                : owned > 0
                                ? "text-amber-400"
                                : "text-gray-500"
                            }`}
                          >
                            {isUnlocked
                              ? `${owned}/${total} in Dex`
                              : `${owned}/${total} in Dex (${recipe.locked_count || 0} Locked)`}
                          </span>
                        </div>

                        {/* Progress Bar */}
                        <div className="w-full h-1.5 bg-white/5 rounded-full overflow-hidden">
                          <div
                            className={`h-full transition-all duration-300 ${
                              owned === total && total > 0
                                ? "bg-gradient-to-r from-emerald-500 to-teal-400"
                                : isUnlocked
                                ? "bg-gradient-to-r from-pink-500 to-purple-500"
                                : "bg-gradient-to-r from-amber-500 to-orange-500"
                            }`}
                            style={{ width: `${total > 0 ? Math.min((owned / total) * 100, 100) : 0}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </motion.div>
        )}
      </main>

      {/* Recipe Detail Modal */}
      <AnimatePresence>
        {selectedRecipe && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4 backdrop-blur-md overflow-y-auto"
            onClick={() => setSelectedRecipe(null)}
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              transition={{ duration: 0.3, ease: easeOut }}
              className="bg-[#151518] border border-white/10 rounded-3xl max-w-3xl w-full max-h-[90vh] overflow-hidden flex flex-col shadow-2xl my-auto"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Modal Header Cover */}
              <div className="relative h-60 w-full bg-black/50 overflow-hidden flex-shrink-0">
                {selectedRecipe.image_url ? (
                  <img
                    src={selectedRecipe.image_url}
                    alt={selectedRecipe.title}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-7xl bg-gradient-to-br from-purple-900/50 to-pink-900/50">
                    🍲
                  </div>
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-[#151518] via-[#151518]/40 to-transparent" />

                <button
                  onClick={() => setSelectedRecipe(null)}
                  className="absolute top-4 right-4 w-9 h-9 rounded-full bg-black/60 hover:bg-black/90 text-white flex items-center justify-center text-sm font-bold border border-white/20 transition-all"
                >
                  ✕
                </button>

                <div className="absolute bottom-4 left-6 right-6 flex items-end justify-between">
                  <div>
                    <div className="flex items-center gap-2 mb-1.5">
                      {selectedRecipe.is_unlocked ? (
                        <span className="px-2.5 py-0.5 rounded-full bg-emerald-500 text-black text-xs font-black uppercase">
                          ✨ Full Recipe Unlocked
                        </span>
                      ) : (
                        <span className="px-2.5 py-0.5 rounded-full bg-amber-500 text-black text-xs font-black uppercase">
                          🔒 Partial Recipe — Locked
                        </span>
                      )}
                      <span className="px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40 text-xs font-bold">
                        ★ {selectedRecipe.difficulty}/5 Difficulty
                      </span>
                    </div>
                    <h2 className="text-2xl md:text-3xl font-black text-white">{selectedRecipe.title}</h2>
                  </div>
                </div>
              </div>

              {/* Modal Body */}
              <div className="p-6 overflow-y-auto space-y-6 flex-1">
                {/* Partial Recipe Callout Banner */}
                {!selectedRecipe.is_unlocked && (
                  <div className="p-4 rounded-2xl bg-gradient-to-r from-amber-500/10 via-orange-500/10 to-pink-500/10 border border-amber-500/30 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2 font-bold text-amber-300 text-sm">
                        <span>🔒</span>
                        <span>Unlock Full Recipe Secrets</span>
                      </div>
                      <p className="text-xs text-gray-300 mt-1">
                        Find this recipe on the web, copy its link, and import it into <strong className="text-orange-300">The Kitchen</strong>. All {selectedRecipe.total_ingredients_count || 0} ingredients and full chef instructions will be added to your account!
                      </p>
                    </div>

                    <a
                      href={`https://www.google.com/search?q=${encodeURIComponent(selectedRecipe.title + " recipe")}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white font-bold text-xs uppercase tracking-wider whitespace-nowrap border border-white/10 shrink-0"
                    >
                      🌐 Google Recipe ↗
                    </a>
                  </div>
                )}

                {/* Ingredients Checklist */}
                <div>
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 mb-3">
                    <h3 className="text-sm font-bold uppercase tracking-widest text-pink-400">
                      Recipe Ingredients ({getOwnedIngredientCount(selectedRecipe).total})
                    </h3>
                    <span className="text-xs text-gray-400">
                      {selectedRecipe.is_unlocked
                        ? `Owned: ${getOwnedIngredientCount(selectedRecipe).owned} / ${getOwnedIngredientCount(selectedRecipe).total} in Dex`
                        : `Owned: ${getOwnedIngredientCount(selectedRecipe).owned} / ${getOwnedIngredientCount(selectedRecipe).total} in Dex • ${selectedRecipe.locked_count || 0} Mystery Locked`}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {selectedRecipe.ingredients?.map((ing, idx) => {
                      if (ing.locked) {
                        return (
                          <div
                            key={idx}
                            className="p-3 rounded-xl border border-amber-500/20 bg-amber-500/5 text-amber-300/60 flex items-center justify-between backdrop-blur-sm"
                          >
                            <div className="flex items-center gap-2.5">
                              <span className="w-5 h-5 rounded-full bg-amber-500/20 flex items-center justify-center text-[10px] font-bold text-amber-400">
                                🔒
                              </span>
                              <span className="font-mono text-xs italic">??? Mystery Ingredient</span>
                            </div>
                            <span className="text-[10px] text-amber-400 font-bold uppercase tracking-wider">
                              Locked
                            </span>
                          </div>
                        );
                      }

                      const isOwned = ownedIngredientNames.has(ing.name.toLowerCase().trim());
                      return (
                        <div
                          key={ing.id}
                          className={`p-3 rounded-xl border flex items-center justify-between transition-all ${
                            isOwned
                              ? "bg-emerald-500/10 border-emerald-500/30 text-white"
                              : "bg-white/[0.02] border-white/5 text-gray-400"
                          }`}
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <span
                              className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold ${
                                isOwned ? "bg-emerald-500 text-black" : "bg-white/10 text-gray-500"
                              }`}
                            >
                              {isOwned ? "✓" : "•"}
                            </span>
                            <span className="font-medium text-sm truncate">{ing.name}</span>
                          </div>
                          <span className="text-xs font-mono text-gray-400 pl-2 shrink-0">
                            {ing.quantity || "1 unit"}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Instructions */}
                {selectedRecipe.instructions && (
                  <div>
                    <h3 className="text-sm font-bold uppercase tracking-widest text-purple-400 mb-3">
                      Cooking Instructions
                    </h3>
                    <div
                      className={`p-4 rounded-2xl border text-sm leading-relaxed whitespace-pre-line space-y-2 ${
                        selectedRecipe.is_unlocked
                          ? "bg-[#0d0d0f]/60 border-white/5 text-gray-300"
                          : "bg-amber-500/5 border-amber-500/20 text-amber-200/90 font-mono text-xs"
                      }`}
                    >
                      {selectedRecipe.instructions}
                    </div>
                  </div>
                )}
              </div>

              {/* Modal Footer Actions */}
              <div className="p-4 bg-[#0d0d0f]/80 border-t border-white/5 px-6 flex items-center justify-between gap-4">
                <button
                  onClick={() => handleToggleGoal(selectedRecipe)}
                  className={`px-5 py-2.5 rounded-xl font-bold text-xs uppercase tracking-wider transition-all flex items-center gap-2 border ${
                    activeGoalRecipeIds.has(selectedRecipe.id)
                      ? "bg-purple-500/20 text-purple-300 border-purple-500/50"
                      : "bg-white/5 hover:bg-white/10 text-white border-white/10"
                  }`}
                >
                  <span>🎯</span>
                  <span>
                    {activeGoalRecipeIds.has(selectedRecipe.id) ? "Tracking in Goals" : "Track as Goal"}
                  </span>
                </button>

                <div className="flex items-center gap-3">
                  {selectedRecipe.is_unlocked ? (
                    <Link
                      href="/crafting"
                      className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-pink-500 to-purple-600 text-white font-bold text-xs uppercase tracking-wider shadow-lg hover:opacity-95 transition-opacity"
                    >
                      Cook in Kitchen →
                    </Link>
                  ) : (
                    <Link
                      href="/crafting"
                      className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 via-orange-500 to-red-500 text-black font-extrabold text-xs uppercase tracking-wider shadow-[0_0_20px_rgba(245,158,11,0.4)] hover:opacity-95 transition-opacity flex items-center gap-1.5"
                    >
                      <span>🍳</span>
                      <span>Unlock in Kitchen →</span>
                    </Link>
                  )}
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
