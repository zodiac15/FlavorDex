'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import Link from 'next/link';
import { useAuth } from '../../contexts/AuthContext';
import BoosterPack from '../../components/BoosterPack';
import SwipeDeck from '../../components/SwipeDeck';
import Navbar from '../../components/Navbar';
import { apiUrl } from '../../lib/api';

const easeOut = [0.25, 0.1, 0.25, 1] as const;

export default function Dashboard() {
  const { user, logout } = useAuth() || { 
    user: { username: 'Chef', email: 'chef@example.com', xp: 0, rank: 'Novice' }, 
    logout: () => {} 
  };
  
  const [packOpened, setPackOpened] = useState(false);
  const [boosterCards, setBoosterCards] = useState<any>(null);
  const [goals, setGoals] = useState<any[]>([]);
  const [stats, setStats] = useState({ cards_collected: 0, recipes_unlocked: 0, streak: 0 });

  useEffect(() => {
    const token = localStorage.getItem("flavordex_token");
    if (!token) return;

    fetch(apiUrl("/users/me/stats"), {
      headers: { "Authorization": `Bearer ${token}` }
    })
    .then(res => res.json())
    .then(data => { if (!data.detail) setStats(data); })
    .catch(console.error);

    fetch(apiUrl("/users/me/goals"), {
      headers: { "Authorization": `Bearer ${token}` }
    })
    .then(res => res.json())
    .then(data => { if (!data.detail) setGoals(data); })
    .catch(console.error);
  }, []);

  const handleOpenPack = async () => {
    try {
      const token = localStorage.getItem("flavordex_token");
      const res = await fetch(apiUrl("/users/me/booster"), {
        method: "POST",
        headers: { "Authorization": `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        const mappedCards = data.cards.map((c: any) => ({ ...c, type: 'ingredient' }));
        setBoosterCards(mappedCards);
        setPackOpened(true);
      } else {
        setPackOpened(true);
      }
    } catch (err) {
      console.error(err);
      setPackOpened(true);
    }
  };

  const containerVariants = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: { staggerChildren: 0.1 }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    show: { opacity: 1, y: 0, transition: { ease: easeOut, duration: 0.5 } }
  };

  return (
    <div className="min-h-screen bg-[#0d0d0f] text-white pb-24 md:pb-0 font-sans">
      {/* Universal Navbar */}
      <Navbar />

      <main className="max-w-5xl mx-auto px-6 py-8">
        <motion.div 
          variants={containerVariants}
          initial="hidden"
          animate="show"
          className="space-y-10"
        >
          {/* Welcome Section */}
          <motion.section variants={itemVariants}>
            <h1 className="text-3xl font-bold mb-2">Welcome back, {user?.username || 'User'}!</h1>
            <p className="text-gray-400">Here's your daily overview</p>
          </motion.section>

          {/* Quick Stats Row */}
          <motion.section variants={itemVariants} className="flex gap-4 overflow-x-auto pb-4 scrollbar-hide -mx-6 px-6 md:mx-0 md:px-0">
            {[`🔥 ${stats.streak} Day Streak`, `📦 ${stats.cards_collected} Cards`, `🍳 ${stats.recipes_unlocked} Recipes`, `⭐ Rank ${user?.rank || 1}`].map((stat, i) => (
              <div 
                key={i}
                className="whitespace-nowrap bg-[#151518]/80 backdrop-blur border border-white/5 rounded-full px-5 py-3 font-medium text-sm text-gray-200 shadow-sm"
              >
                {stat}
              </div>
            ))}
          </motion.section>

          {/* Daily Booster Section */}
          <motion.section variants={itemVariants}>
            <h2 className="text-xl font-semibold mb-6">Daily Booster Pack</h2>
            <div className="bg-[#151518]/40 border border-white/5 rounded-3xl p-6 md:p-10 flex flex-col items-center justify-center min-h-[400px]">
              {!packOpened ? (
                <BoosterPack onOpen={handleOpenPack} />
              ) : (
                <div className="w-full max-w-sm mx-auto">
                  <SwipeDeck initialCards={boosterCards} />
                </div>
              )}
            </div>
          </motion.section>

          {/* Active Goals Section */}
          <motion.section variants={itemVariants}>
            <h2 className="text-xl font-semibold mb-6">Active Goals</h2>
            <div className="grid md:grid-cols-2 gap-4">
              {goals.length > 0 ? goals.map((goal, i) => (
                <div key={i} className="bg-[#151518]/80 rounded-2xl border border-white/5 p-5 flex items-center justify-between group hover:border-white/10 transition-colors">
                  <div className="flex-1 mr-6">
                    <h3 className="font-medium mb-3">{goal.name}</h3>
                    <div className="flex items-center gap-3">
                      <div className="flex-1 h-2 bg-black/50 rounded-full overflow-hidden">
                        <div 
                          className={`h-full bg-gradient-to-r ${goal.color || 'from-orange-500 to-red-500'}`}
                          style={{ width: `${Math.min((goal.current / goal.total) * 100, 100)}%` }}
                        />
                      </div>
                      <span className="text-xs font-medium text-gray-400 w-8">{goal.current}/{goal.total}</span>
                    </div>
                  </div>
                  <button className="px-4 py-2 bg-white/5 hover:bg-white/10 rounded-xl text-sm font-medium transition-colors">
                    View
                  </button>
                </div>
              )) : (
                <div className="col-span-2 text-gray-400 text-sm">No active goals.</div>
              )}
            </div>
          </motion.section>

          {/* Quick Links Grid */}
          <motion.section variants={itemVariants}>
            <h2 className="text-xl font-semibold mb-6">Explore</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {[
                { title: 'The Dex', desc: 'Browse your 1000+ ingredient cards', emoji: '📖', href: '/collection' },
                { title: 'Recipe Discovery', desc: 'Search & discover recipes to cook', emoji: '🍲', href: '/recipes' },
                { title: 'Kitchen', desc: 'Combine ingredients into recipes', emoji: '🍳', href: '/crafting' },
                { title: 'Test Kitchen', desc: 'Review & vote on shadow cards', emoji: '🔬', href: '/test-kitchen' },
                { title: 'Profile', desc: 'View your stats and activity feed', emoji: '👤', href: '/profile' }
              ].map((link, i) => (
                <Link key={i} href={link.href}>
                  <div className="bg-[#151518]/60 hover:bg-[#1a1a1f] border border-white/5 rounded-2xl p-6 transition-all group flex items-start gap-5 cursor-pointer h-full hover:border-pink-500/30">
                    <div className="text-4xl group-hover:scale-110 transition-transform">{link.emoji}</div>
                    <div>
                      <h3 className="text-lg font-semibold mb-1 group-hover:text-pink-400 transition-colors">{link.title}</h3>
                      <p className="text-sm text-gray-400 leading-relaxed">{link.desc}</p>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </motion.section>
        </motion.div>
      </main>
    </div>
  );
}
