'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { useAuth } from '../../contexts/AuthContext';
import Navbar from '../../components/Navbar';
import { apiUrl } from '../../lib/api';

export default function ProfilePage() {
  const { user, logout } = useAuth();
  
  // Mock data for user if context not ready
  const displayName = user?.username || 'Guest';
  const displayEmail = user?.email || 'guest@example.com';
  const initial = displayName.charAt(0).toUpperCase();
  const xp = user?.xp || 0;
  const rank = user?.rank || 'Novice Chef';

  const [statsData, setStatsData] = useState({ cards_collected: 0, recipes_unlocked: 0, anomalies_found: 0, trades_completed: 0 });
  const [activities, setActivities] = useState<any[]>([]);
  const [goals, setGoals] = useState<any[]>([]);

  useEffect(() => {
    const token = localStorage.getItem("flavordex_token");
    if (!token) return;

    fetch(apiUrl("/users/me/stats"), { headers: { "Authorization": `Bearer ${token}` } })
      .then(res => res.json())
      .then(data => { if (!data.detail) setStatsData(data); })
      .catch(console.error);

    fetch(apiUrl("/users/me/activity"), { headers: { "Authorization": `Bearer ${token}` } })
      .then(res => res.json())
      .then(data => { if (!data.detail) setActivities(data); })
      .catch(console.error);

    fetch(apiUrl("/users/me/goals"), { headers: { "Authorization": `Bearer ${token}` } })
      .then(res => res.json())
      .then(data => { if (!data.detail) setGoals(data); })
      .catch(console.error);
  }, []);

  const containerVariants = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: { staggerChildren: 0.1 }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    show: { opacity: 1, y: 0 }
  };

  const stats = [
    { label: 'Cards Collected', value: statsData.cards_collected, icon: '📦' },
    { label: 'Recipes Unlocked', value: statsData.recipes_unlocked, icon: '🍳' },
    { label: 'Anomalies Found', value: statsData.anomalies_found, icon: '🔬' },
    { label: 'Trades Completed', value: statsData.trades_completed, icon: '🔄' }
  ];

  return (
    <div className="min-h-screen bg-[#0d0d0f] text-white font-sans pb-24 md:pb-0">
      {/* Universal Navbar */}
      <Navbar />

      <main className="max-w-4xl mx-auto px-4 py-8">
        <motion.div 
          variants={containerVariants}
          initial="hidden"
          animate="show"
          className="space-y-10"
        >
          {/* Profile Header */}
          <motion.section variants={itemVariants} className="flex flex-col md:flex-row items-center md:items-start gap-6 text-center md:text-left">
            <div className="w-24 h-24 md:w-32 md:h-32 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-4xl md:text-5xl font-bold shadow-lg shadow-purple-500/20 shrink-0 border-4 border-[#151518]">
              {initial}
            </div>
            <div className="flex-1 mt-2 md:mt-4 space-y-3">
              <div>
                <h1 className="text-3xl md:text-4xl font-bold tracking-tight">{displayName}</h1>
                <p className="text-white/50 text-sm mt-1">{displayEmail}</p>
              </div>
              <div className="flex flex-wrap justify-center md:justify-start gap-3 mt-4">
                <div className="px-4 py-2 rounded-xl bg-[#151518]/80 border border-white/5 backdrop-blur-sm">
                  <span className="text-gray-400 text-xs uppercase tracking-wider block mb-1">Rank</span>
                  <span className="font-semibold text-purple-400">{rank}</span>
                </div>
                <div className="px-4 py-2 rounded-xl bg-[#151518]/80 border border-white/5 backdrop-blur-sm">
                  <span className="text-gray-400 text-xs uppercase tracking-wider block mb-1">Experience</span>
                  <span className="font-semibold text-pink-400">{xp} XP</span>
                </div>

              </div>
            </div>
          </motion.section>

          {/* Stats Grid */}
          <motion.section variants={itemVariants} className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {stats.map((stat, idx) => (
              <div key={idx} className="bg-[#151518]/80 backdrop-blur-xl border border-white/5 rounded-2xl p-4 flex flex-col items-center md:items-start text-center md:text-left">
                <div className="text-2xl mb-2">{stat.icon}</div>
                <div className="text-2xl font-bold">{stat.value}</div>
                <div className="text-xs text-white/50 mt-1">{stat.label}</div>
              </div>
            ))}
          </motion.section>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {/* Recent Activity */}
            <motion.section variants={itemVariants} className="md:col-span-2 space-y-4">
              <h2 className="text-xl font-semibold tracking-tight">Recent Activity</h2>
              <div className="bg-[#151518]/50 border border-white/5 rounded-2xl p-6">
                <div className="space-y-6">
                  {activities.length > 0 ? activities.map((act, idx) => (
                    <div key={idx} className="flex gap-4 relative">
                      {idx !== activities.length - 1 && (
                        <div className="absolute left-1.5 top-5 bottom-[-24px] w-[2px] bg-white/5"></div>
                      )}
                      <div className={`w-3 h-3 rounded-full mt-1.5 shrink-0 ${act.color || 'bg-purple-500'} shadow-[0_0_10px_rgba(255,255,255,0.2)]`} />
                      <div>
                        <p className="text-sm font-medium text-white/90">{act.text}</p>
                        <p className="text-xs text-white/40 mt-1">{act.time}</p>
                      </div>
                    </div>
                  )) : (
                    <div className="text-sm text-gray-400">No recent activity.</div>
                  )}
                </div>
              </div>
            </motion.section>

            {/* Active Goals */}
            <motion.section variants={itemVariants} className="space-y-4">
              <h2 className="text-xl font-semibold tracking-tight">Active Goals</h2>
              <div className="space-y-4">
                {goals.length > 0 ? goals.map((goal, idx) => {
                  const percent = Math.min(100, Math.round((goal.current / goal.total) * 100));
                  return (
                    <div key={idx} className="bg-[#151518]/80 border border-white/5 rounded-2xl p-4">
                      <div className="flex justify-between items-center mb-3">
                        <h3 className="text-sm font-medium">{goal.name}</h3>
                        <span className="text-xs text-white/50">{goal.current}/{goal.total}</span>
                      </div>
                      <div className="h-2 w-full bg-black/50 rounded-full overflow-hidden">
                        <div 
                          className={`h-full bg-gradient-to-r ${goal.color || 'from-pink-500 to-purple-500'} rounded-full`} 
                          style={{ width: `${percent}%` }}
                        />
                      </div>
                      <div className="text-right text-xs text-purple-400 font-medium mt-2">
                        {percent}%
                      </div>
                    </div>
                  )
                }) : (
                  <div className="text-sm text-gray-400">No active goals.</div>
                )}
              </div>
            </motion.section>
          </div>
        </motion.div>
      </main>
    </div>
  );
}
