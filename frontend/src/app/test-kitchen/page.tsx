"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "../../contexts/AuthContext";
import Navbar from "../../components/Navbar";
import { apiUrl } from "../../lib/api";

const easeOut = [0.25, 0.1, 0.25, 1] as const;

interface Anomaly {
  id: number;
  name: string;
  sourceUrl: string;
  status: string;
  votes: number;
  submitter: string;
  created_at: string;
}

interface LabStats {
  pending_count: number;
  approved_count: number;
  total_count: number;
  total_ingredients: number;
  lab_status: string;
}

interface PairingResult {
  ingredients: string[];
  synergy_score: number;
  verdict: string;
  dominant_profiles: string[];
  chemistry_analysis: string;
  recommended_technique: string;
}

export default function TestKitchenPage() {
  const { user, logout } = useAuth() || {
    user: { username: "Chef", email: "chef@example.com", xp: 0, rank: "Novice" },
    logout: () => {}
  };

  const [activeTab, setActiveTab] = useState<"anomalies" | "graduated" | "sandbox" | "submit">("anomalies");
  const [anomalies, setAnomalies] = useState<Anomaly[]>([]);
  const [graduatedAnomalies, setGraduatedAnomalies] = useState<Anomaly[]>([]);
  const [labStats, setLabStats] = useState<LabStats>({
    pending_count: 0,
    approved_count: 0,
    total_count: 0,
    total_ingredients: 0,
    lab_status: "ONLINE"
  });
  const [loadingAnomalies, setLoadingAnomalies] = useState(true);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Submit Anomaly Form
  const [submitName, setSubmitName] = useState("");
  const [submitUrl, setSubmitUrl] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Flavor Pairing Sandbox State
  const [allDbIngredients, setAllDbIngredients] = useState<any[]>([]);
  const [userInventory, setUserInventory] = useState<any[]>([]);
  const [sandboxFilter, setSandboxFilter] = useState<"all" | "inventory">("all");
  const [sandboxSearch, setSandboxSearch] = useState("");
  const [selectedIngredients, setSelectedIngredients] = useState<string[]>([]);
  const [customInput, setCustomInput] = useState("");
  const [pairingLoading, setPairingLoading] = useState(false);
  const [pairingResult, setPairingResult] = useState<PairingResult | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const fetchLabData = () => {
    setLoadingAnomalies(true);
    const token = localStorage.getItem("flavordex_token");
    const headers: Record<string, string> = {};
    if (token) headers["Authorization"] = `Bearer ${token}`;

    Promise.all([
      fetch(apiUrl("/anomalies")).then((res) => res.json()),
      fetch(apiUrl("/anomalies/graduated")).then((res) => res.json()),
      fetch(apiUrl("/anomalies/stats")).then((res) => res.json()),
      fetch(apiUrl("/ingredients"), { headers }).then((res) => res.json()),
      token
        ? fetch(apiUrl("/users/me/inventory"), { headers }).then((res) => res.json())
        : Promise.resolve([])
    ])
      .then(([anoms, graduated, stats, ings, inv]) => {
        if (Array.isArray(anoms)) setAnomalies(anoms);
        if (Array.isArray(graduated)) setGraduatedAnomalies(graduated);
        if (stats && !stats.detail) setLabStats(stats);
        if (Array.isArray(ings)) setAllDbIngredients(ings);
        if (Array.isArray(inv)) setUserInventory(inv);
      })
      .catch(console.error)
      .finally(() => setLoadingAnomalies(false));
  };

  useEffect(() => {
    fetchLabData();
  }, []);

  // Filtered sandbox palette from live DB
  const availableSandboxIngredients = useMemo(() => {
    const sourceList =
      sandboxFilter === "inventory"
        ? userInventory.map((i: any) => i.name)
        : allDbIngredients.map((i: any) => i.name);

    if (!sandboxSearch.trim()) return sourceList.slice(0, 100);
    const searchLower = sandboxSearch.toLowerCase().trim();
    return sourceList.filter((name: string) => name && name.toLowerCase().includes(searchLower)).slice(0, 100);
  }, [allDbIngredients, userInventory, sandboxFilter, sandboxSearch]);

  // Vote on anomaly
  const handleVote = async (id: number, action: "sanction" | "reject") => {
    const token = localStorage.getItem("flavordex_token");
    if (!token) {
      showToast("Please sign in to vote and earn research XP!");
      return;
    }

    try {
      const res = await fetch(apiUrl(`/anomalies/${id}/${action}`), {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      const data = await res.json();
      if (res.ok) {
        showToast(data.message || "Vote recorded!");
        fetchLabData();
      }
    } catch (err) {
      console.error(err);
      showToast("Could not record vote. Please try again.");
    }
  };

  // Submit new shadow card
  const handleSubmitAnomaly = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!submitName.trim()) return;

    const token = localStorage.getItem("flavordex_token");
    if (!token) {
      showToast("Please sign in to submit shadow cards!");
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch(apiUrl("/anomalies/submit"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          name: submitName.trim(),
          source_url: submitUrl.trim() || undefined
        })
      });
      const data = await res.json();
      if (res.ok) {
        showToast(data.message || "Shadow card submitted for review! +50 XP");
        setSubmitName("");
        setSubmitUrl("");
        setActiveTab("anomalies");
        fetchLabData();
      } else {
        showToast(data.detail || "Submission failed.");
      }
    } catch (err) {
      console.error(err);
      showToast("Submission failed.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Flavor Pairing calculation
  const handleRunPairing = async () => {
    if (selectedIngredients.length < 2) {
      showToast("Select at least 2 ingredients to analyze flavor synergy!");
      return;
    }

    setPairingLoading(true);
    try {
      const res = await fetch(apiUrl("/lab/pairing"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ingredients: selectedIngredients })
      });
      const data = await res.json();
      if (res.ok) {
        setPairingResult(data);
      } else {
        showToast(data.detail || "Pairing calculation failed.");
      }
    } catch (err) {
      console.error(err);
    } finally {
      setPairingLoading(false);
    }
  };

  const toggleIngredient = (name: string) => {
    if (selectedIngredients.includes(name)) {
      setSelectedIngredients((prev) => prev.filter((i) => i !== name));
    } else if (selectedIngredients.length < 4) {
      setSelectedIngredients((prev) => [...prev, name]);
    } else {
      showToast("Maximum 4 ingredients allowed for sandbox pairing!");
    }
  };

  const handleAddCustomIngredient = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customInput.trim()) return;
    const item = customInput.trim();
    if (!selectedIngredients.includes(item)) {
      if (selectedIngredients.length < 4) {
        setSelectedIngredients((prev) => [...prev, item]);
      } else {
        showToast("Maximum 4 ingredients allowed for sandbox pairing!");
      }
    }
    setCustomInput("");
  };

  return (
    <div className="app-page flex min-h-screen flex-col pb-28 md:pb-12 selection:bg-[#7c9ff2]/30">
      {/* Universal Navbar */}
      <Navbar />

      {/* Toast Notification */}
      <AnimatePresence>
        {toastMessage && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="surface fixed left-1/2 top-20 z-50 -translate-x-1/2 rounded-full px-6 py-3 text-xs font-semibold text-[#d9e2f5] shadow-2xl backdrop-blur-md md:text-sm"
          >
            {toastMessage}
          </motion.div>
        )}
      </AnimatePresence>

      <main className="page-wrap max-w-7xl flex-1">
        {/* Hero Section */}
        <section className="page-hero text-center">
          <div className="absolute left-1/2 top-1/2 h-[300px] w-[600px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-gradient-to-r from-[#7c9ff2]/15 via-[#e77a9b]/10 to-[#e9b65c]/10 blur-[120px] pointer-events-none" />

          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: easeOut }}
            className="relative z-10"
          >
            <span className="page-eyebrow">
              Community lab
            </span>
            <h1 className="page-title">
              Help shape the Dex.
            </h1>
            <p className="page-copy">
              Review uncertain ingredients, test flavor pairings, and help good discoveries graduate into the official collection.
            </p>
          </motion.div>
        </section>

        {/* Live Database Lab Stats Row */}
        <section className="mb-8 grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="surface-soft flex flex-col items-center justify-center p-4 text-center">
            <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider mb-1">Queue Size</span>
            <span className="font-mono text-2xl font-black text-[#7c9ff2]">{labStats.pending_count}</span>
            <span className="text-[10px] text-gray-500">Pending Anomalies</span>
          </div>

          <div className="surface-soft flex flex-col items-center justify-center p-4 text-center">
            <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider mb-1">Graduated</span>
            <span className="font-mono text-2xl font-black text-[#84c9a4]">{labStats.approved_count}</span>
            <span className="text-[10px] text-gray-500">Sanctioned to Dex</span>
          </div>

          <div className="surface-soft flex flex-col items-center justify-center p-4 text-center">
            <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider mb-1">Total Cataloged</span>
            <span className="font-mono text-2xl font-black text-[#b6a0f2]">{labStats.total_ingredients}</span>
            <span className="text-[10px] text-gray-500">Dex Ingredients</span>
          </div>

          <div className="surface-soft flex flex-col items-center justify-center p-4 text-center">
            <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider mb-1">Node Status</span>
            <span className="text-xs font-black text-teal-300 font-mono tracking-wider">ACTIVE</span>
            <span className="mt-0.5 flex items-center gap-1 text-[10px] text-[#84c9a4]">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#84c9a4]" />
              Live DB Synced
            </span>
          </div>
        </section>

        {/* Tab Navigation */}
        <section className="mb-8">
          <div className="tab-strip mx-auto flex max-w-3xl flex-wrap gap-1 p-1.5">
            <button
              onClick={() => setActiveTab("anomalies")}
              className={`flex-1 min-w-[140px] py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 ${
                activeTab === "anomalies"
                  ? "bg-[#e9b65c] text-[#17140f]"
                  : "text-[#8f98a6] hover:text-white"
              }`}
            >
              <span>🔬</span>
              <span>Shadow Queue ({anomalies.length})</span>
            </button>
            <button
              onClick={() => setActiveTab("graduated")}
              className={`flex-1 min-w-[140px] py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 ${
                activeTab === "graduated"
                  ? "bg-[#e77a9b] text-[#230f19]"
                  : "text-gray-400 hover:text-white"
              }`}
            >
              <span>🎉</span>
              <span>Graduated ({graduatedAnomalies.length})</span>
            </button>
            <button
              onClick={() => setActiveTab("sandbox")}
              className={`flex-1 min-w-[140px] py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 ${
                activeTab === "sandbox"
                  ? "bg-[#e77a9b] text-[#230f19]"
                  : "text-gray-400 hover:text-white"
              }`}
            >
              <span>🧪</span>
              <span>Flavor Matrix</span>
            </button>
            <button
              onClick={() => setActiveTab("submit")}
              className={`flex-1 min-w-[140px] py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 ${
                activeTab === "submit"
                  ? "bg-[#e77a9b] text-[#230f19]"
                  : "text-gray-400 hover:text-white"
              }`}
            >
              <span>📡</span>
              <span>Submit Card</span>
            </button>
          </div>
        </section>

        {/* TAB 1: Shadow Cards / Anomalies Peer Review */}
        {activeTab === "anomalies" && (
          <section className="space-y-6">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 border-b border-white/5 pb-4">
              <div>
                <h2 className="text-lg font-bold text-white flex items-center gap-2">
                  <span>Pending Anomaly Verification Queue</span>
                  <span className="rounded-full border border-[#7c9ff2]/30 bg-[#7c9ff2]/10 px-2.5 py-0.5 text-xs text-[#a9bdf0]">
                    +25 XP per vote
                  </span>
                </h2>
                <p className="text-xs text-gray-400 mt-1">
                  Vote to Sanction valid ingredients. Reaching 3 consensus votes graduates the card into the official Dex!
                </p>
              </div>
              <button
                onClick={fetchLabData}
                className="flex items-center gap-1 text-xs font-bold uppercase tracking-wider text-[#7c9ff2] hover:text-white"
              >
                <span>🔄</span> Refresh Queue
              </button>
            </div>

            {loadingAnomalies ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="surface-soft h-44 animate-pulse" />
                ))}
              </div>
            ) : anomalies.length === 0 ? (
              <div className="surface-soft mx-auto max-w-xl p-8 py-20 text-center">
                <div className="text-5xl mb-4">✨</div>
                <h3 className="text-xl font-bold text-white mb-2">No Shadow Cards in Queue</h3>
                <p className="text-xs text-gray-400 mb-6">
                  All culinary anomalies have been peer-reviewed and graduated to the Dex! Submit new exotic ingredients or scrape web recipes in the Kitchen to discover more.
                </p>
                <button
                  onClick={() => setActiveTab("submit")}
                  className="brand-button rounded-full px-6 py-2.5 text-xs font-bold uppercase tracking-wider shadow-lg"
                >
                  Submit a Shadow Card
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <AnimatePresence>
                  {anomalies.map((item) => (
                    <motion.div
                      key={item.id}
                      layout
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.9 }}
                      transition={{ duration: 0.25, ease: easeOut }}
                      className="surface-soft group relative flex flex-col justify-between overflow-hidden p-5 shadow-xl backdrop-blur-md hover:border-[#7c9ff2]/40"
                    >
                      {/* Top metadata */}
                      <div className="flex items-start justify-between gap-4 mb-3">
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <span className="rounded-full border border-[#7c9ff2]/30 bg-[#7c9ff2]/10 px-2 py-0.5 text-[10px] font-mono font-bold uppercase text-[#a9bdf0]">
                              ID #{item.id}
                            </span>
                            <span className="text-[11px] text-gray-500">
                              Harvested by <strong className="text-gray-300">@{item.submitter}</strong>
                            </span>
                          </div>
                          <h3 className="text-lg font-bold text-white transition-colors group-hover:text-[#a9bdf0]">
                            {item.name}
                          </h3>
                        </div>

                        {/* Votes Indicator */}
                        <div className="flex flex-col items-end">
                          <span className="font-mono text-xs font-bold text-[#7c9ff2]">
                            {item.votes}/3 Votes
                          </span>
                          <div className="w-16 h-1.5 bg-black/60 rounded-full mt-1 overflow-hidden">
                            <div
                              className="h-full bg-gradient-to-r from-[#7c9ff2] to-[#84c9a4]"
                              style={{ width: `${Math.min((item.votes / 3) * 100, 100)}%` }}
                            />
                          </div>
                        </div>
                      </div>

                      {/* Source URL Preview */}
                      <div className="surface-soft mb-4 flex items-center justify-between p-2.5 text-[11px] text-[#8f98a6]">
                        <span className="truncate flex-1 mr-2">🔗 {item.sourceUrl}</span>
                        <span className="text-[10px] text-gray-600 shrink-0 font-mono">
                          {item.created_at}
                        </span>
                      </div>

                      {/* Peer Review Action Buttons */}
                      <div className="flex items-center gap-3 pt-2 border-t border-white/5">
                        <button
                          onClick={() => handleVote(item.id, "reject")}
                          className="flex-1 rounded-xl border border-[#f08aaa]/30 bg-[#f08aaa]/10 py-2.5 text-xs font-bold uppercase tracking-wider text-[#f08aaa] transition-all hover:bg-[#f08aaa]/20"
                        >
                          ✕ Reject / Flag
                        </button>
                        <button
                          onClick={() => handleVote(item.id, "sanction")}
                          className="brand-button flex-1 rounded-xl py-2.5 text-xs font-extrabold uppercase tracking-wider shadow-lg transition-all"
                        >
                          ✓ Sanction Card
                        </button>
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            )}
          </section>
        )}

        {/* TAB 2: Graduated Shadow Cards Archive */}
        {activeTab === "graduated" && (
          <section className="space-y-6">
            <div className="flex items-center justify-between border-b border-white/5 pb-4">
              <div>
                <h2 className="text-lg font-bold text-white flex items-center gap-2">
                  <span>Graduated Dex Ingredients</span>
                  <span className="rounded-full border border-[#84c9a4]/30 bg-[#84c9a4]/10 px-2.5 py-0.5 text-xs text-[#84c9a4]">
                    Verified by Community Consensus
                  </span>
                </h2>
                <p className="text-xs text-gray-400 mt-1">
                  Exotic ingredients and shadow cards that successfully passed peer review and have been minted into the Dex.
                </p>
              </div>
            </div>

            {graduatedAnomalies.length === 0 ? (
              <div className="surface-soft mx-auto max-w-lg p-8 py-16 text-center">
                <div className="text-4xl mb-3">🎓</div>
                <h3 className="font-bold text-white mb-1">No graduated anomalies yet</h3>
                <p className="text-xs text-gray-400 mb-4">
                  Head over to the Shadow Queue tab and cast votes to graduate unverified cards!
                </p>
                <button
                  onClick={() => setActiveTab("anomalies")}
                  className="rounded-full border border-[#7c9ff2]/30 bg-[#7c9ff2]/20 px-5 py-2 text-xs font-bold uppercase tracking-wider text-[#a9bdf0]"
                >
                  Review Shadow Queue
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {graduatedAnomalies.map((item) => (
                  <div
                    key={item.id}
                    className="surface-soft flex flex-col justify-between p-5 shadow-lg"
                  >
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="rounded-full bg-[#84c9a4]/10 px-2 py-0.5 text-[10px] font-bold uppercase text-[#84c9a4]">
                          ✓ Sanctioned
                        </span>
                        <span className="text-[10px] text-gray-500 font-mono">{item.created_at}</span>
                      </div>
                      <h3 className="font-bold text-white text-base mb-1">{item.name}</h3>
                      <p className="text-[11px] text-gray-400 truncate">Source: {item.sourceUrl}</p>
                    </div>

                    <div className="mt-4 pt-3 border-t border-white/5 flex items-center justify-between text-xs">
                      <span className="text-gray-500">Submitter: @{item.submitter}</span>
                      <Link href="/collection" className="font-semibold text-[#7c9ff2] hover:underline">
                        View in Dex →
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

        {/* TAB 3: Flavor Matrix Sandbox */}
        {activeTab === "sandbox" && (
          <section className="space-y-6">
            <div className="surface p-6 shadow-2xl backdrop-blur-xl md:p-8">
              <div className="max-w-2xl mb-6">
                <span className="text-xs font-bold uppercase tracking-widest text-[#7c9ff2]">
                  🧪 Molecular Flavor Chemistry
                </span>
                <h2 className="text-2xl font-bold text-white mt-1">Flavor Synergy Sandbox</h2>
                <p className="text-xs text-gray-400 mt-1">
                  Select 2 to 4 ingredients from your live Dex catalog to simulate their volatile aromatic synergy score and culinary chemical compatibility.
                </p>
              </div>

              {/* Selected Ingredients Rack */}
              <div className="mb-6">
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-bold uppercase tracking-wider text-gray-400">
                    Active Sandbox Palette ({selectedIngredients.length}/4)
                  </label>
                  {selectedIngredients.length > 0 && (
                    <button
                      onClick={() => setSelectedIngredients([])}
                      className="text-[11px] font-bold uppercase text-[#f08aaa] hover:underline"
                    >
                      Clear Palette
                    </button>
                  )}
                </div>
                <div className="control-input flex min-h-[56px] flex-wrap items-center gap-2 p-3">
                  {selectedIngredients.length === 0 ? (
                    <span className="text-xs text-gray-500 italic pl-2">
                      Click ingredients from the database palette below or type custom ingredients...
                    </span>
                  ) : (
                    selectedIngredients.map((item) => (
                      <span
                        key={item}
                        className="flex items-center gap-2 rounded-full border border-[#7c9ff2]/40 bg-[#7c9ff2]/20 px-3.5 py-1.5 text-xs font-bold text-[#d9e2f5] shadow-sm"
                      >
                        <span>{item}</span>
                        <button
                          onClick={() => toggleIngredient(item)}
                          className="font-bold text-[#7c9ff2] hover:text-white"
                        >
                          ✕
                        </button>
                      </span>
                    ))
                  )}
                </div>
              </div>

              {/* Palette Controls & Search */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 mb-4">
                <div className="tab-strip flex p-1 text-xs font-bold">
                  <button
                    onClick={() => setSandboxFilter("all")}
                    className={`px-3 py-1.5 rounded-lg transition-all ${
                      sandboxFilter === "all"
                        ? "bg-[#e77a9b] text-[#230f19] shadow"
                        : "text-gray-400 hover:text-white"
                    }`}
                  >
                    All Dex Ingredients ({allDbIngredients.length})
                  </button>
                  <button
                    onClick={() => setSandboxFilter("inventory")}
                    className={`px-3 py-1.5 rounded-lg transition-all ${
                      sandboxFilter === "inventory"
                        ? "bg-[#e77a9b] text-[#230f19] shadow"
                        : "text-gray-400 hover:text-white"
                    }`}
                  >
                    My Dex Inventory ({userInventory.length})
                  </button>
                </div>

                <div className="relative flex-1 max-w-xs">
                  <input
                    type="text"
                    value={sandboxSearch}
                    onChange={(e) => setSandboxSearch(e.target.value)}
                    placeholder="Search ingredients in DB..."
                    className="control-input w-full px-3 py-1.5 text-xs"
                  />
                </div>
              </div>

              {/* Custom Ingredient Input Form */}
              <form onSubmit={handleAddCustomIngredient} className="flex gap-2 mb-6 max-w-md">
                <input
                  type="text"
                  value={customInput}
                  onChange={(e) => setCustomInput(e.target.value)}
                  placeholder="Or type a custom ingredient (e.g. Saffron, Koji)..."
                  className="control-input flex-1 px-4 py-2 text-xs"
                />
                <button
                  type="submit"
                  className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-xs font-bold uppercase tracking-wider text-[#a9bdf0] transition-all hover:bg-white/10"
                >
                  + Add
                </button>
              </form>

              {/* Live Ingredients Palette from DB */}
              <div className="mb-8">
                <label className="block text-[11px] font-bold uppercase tracking-wider text-gray-500 mb-2">
                  Select from Live Database:
                </label>
                <div className="flex flex-wrap gap-2 max-h-48 overflow-y-auto pr-1">
                  {availableSandboxIngredients.map((name) => {
                    const isSelected = selectedIngredients.includes(name);
                    return (
                      <button
                        key={name}
                        onClick={() => toggleIngredient(name)}
                        className={`px-3 py-1.5 rounded-xl text-xs font-medium border transition-all ${
                          isSelected
                            ? "border-[#e77a9b] bg-[#e77a9b] font-bold text-[#230f19] shadow"
                            : "border-white/5 bg-white/5 text-gray-300 hover:border-[#7c9ff2]/30 hover:text-white"
                        }`}
                      >
                        {isSelected ? "✓ " : "+ "}
                        {name}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Action Button */}
              <motion.button
                onClick={handleRunPairing}
                disabled={pairingLoading || selectedIngredients.length < 2}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className="brand-button flex w-full items-center justify-center gap-2 rounded-2xl px-8 py-3.5 text-xs font-extrabold uppercase tracking-widest shadow-lg transition-all disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
              >
                {pairingLoading ? (
                  <>
                    <span className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin" />
                    <span>Analyzing Chemistry Matrix...</span>
                  </>
                ) : (
                  <>
                    <span>⚡</span>
                    <span>Analyze Synergy Score</span>
                  </>
                )}
              </motion.button>
            </div>

            {/* Synergy Results Showcase Card */}
            {pairingResult && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, ease: easeOut }}
                className="surface border-2 border-[#7c9ff2]/30 p-6 shadow-2xl md:p-8"
              >
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-white/5 pb-4">
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-widest text-[#7c9ff2]">
                      Analysis Report
                    </span>
                    <h3 className="text-2xl font-black text-white">{pairingResult.verdict}</h3>
                  </div>

                  <div className="surface-soft flex items-center gap-3 px-5 py-3">
                    <span className="bg-gradient-to-r from-[#7c9ff2] to-[#84c9a4] bg-clip-text text-3xl font-black text-transparent">
                      {pairingResult.synergy_score}%
                    </span>
                    <span className="text-[10px] text-gray-400 uppercase font-bold leading-tight">
                      Synergy
                      <br />
                      Rating
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="surface-soft p-4">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-gray-500 block mb-1">
                      Dominant Flavor Profiles
                    </span>
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {pairingResult.dominant_profiles.map((prof) => (
                        <span
                          key={prof}
                          className="rounded-full border border-[#7c9ff2]/30 bg-[#7c9ff2]/10 px-2.5 py-1 text-xs font-bold text-[#a9bdf0]"
                        >
                          {prof}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="surface-soft p-4 md:col-span-2">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-gray-500 block mb-1">
                      Optimal Culinary Technique
                    </span>
                    <p className="mt-1 text-sm font-bold text-[#84c9a4]">
                      🔥 {pairingResult.recommended_technique}
                    </p>
                    <p className="text-xs text-gray-400 mt-1">
                      Enhances volatile aroma compounds and minimizes flavor friction.
                    </p>
                  </div>
                </div>

                <div className="surface p-5">
                  <span className="mb-2 block text-[10px] font-bold uppercase tracking-wider text-[#7c9ff2]">
                    🔬 Molecular Chemistry & Flavor Notes
                  </span>
                  <p className="text-xs text-gray-300 leading-relaxed font-mono">
                    {pairingResult.chemistry_analysis}
                  </p>
                </div>
              </motion.div>
            )}
          </section>
        )}

        {/* TAB 4: Submit New Shadow Card */}
        {activeTab === "submit" && (
          <section className="max-w-2xl mx-auto">
            <motion.div
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              className="surface p-6 shadow-2xl backdrop-blur-xl md:p-8"
            >
              <span className="text-xs font-bold uppercase tracking-widest text-[#7c9ff2]">
                📡 Community Bounty Program
              </span>
              <h2 className="text-2xl font-bold text-white mt-1 mb-2">Submit a Shadow Card</h2>
              <p className="text-xs text-gray-400 mb-6">
                Found an obscure or uncatalogued ingredient in a regional cookbook or niche web recipe? Submit it for peer review and earn <strong className="text-[#a9bdf0]">50 XP if it is approved</strong>.
              </p>

              <form onSubmit={handleSubmitAnomaly} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-gray-300 mb-2">
                    Ingredient Name <span className="text-[#7c9ff2]">*</span>
                  </label>
                  <input
                    type="text"
                    value={submitName}
                    onChange={(e) => setSubmitName(e.target.value)}
                    placeholder="e.g. Fermented Black Garlic Honey, Yuzu Kosho..."
                    className="control-input w-full px-4 py-3 text-sm"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-gray-300 mb-2">
                    Source Link or Recipe Reference URL (Optional)
                  </label>
                  <input
                    type="url"
                    value={submitUrl}
                    onChange={(e) => setSubmitUrl(e.target.value)}
                    placeholder="https://example.com/exotic-recipe-source..."
                    className="control-input w-full px-4 py-3 text-sm"
                  />
                </div>

                <motion.button
                  type="submit"
                  disabled={isSubmitting || !submitName.trim()}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className="brand-button w-full rounded-xl py-3.5 text-xs font-extrabold uppercase tracking-widest shadow-lg transition-all disabled:opacity-50"
                >
                  {isSubmitting ? "Submitting for review..." : "Submit for review"}
                </motion.button>
              </form>
            </motion.div>
          </section>
        )}
      </main>
    </div>
  );
}
