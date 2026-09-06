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
    <div className="min-h-screen bg-[#090a0f] text-white flex flex-col font-sans pb-28 md:pb-12 selection:bg-cyan-500/30">
      {/* Universal Navbar */}
      <Navbar />

      {/* Toast Notification */}
      <AnimatePresence>
        {toastMessage && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="fixed top-20 left-1/2 -translate-x-1/2 z-50 px-6 py-3 rounded-full bg-[#101b2b] border border-cyan-500/40 text-cyan-200 text-xs md:text-sm font-semibold shadow-2xl backdrop-blur-md"
          >
            {toastMessage}
          </motion.div>
        )}
      </AnimatePresence>

      <main className="max-w-6xl mx-auto px-6 py-8 flex-1 w-full">
        {/* Hero Section */}
        <section className="mb-8 text-center relative">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[300px] bg-gradient-to-r from-cyan-600/15 via-teal-600/15 to-blue-600/10 rounded-full blur-[120px] pointer-events-none" />

          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: easeOut }}
            className="relative z-10"
          >
            <span className="inline-block px-3 py-1 mb-3 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 text-xs font-bold uppercase tracking-widest">
              🔬 Culinary R&D Lab & Shadow Cards
            </span>
            <h1 className="text-4xl md:text-5xl font-black tracking-tight mb-3 font-display">
              Test <span className="bg-clip-text text-transparent bg-gradient-to-r from-cyan-400 via-teal-300 to-emerald-400">Kitchen</span>
            </h1>
            <p className="text-gray-400 text-sm md:text-base max-w-2xl mx-auto">
              Peer-review unidentified shadow ingredients scraped from the web, vote to graduate cards into the official Dex, and analyze molecular flavor pairings in the experimental sandbox.
            </p>
          </motion.div>
        </section>

        {/* Live Database Lab Stats Row */}
        <section className="mb-8 grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="bg-[#11141f]/70 border border-cyan-500/10 rounded-2xl p-4 flex flex-col items-center justify-center text-center">
            <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider mb-1">Queue Size</span>
            <span className="text-2xl font-black text-cyan-400 font-mono">{labStats.pending_count}</span>
            <span className="text-[10px] text-gray-500">Pending Anomalies</span>
          </div>

          <div className="bg-[#11141f]/70 border border-cyan-500/10 rounded-2xl p-4 flex flex-col items-center justify-center text-center">
            <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider mb-1">Graduated</span>
            <span className="text-2xl font-black text-emerald-400 font-mono">{labStats.approved_count}</span>
            <span className="text-[10px] text-gray-500">Sanctioned to Dex</span>
          </div>

          <div className="bg-[#11141f]/70 border border-cyan-500/10 rounded-2xl p-4 flex flex-col items-center justify-center text-center">
            <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider mb-1">Total Cataloged</span>
            <span className="text-2xl font-black text-purple-400 font-mono">{labStats.total_ingredients}</span>
            <span className="text-[10px] text-gray-500">Dex Ingredients</span>
          </div>

          <div className="bg-[#11141f]/70 border border-cyan-500/10 rounded-2xl p-4 flex flex-col items-center justify-center text-center">
            <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider mb-1">Node Status</span>
            <span className="text-xs font-black text-teal-300 font-mono tracking-wider">ACTIVE</span>
            <span className="text-[10px] text-emerald-400 flex items-center gap-1 mt-0.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              Live DB Synced
            </span>
          </div>
        </section>

        {/* Tab Navigation */}
        <section className="mb-8">
          <div className="flex flex-wrap bg-[#11141f] p-1.5 rounded-2xl border border-cyan-500/20 max-w-3xl mx-auto gap-1">
            <button
              onClick={() => setActiveTab("anomalies")}
              className={`flex-1 min-w-[140px] py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 ${
                activeTab === "anomalies"
                  ? "bg-gradient-to-r from-cyan-500 to-teal-500 text-black shadow-[0_0_20px_rgba(6,182,212,0.4)]"
                  : "text-gray-400 hover:text-white"
              }`}
            >
              <span>🔬</span>
              <span>Shadow Queue ({anomalies.length})</span>
            </button>
            <button
              onClick={() => setActiveTab("graduated")}
              className={`flex-1 min-w-[140px] py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 ${
                activeTab === "graduated"
                  ? "bg-gradient-to-r from-cyan-500 to-teal-500 text-black shadow-[0_0_20px_rgba(6,182,212,0.4)]"
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
                  ? "bg-gradient-to-r from-cyan-500 to-teal-500 text-black shadow-[0_0_20px_rgba(6,182,212,0.4)]"
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
                  ? "bg-gradient-to-r from-cyan-500 to-teal-500 text-black shadow-[0_0_20px_rgba(6,182,212,0.4)]"
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
                  <span className="px-2.5 py-0.5 rounded-full bg-cyan-500/10 text-cyan-400 border border-cyan-500/30 text-xs">
                    +25 XP per vote
                  </span>
                </h2>
                <p className="text-xs text-gray-400 mt-1">
                  Vote to Sanction valid ingredients. Reaching 3 consensus votes graduates the card into the official Dex!
                </p>
              </div>
              <button
                onClick={fetchLabData}
                className="text-xs text-cyan-400 hover:text-cyan-300 font-bold uppercase tracking-wider flex items-center gap-1"
              >
                <span>🔄</span> Refresh Queue
              </button>
            </div>

            {loadingAnomalies ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="h-44 bg-[#11141f]/60 rounded-2xl animate-pulse border border-white/5" />
                ))}
              </div>
            ) : anomalies.length === 0 ? (
              <div className="text-center py-20 bg-[#11141f]/40 rounded-3xl border border-cyan-500/10 p-8 max-w-xl mx-auto">
                <div className="text-5xl mb-4">✨</div>
                <h3 className="text-xl font-bold text-white mb-2">No Shadow Cards in Queue</h3>
                <p className="text-xs text-gray-400 mb-6">
                  All culinary anomalies have been peer-reviewed and graduated to the Dex! Submit new exotic ingredients or scrape web recipes in the Kitchen to discover more.
                </p>
                <button
                  onClick={() => setActiveTab("submit")}
                  className="px-6 py-2.5 rounded-full bg-gradient-to-r from-cyan-500 to-teal-500 text-black font-bold text-xs uppercase tracking-wider shadow-lg"
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
                      className="bg-[#11141f]/80 border border-cyan-500/20 hover:border-cyan-500/40 rounded-2xl p-5 flex flex-col justify-between shadow-xl backdrop-blur-md relative overflow-hidden group"
                    >
                      {/* Top metadata */}
                      <div className="flex items-start justify-between gap-4 mb-3">
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <span className="px-2 py-0.5 rounded-full bg-cyan-500/10 text-cyan-400 border border-cyan-500/30 text-[10px] font-mono uppercase font-bold">
                              ID #{item.id}
                            </span>
                            <span className="text-[11px] text-gray-500">
                              Harvested by <strong className="text-gray-300">@{item.submitter}</strong>
                            </span>
                          </div>
                          <h3 className="text-lg font-bold text-white group-hover:text-cyan-300 transition-colors">
                            {item.name}
                          </h3>
                        </div>

                        {/* Votes Indicator */}
                        <div className="flex flex-col items-end">
                          <span className="text-xs font-mono font-bold text-cyan-400">
                            {item.votes}/3 Votes
                          </span>
                          <div className="w-16 h-1.5 bg-black/60 rounded-full mt-1 overflow-hidden">
                            <div
                              className="h-full bg-gradient-to-r from-cyan-400 to-emerald-400"
                              style={{ width: `${Math.min((item.votes / 3) * 100, 100)}%` }}
                            />
                          </div>
                        </div>
                      </div>

                      {/* Source URL Preview */}
                      <div className="bg-[#090a0f] p-2.5 rounded-xl border border-white/5 mb-4 text-[11px] text-gray-400 flex items-center justify-between">
                        <span className="truncate flex-1 mr-2">🔗 {item.sourceUrl}</span>
                        <span className="text-[10px] text-gray-600 shrink-0 font-mono">
                          {item.created_at}
                        </span>
                      </div>

                      {/* Peer Review Action Buttons */}
                      <div className="flex items-center gap-3 pt-2 border-t border-white/5">
                        <button
                          onClick={() => handleVote(item.id, "reject")}
                          className="flex-1 py-2.5 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30 font-bold text-xs uppercase tracking-wider transition-all"
                        >
                          ✕ Reject / Flag
                        </button>
                        <button
                          onClick={() => handleVote(item.id, "sanction")}
                          className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-teal-500 text-black font-extrabold text-xs uppercase tracking-wider shadow-[0_0_15px_rgba(6,182,212,0.3)] hover:shadow-[0_0_25px_rgba(6,182,212,0.5)] transition-all"
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
                  <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 text-xs">
                    Verified by Community Consensus
                  </span>
                </h2>
                <p className="text-xs text-gray-400 mt-1">
                  Exotic ingredients and shadow cards that successfully passed peer review and have been minted into the Dex.
                </p>
              </div>
            </div>

            {graduatedAnomalies.length === 0 ? (
              <div className="text-center py-16 bg-[#11141f]/30 rounded-2xl border border-white/5 p-8 max-w-lg mx-auto">
                <div className="text-4xl mb-3">🎓</div>
                <h3 className="font-bold text-white mb-1">No graduated anomalies yet</h3>
                <p className="text-xs text-gray-400 mb-4">
                  Head over to the Shadow Queue tab and cast votes to graduate unverified cards!
                </p>
                <button
                  onClick={() => setActiveTab("anomalies")}
                  className="px-5 py-2 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 text-xs font-bold uppercase tracking-wider"
                >
                  Review Shadow Queue
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {graduatedAnomalies.map((item) => (
                  <div
                    key={item.id}
                    className="bg-[#11141f]/80 border border-emerald-500/20 rounded-2xl p-5 flex flex-col justify-between shadow-lg"
                  >
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 text-[10px] font-bold uppercase">
                          ✓ Sanctioned
                        </span>
                        <span className="text-[10px] text-gray-500 font-mono">{item.created_at}</span>
                      </div>
                      <h3 className="font-bold text-white text-base mb-1">{item.name}</h3>
                      <p className="text-[11px] text-gray-400 truncate">Source: {item.sourceUrl}</p>
                    </div>

                    <div className="mt-4 pt-3 border-t border-white/5 flex items-center justify-between text-xs">
                      <span className="text-gray-500">Submitter: @{item.submitter}</span>
                      <Link href="/collection" className="text-cyan-400 font-semibold hover:underline">
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
            <div className="bg-[#11141f]/80 border border-cyan-500/20 rounded-3xl p-6 md:p-8 shadow-2xl backdrop-blur-xl">
              <div className="max-w-2xl mb-6">
                <span className="text-xs font-bold uppercase tracking-widest text-cyan-400">
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
                      className="text-[11px] text-red-400 hover:underline font-bold uppercase"
                    >
                      Clear Palette
                    </button>
                  )}
                </div>
                <div className="min-h-[56px] p-3 rounded-2xl bg-[#090a0f] border border-white/10 flex flex-wrap items-center gap-2">
                  {selectedIngredients.length === 0 ? (
                    <span className="text-xs text-gray-500 italic pl-2">
                      Click ingredients from the database palette below or type custom ingredients...
                    </span>
                  ) : (
                    selectedIngredients.map((item) => (
                      <span
                        key={item}
                        className="px-3.5 py-1.5 rounded-full bg-cyan-500/20 border border-cyan-500/40 text-cyan-200 text-xs font-bold flex items-center gap-2 shadow-sm"
                      >
                        <span>{item}</span>
                        <button
                          onClick={() => toggleIngredient(item)}
                          className="text-cyan-400 hover:text-white font-bold"
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
                <div className="flex bg-[#090a0f] p-1 rounded-xl border border-white/10 text-xs font-bold">
                  <button
                    onClick={() => setSandboxFilter("all")}
                    className={`px-3 py-1.5 rounded-lg transition-all ${
                      sandboxFilter === "all"
                        ? "bg-cyan-500 text-black shadow"
                        : "text-gray-400 hover:text-white"
                    }`}
                  >
                    All Dex Ingredients ({allDbIngredients.length})
                  </button>
                  <button
                    onClick={() => setSandboxFilter("inventory")}
                    className={`px-3 py-1.5 rounded-lg transition-all ${
                      sandboxFilter === "inventory"
                        ? "bg-cyan-500 text-black shadow"
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
                    className="w-full bg-[#090a0f] border border-white/10 rounded-xl px-3 py-1.5 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-cyan-400"
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
                  className="flex-1 bg-[#090a0f] border border-white/10 rounded-xl px-4 py-2 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-cyan-400"
                />
                <button
                  type="submit"
                  className="px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-xs font-bold uppercase tracking-wider text-cyan-300 transition-all"
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
                            ? "bg-cyan-500 text-black font-bold border-cyan-400 shadow-[0_0_10px_rgba(6,182,212,0.4)]"
                            : "bg-white/5 text-gray-300 border-white/5 hover:border-cyan-500/30 hover:text-white"
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
                className="w-full sm:w-auto px-8 py-3.5 rounded-2xl bg-gradient-to-r from-cyan-500 via-teal-400 to-emerald-400 text-black font-extrabold uppercase tracking-widest text-xs shadow-[0_0_25px_rgba(6,182,212,0.4)] hover:shadow-[0_0_35px_rgba(6,182,212,0.6)] disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
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
                className="bg-[#11141f] border-2 border-cyan-500/40 rounded-3xl p-6 md:p-8 shadow-[0_0_40px_rgba(6,182,212,0.25)] space-y-6"
              >
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-white/5 pb-4">
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-widest text-cyan-400">
                      Analysis Report
                    </span>
                    <h3 className="text-2xl font-black text-white">{pairingResult.verdict}</h3>
                  </div>

                  <div className="flex items-center gap-3 bg-[#090a0f] px-5 py-3 rounded-2xl border border-cyan-500/30">
                    <span className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-emerald-400">
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
                  <div className="bg-[#090a0f] p-4 rounded-2xl border border-white/5">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-gray-500 block mb-1">
                      Dominant Flavor Profiles
                    </span>
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {pairingResult.dominant_profiles.map((prof) => (
                        <span
                          key={prof}
                          className="px-2.5 py-1 rounded-full bg-cyan-500/10 text-cyan-300 border border-cyan-500/30 text-xs font-bold"
                        >
                          {prof}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="bg-[#090a0f] p-4 rounded-2xl border border-white/5 md:col-span-2">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-gray-500 block mb-1">
                      Optimal Culinary Technique
                    </span>
                    <p className="text-sm font-bold text-emerald-400 mt-1">
                      🔥 {pairingResult.recommended_technique}
                    </p>
                    <p className="text-xs text-gray-400 mt-1">
                      Enhances volatile aroma compounds and minimizes flavor friction.
                    </p>
                  </div>
                </div>

                <div className="bg-[#090a0f]/80 p-5 rounded-2xl border border-cyan-500/20">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-cyan-400 block mb-2">
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
              className="bg-[#11141f]/90 border border-cyan-500/20 rounded-3xl p-6 md:p-8 shadow-2xl backdrop-blur-xl"
            >
              <span className="text-xs font-bold uppercase tracking-widest text-cyan-400">
                📡 Community Bounty Program
              </span>
              <h2 className="text-2xl font-bold text-white mt-1 mb-2">Submit a Shadow Card</h2>
              <p className="text-xs text-gray-400 mb-6">
                Found an obscure or uncatalogued ingredient in a regional cookbook or niche web recipe? Submit it to the Test Kitchen for peer review. You will receive <strong className="text-cyan-300">+50 XP bounty</strong> immediately!
              </p>

              <form onSubmit={handleSubmitAnomaly} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-gray-300 mb-2">
                    Ingredient Name <span className="text-cyan-400">*</span>
                  </label>
                  <input
                    type="text"
                    value={submitName}
                    onChange={(e) => setSubmitName(e.target.value)}
                    placeholder="e.g. Fermented Black Garlic Honey, Yuzu Kosho..."
                    className="w-full bg-[#090a0f] border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-cyan-400"
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
                    className="w-full bg-[#090a0f] border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-cyan-400"
                  />
                </div>

                <motion.button
                  type="submit"
                  disabled={isSubmitting || !submitName.trim()}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className="w-full py-3.5 rounded-xl bg-gradient-to-r from-cyan-500 to-teal-500 text-black font-extrabold uppercase tracking-widest text-xs shadow-[0_0_20px_rgba(6,182,212,0.4)] disabled:opacity-50 transition-all"
                >
                  {isSubmitting ? "Submitting to Queue..." : "Transmit Shadow Card (+50 XP)"}
                </motion.button>
              </form>
            </motion.div>
          </section>
        )}
      </main>
    </div>
  );
}
