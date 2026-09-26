"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "../../contexts/AuthContext";
import IngredientCard from "../../components/IngredientCard";
import Navbar from "../../components/Navbar";
import { apiUrl } from "../../lib/api";

const easeOut = [0.25, 0.1, 0.25, 1] as const;

interface UnlockedIngredient {
  id: number;
  name: string;
  category: string;
  rarity: "common" | "uncommon" | "rare" | "epic" | "legendary" | "mythic";
  quantity?: string;
  is_new?: boolean;
}

interface ScrapedRecipe {
  id: number;
  title: string;
  image_url?: string;
  difficulty: number;
  instructions?: string;
  dietary_tags?: string[];
}

const SAMPLE_URLS = [
  { label: "🍝 BBC Classic Lasagne", url: "https://www.bbcgoodfood.com/recipes/classic-lasagne" },
  { label: "🍛 Chicken Tikka Masala", url: "https://www.bbcgoodfood.com/recipes/chicken-tikka-masala" },
  { label: "🍪 Chocolate Chip Cookies", url: "https://www.bbcgoodfood.com/recipes/vintage-chocolate-chip-cookies" },
  { label: "🥞 Fluffy Pancakes", url: "https://www.bbcgoodfood.com/recipes/easy-pancakes" }
];

export default function KitchenCraftingPage() {
  const { user, logout } = useAuth() || {
    user: { username: "Chef", email: "chef@example.com", xp: 0, rank: "Novice" },
    logout: () => {}
  };

  const [recipeUrl, setRecipeUrl] = useState("");
  const [isScraping, setIsScraping] = useState(false);
  const [scrapeStep, setScrapeStep] = useState(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Scraped Result celebration
  const [scrapedResult, setScrapedResult] = useState<{
    recipe: ScrapedRecipe;
    unlocked_ingredients: UnlockedIngredient[];
    xp_gained: number;
    message: string;
  } | null>(null);

  // User state
  const [inventory, setInventory] = useState<any[]>([]);
  const [discoveredRecipes, setDiscoveredRecipes] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<"import" | "recipes" | "pantry">("import");
  const [pantrySearch, setPantrySearch] = useState("");

  const refreshUserData = () => {
    const token = localStorage.getItem("flavordex_token");
    if (!token) return;

    fetch(apiUrl("/users/me/inventory"), {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data)) setInventory(data);
      })
      .catch(console.error);

    fetch(apiUrl("/users/me/discovered-recipes"), {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data)) setDiscoveredRecipes(data);
      })
      .catch(console.error);
  };

  useEffect(() => {
    refreshUserData();
  }, []);

  const handleScrapeRecipe = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!recipeUrl.trim()) return;

    const token = localStorage.getItem("flavordex_token");
    if (!token) {
      setErrorMessage("Please sign in to scrape and save recipes to your account!");
      return;
    }

    setErrorMessage(null);
    setIsScraping(true);
    setScrapeStep(1);

    const stepInterval = setInterval(() => {
      setScrapeStep((prev) => (prev < 3 ? prev + 1 : prev));
    }, 900);

    try {
      const res = await fetch(apiUrl("/recipes/submit"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ url: recipeUrl.trim() })
      });

      const data = await res.json();
      clearInterval(stepInterval);

      if (!res.ok) {
        throw new Error(data.detail || "Failed to extract recipe from the provided URL.");
      }

      setScrapedResult(data);
      setRecipeUrl("");
      refreshUserData();
    } catch (err: any) {
      clearInterval(stepInterval);
      setErrorMessage(err.message || "Could not scrape recipe. Please check the URL and try again.");
    } finally {
      setIsScraping(false);
      setScrapeStep(0);
    }
  };

  const filteredPantry = inventory.filter((item) => {
    if (!pantrySearch.trim()) return true;
    return (
      item.name?.toLowerCase().includes(pantrySearch.toLowerCase()) ||
      item.category?.toLowerCase().includes(pantrySearch.toLowerCase())
    );
  });

  return (
    <div className="app-page flex min-h-screen flex-col pb-28 md:pb-12 selection:bg-[#e9b65c]/30">
      {/* Universal Navbar */}
      <Navbar />

      <main className="page-wrap max-w-7xl flex-1">
        {/* Hero Section */}
        <section className="page-hero text-center">
          <div className="absolute left-1/2 top-1/2 h-[350px] w-[600px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-gradient-to-r from-[#e9b65c]/15 via-[#e77a9b]/10 to-[#7c9ff2]/10 blur-[120px] pointer-events-none" />

          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: easeOut }}
            className="relative z-10"
          >
            <span className="page-eyebrow">
              Kitchen import
            </span>
            <h1 className="page-title">
              Cook from anywhere.
            </h1>
            <p className="page-copy">
              Paste a recipe link. FlavorDex pulls out the ingredients, saves the dish, and adds new finds to your collection.
            </p>
          </motion.div>
        </section>

        {/* Recipe URL Import Card */}
        <section className="mb-12">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1, ease: easeOut }}
            className="surface relative overflow-hidden p-6 backdrop-blur-xl md:p-8"
          >
            {/* Glow accent */}
            <div className="pointer-events-none absolute -right-24 -top-24 h-60 w-60 rounded-full bg-[#e9b65c]/10 blur-3xl" />

            <form onSubmit={handleScrapeRecipe} className="space-y-4">
              <label className="page-eyebrow">
                Recipe link
              </label>

              <div className="flex flex-col sm:flex-row gap-3">
                <div className="relative flex-1">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-gray-500">
                    🔗
                  </div>
                  <input
                    type="url"
                    value={recipeUrl}
                    onChange={(e) => setRecipeUrl(e.target.value)}
                    placeholder="https://www.bbcgoodfood.com/recipes/classic-lasagne..."
                    className="control-input w-full py-4 pl-12 pr-4 text-sm transition-all md:text-base"
                    required
                    disabled={isScraping}
                  />
                </div>

                <motion.button
                  type="submit"
                  disabled={isScraping || !recipeUrl.trim()}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className="brand-button flex items-center justify-center gap-2 rounded-xl px-8 py-4 text-sm transition-all disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {isScraping ? (
                    <span className="flex items-center gap-2">
                      <span className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin" />
                      <span>Reading recipe...</span>
                    </span>
                  ) : (
                    <>
                      <span>⚡</span>
                      <span>Import recipe</span>
                    </>
                  )}
                </motion.button>
              </div>

              {/* Scraping Progress Indicator */}
              {isScraping && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  className="pt-3 pb-1"
                >
                  <div className="mb-2 flex items-center justify-between text-xs font-semibold text-[#e9b65c]">
                    <span>
                      {scrapeStep === 1 && "🌐 Fetching webpage & bypassing anti-bot..."}
                      {scrapeStep === 2 && "🔬 Parsing culinary ingredients & instructions..."}
                      {scrapeStep >= 3 && "📦 Adding unlocked ingredients to your inventory..."}
                    </span>
                    <span>Step {scrapeStep}/3</span>
                  </div>
                  <div className="w-full h-1.5 bg-black/50 rounded-full overflow-hidden">
                    <motion.div
                      className="h-full bg-gradient-to-r from-[#e9b65c] via-[#f0d58c] to-[#e77a9b]"
                      initial={{ width: "20%" }}
                      animate={{ width: scrapeStep === 1 ? "40%" : scrapeStep === 2 ? "75%" : "95%" }}
                      transition={{ duration: 0.4 }}
                    />
                  </div>
                </motion.div>
              )}

              {/* Error Alert */}
              {errorMessage && (
                <motion.p
                  initial={{ opacity: 0, y: -5 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="rounded-xl border border-[#f08aaa]/20 bg-[#f08aaa]/10 p-3 text-xs text-[#f08aaa]"
                >
                  ⚠️ {errorMessage}
                </motion.p>
              )}

              {/* Quick Sample Links */}
              <div className="pt-2">
                <span className="text-[11px] text-gray-500 font-bold uppercase tracking-wider mr-2">
                  Try Sample URLs:
                </span>
                <div className="flex flex-wrap gap-2 mt-2">
                  {SAMPLE_URLS.map((sample, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => setRecipeUrl(sample.url)}
                      className="px-3 py-1.5 rounded-full bg-white/5 hover:bg-white/10 border border-white/10 text-xs text-gray-300 hover:text-white transition-all"
                    >
                      {sample.label}
                    </button>
                  ))}
                </div>
              </div>
            </form>
          </motion.div>
        </section>

        {/* Celebration Unlock Modal */}
        <AnimatePresence>
          {scrapedResult && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4 backdrop-blur-md overflow-y-auto"
              onClick={() => setScrapedResult(null)}
            >
              <motion.div
                initial={{ scale: 0.85, y: 30 }}
                animate={{ scale: 1, y: 0 }}
                exit={{ scale: 0.85, y: 30 }}
                transition={{ duration: 0.3, ease: easeOut }}
                className="surface my-auto flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden border-[#e9b65c]/30"
                onClick={(e) => e.stopPropagation()}
              >
                {/* Header with Cover */}
                <div className="relative h-52 w-full bg-black/60 overflow-hidden flex-shrink-0">
                  {scrapedResult.recipe.image_url ? (
                    <img
                      src={scrapedResult.recipe.image_url}
                      alt={scrapedResult.recipe.title}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-[#e9b65c]/20 to-[#e77a9b]/20 text-7xl">
                      🍲
                    </div>
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-[#151518] via-[#151518]/50 to-transparent" />

                  <button
                    onClick={() => setScrapedResult(null)}
                    className="absolute top-4 right-4 w-9 h-9 rounded-full bg-black/70 hover:bg-black text-white flex items-center justify-center text-sm font-bold border border-white/20 transition-all"
                  >
                    ✕
                  </button>

                  <div className="absolute bottom-4 left-6 right-6">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="px-3 py-1 rounded-full bg-emerald-500 text-black text-xs font-black uppercase tracking-wider shadow-lg animate-bounce">
                        🎉 NEW RECIPE UNLOCKED!
                      </span>
                      <span className="rounded-full border border-[#e9b65c]/40 bg-[#e9b65c]/20 px-2.5 py-1 text-xs font-bold text-[#f0d58c]">
                        +{scrapedResult.xp_gained} XP
                      </span>
                    </div>
                    <h2 className="text-2xl md:text-3xl font-black text-white">{scrapedResult.recipe.title}</h2>
                  </div>
                </div>

                {/* Modal Body */}
                <div className="p-6 overflow-y-auto space-y-6 flex-1">
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-sm font-bold uppercase tracking-widest text-[#e9b65c]">
                        🎁 Ingredients Added to Your Inventory ({scrapedResult.unlocked_ingredients.length})
                      </h3>
                      <span className="text-xs text-emerald-400 font-semibold">Available in Dex</span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-h-60 overflow-y-auto pr-1">
                      {scrapedResult.unlocked_ingredients.map((ing) => (
                        <div
                          key={ing.id}
                          className="flex items-center justify-between rounded-xl border border-[#e9b65c]/30 bg-[#e9b65c]/10 p-3"
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#e9b65c] text-xs font-bold text-[#17140f]">
                              ✓
                            </span>
                            <span className="font-semibold text-sm truncate text-white">{ing.name}</span>
                          </div>
                          <span className="shrink-0 pl-2 text-[11px] font-mono text-[#f0d58c]">
                            {ing.quantity || "1 unit"}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {scrapedResult.recipe.instructions && (
                    <div>
                      <h3 className="mb-2 text-sm font-bold uppercase tracking-widest text-[#b6a0f2]">
                        Scraped Instructions
                      </h3>
                      <p className="max-h-36 overflow-y-auto whitespace-pre-line rounded-xl border border-white/10 bg-[#0d131a] p-4 text-xs leading-relaxed text-[#c8ced7]">
                        {scrapedResult.recipe.instructions}
                      </p>
                    </div>
                  )}
                </div>

                {/* Modal Actions */}
                <div className="flex items-center justify-between gap-4 border-t border-white/10 bg-[#0d131a]/90 p-4 px-6">
                  <Link
                    href="/collection"
                    onClick={() => setScrapedResult(null)}
                    className="px-5 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-white font-bold text-xs uppercase tracking-wider border border-white/10 transition-all"
                  >
                    View in The Dex →
                  </Link>

                  <button
                    onClick={() => setScrapedResult(null)}
                    className="brand-button rounded-xl px-6 py-2.5 text-xs font-extrabold uppercase tracking-wider shadow-lg transition-opacity hover:opacity-95"
                  >
                    Awesome! Continue
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* View Switcher Tabs */}
        <section className="mb-8">
          <div className="tab-strip mx-auto flex max-w-md p-1.5">
            <button
              onClick={() => setActiveTab("import")}
              className={`flex-1 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all ${
                activeTab === "import"
                  ? "brand-button shadow-lg"
                  : "text-gray-400 hover:text-white"
              }`}
            >
              ⚡ Recipe Importer
            </button>
            <button
              onClick={() => setActiveTab("recipes")}
              className={`flex-1 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all ${
                activeTab === "recipes"
                  ? "brand-button shadow-lg"
                  : "text-gray-400 hover:text-white"
              }`}
            >
              Discovered ({discoveredRecipes.length})
            </button>
            <button
              onClick={() => setActiveTab("pantry")}
              className={`flex-1 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all ${
                activeTab === "pantry"
                  ? "brand-button shadow-lg"
                  : "text-gray-400 hover:text-white"
              }`}
            >
              Pantry ({inventory.length})
            </button>
          </div>
        </section>

        {/* Tab 1: How It Works & Guide */}
        {activeTab === "import" && (
          <section className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="surface-soft p-6">
              <div className="text-3xl mb-3">1️⃣</div>
              <h3 className="font-bold text-white mb-2">Find Any Recipe Online</h3>
              <p className="text-xs text-gray-400 leading-relaxed">
                Browse any food blog, cooking website, or recipe portal on the internet. Copy the URL from your browser address bar.
              </p>
            </div>

            <div className="surface-soft p-6">
              <div className="text-3xl mb-3">2️⃣</div>
              <h3 className="font-bold text-white mb-2">Paste & Synthesize</h3>
              <p className="text-xs text-gray-400 leading-relaxed">
                Paste the URL into the Kitchen box above. Our culinary AI scraper extracts the ingredients, portions, steps, and cuisine.
              </p>
            </div>

            <div className="surface-soft p-6">
              <div className="text-3xl mb-3">3️⃣</div>
              <h3 className="font-bold text-white mb-2">Unlock Ingredients & XP</h3>
              <p className="text-xs text-gray-400 leading-relaxed">
                Every single ingredient in the recipe is instantly added to your account&apos;s inventory and unlocked in your collection book!
              </p>
            </div>
          </section>
        )}

        {/* Tab 2: Discovered Recipes by User */}
        {activeTab === "recipes" && (
          <section className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-white">Recipes Discovered by You</h2>
              <span className="text-xs text-gray-500">{discoveredRecipes.length} total recipes</span>
            </div>

            {discoveredRecipes.length === 0 ? (
              <div className="surface-soft p-8 py-16 text-center">
                <div className="text-4xl mb-3">🍲</div>
                <h3 className="font-bold text-white mb-1">No recipes discovered yet</h3>
                <p className="text-xs text-gray-400 mb-4">
                  Paste any recipe URL in the Importer above to discover your first recipe!
                </p>
                <button
                  onClick={() => setActiveTab("import")}
                  className="rounded-full border border-[#e9b65c]/30 bg-[#e9b65c]/20 px-5 py-2 text-xs font-bold uppercase tracking-wider text-[#f0d58c]"
                >
                  Import a Recipe Now
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {discoveredRecipes.map((rec) => (
                  <div
                    key={rec.id}
                    className="surface flex flex-col overflow-hidden transition-all hover:border-[#e9b65c]/40"
                  >
                    <div className="h-40 bg-black/50 relative overflow-hidden">
                      {rec.image_url ? (
                        <img src={rec.image_url} alt={rec.title} className="w-full h-full object-cover" />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center bg-[#e9b65c]/10 text-4xl">
                          🍲
                        </div>
                      )}
                      <div className="absolute left-3 top-3 rounded-full border border-white/10 bg-[#0d131a]/80 px-2 py-0.5 text-[10px] font-bold text-[#f0d58c]">
                        ★ {rec.difficulty}/5 Difficulty
                      </div>
                    </div>
                    <div className="p-4 flex-1 flex flex-col">
                      <h3 className="font-bold text-white mb-2 line-clamp-1">{rec.title}</h3>
                      <p className="text-xs text-gray-400 mb-4">
                        {rec.ingredients?.length || 0} Ingredients Unlocked
                      </p>
                      <div className="mt-auto pt-3 border-t border-white/5 flex items-center justify-between text-xs">
                        <Link href="/recipes" className="font-semibold text-[#e9b65c] hover:underline">
                          View in Discovery →
                        </Link>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

        {/* Tab 3: Your Pantry / Unlocked Ingredients */}
        {activeTab === "pantry" && (
          <section className="space-y-6">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="relative w-full sm:w-80">
                <input
                  type="text"
                  value={pantrySearch}
                  onChange={(e) => setPantrySearch(e.target.value)}
                  placeholder="Search your unlocked pantry..."
                  className="control-input w-full px-4 py-2.5 text-xs"
                />
              </div>
              <span className="text-xs text-gray-400">{filteredPantry.length} ingredients in inventory</span>
            </div>

            {filteredPantry.length === 0 ? (
              <div className="surface-soft p-8 py-16 text-center">
                <div className="text-4xl mb-3">📦</div>
                <h3 className="font-bold text-white mb-1">Your pantry is empty</h3>
                <p className="text-xs text-gray-400 mb-4">
                  Open Daily Booster packs on your Dashboard or scrape web recipes to fill your pantry!
                </p>
                <Link
                  href="/dashboard"
                  className="brand-button inline-block rounded-full px-5 py-2 text-xs font-bold uppercase tracking-wider"
                >
                  Open Booster Pack
                </Link>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
                {filteredPantry.map((item) => (
                  <div
                    key={item.id}
                    className="surface-soft group flex flex-col items-center p-4 text-center shadow-md transition-all hover:border-[#e9b65c]/30"
                  >
                    <div className="mb-2 flex h-12 w-12 items-center justify-center rounded-xl border border-[#e9b65c]/20 bg-[#e9b65c]/10 text-2xl transition-transform group-hover:scale-110">
                      {item.category === "Meat" && "🥩"}
                      {item.category === "Seafood" && "🦐"}
                      {item.category === "Vegetable" && "🥦"}
                      {item.category === "Fruit" && "🍎"}
                      {item.category === "Herb" && "🌿"}
                      {item.category === "Spice" && "🧂"}
                      {item.category === "Dairy" && "🧀"}
                      {item.category === "Condiment" && "🧈"}
                      {item.category === "Pantry" && "🌾"}
                      {!["Meat", "Seafood", "Vegetable", "Fruit", "Herb", "Spice", "Dairy", "Condiment", "Pantry"].includes(item.category) && "🍳"}
                    </div>
                    <h4 className="font-bold text-xs text-white truncate w-full mb-1">{item.name}</h4>
                    <span className="text-[10px] text-gray-500 uppercase">{item.category}</span>
                    <span className="mt-2 rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] font-mono font-bold text-[#f0d58c]">
                      x{item.quantity || 1} Owned
                    </span>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}
      </main>
    </div>
  );
}
