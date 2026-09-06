"use client";

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import Navbar from '../components/Navbar';
import { apiUrl } from '../lib/api';

const FloatingParticles = () => {
  const [particles, setParticles] = useState<{ id: number; x: number; y: number; size: number; duration: number }[]>([]);

  useEffect(() => {
    const newParticles = Array.from({ length: 20 }).map((_, i) => ({
      id: i,
      x: Math.random() * 100,
      y: Math.random() * 100,
      size: Math.random() * 6 + 2,
      duration: Math.random() * 20 + 10,
    }));
    setParticles(newParticles);
  }, []);

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {particles.map((p) => (
        <motion.div
          key={p.id}
          className="absolute rounded-full bg-pink-500/30 blur-[1px]"
          style={{
            width: p.size,
            height: p.size,
            left: `${p.x}%`,
            top: `${p.y}%`,
          }}
          animate={{
            y: [0, -100, 0],
            x: [0, Math.random() * 50 - 25, 0],
            opacity: [0.2, 0.8, 0.2],
          }}
          transition={{
            duration: p.duration,
            repeat: Infinity,
            ease: "linear",
          }}
        />
      ))}
    </div>
  );
};

const StatCounter = ({ end, label }: { end: number, label: string }) => {
  const [count, setCount] = useState(0);

  return (
    <motion.div 
      className="flex flex-col items-center justify-center p-6"
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      onViewportEnter={() => {
        let start = 0;
        const duration = 2000;
        const increment = end / (duration / 16);
        const timer = setInterval(() => {
          start += increment;
          if (start >= end) {
            setCount(end);
            clearInterval(timer);
          } else {
            setCount(Math.floor(start));
          }
        }, 16);
      }}
    >
      <div className="text-4xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-pink-400 to-purple-400 mb-2">
        {count.toLocaleString()}{label === 'Collectors (K)' ? 'K+' : '+'}
      </div>
      <div className="text-gray-400 text-sm tracking-wider uppercase font-medium">{label === 'Collectors (K)' ? 'Collectors' : label}</div>
    </motion.div>
  );
};

export default function Home() {
  const [stats, setStats] = useState({ ingredients: 0, recipes: 0, users: 0 });

  useEffect(() => {
    fetch(apiUrl('/public/stats'))
      .then(res => res.json())
      .then(data => setStats(data))
      .catch(console.error);
  }, []);

  const fadeInUp = {
    hidden: { opacity: 0, y: 40 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: "easeOut" as const } }
  };

  const staggerContainer = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.2
      }
    }
  };

  return (
    <div className="min-h-screen bg-[#0d0d0f] text-white selection:bg-pink-500/30 overflow-x-hidden font-sans">
      {/* Navbar */}
      {/* Universal Navbar */}
      <Navbar />

      <main className="pt-20">
        {/* Hero Section */}
        <section className="relative min-h-[90vh] flex items-center justify-center overflow-hidden">
          <FloatingParticles />
          
          {/* Radial Glow */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-purple-600/20 rounded-full blur-[120px] pointer-events-none" />
          
          <div className="relative z-10 max-w-5xl mx-auto px-6 text-center">
            <motion.div
              initial="hidden"
              animate="visible"
              variants={staggerContainer}
            >
              <motion.h1 
                variants={fadeInUp}
                className="text-6xl md:text-8xl font-black tracking-tight mb-6"
              >
                Collect. <span className="bg-clip-text text-transparent bg-gradient-to-r from-pink-500 via-purple-500 to-indigo-500 animate-pulse">Cook.</span> Conquer.
              </motion.h1>
              
              <motion.p 
                variants={fadeInUp}
                className="text-xl md:text-2xl text-gray-400 max-w-2xl mx-auto mb-12 font-light"
              >
                Discover rare ingredients, master complex recipes, and build your ultimate culinary collection in the world's first gamified cooking platform.
              </motion.p>
              
              <motion.div variants={fadeInUp}>
                <Link href="/auth" className="inline-flex items-center justify-center px-8 py-4 text-lg font-bold rounded-full bg-gradient-to-r from-pink-600 to-purple-600 hover:from-pink-500 hover:to-purple-500 transition-all shadow-[0_0_40px_rgba(219,39,119,0.4)] hover:shadow-[0_0_60px_rgba(219,39,119,0.6)] transform hover:-translate-y-1">
                  Open Your First Pack →
                </Link>
              </motion.div>
            </motion.div>
          </div>
        </section>

        {/* Stats Bar */}
        <section className="relative z-20 max-w-6xl mx-auto px-6 -mt-20">
          <div className="bg-[#151518]/80 backdrop-blur-xl border border-white/5 rounded-3xl p-2 shadow-2xl">
            <div className="grid grid-cols-2 md:grid-cols-4 divide-x divide-white/5">
              <StatCounter end={stats.ingredients} label="Ingredients" />
              <StatCounter end={stats.recipes} label="Recipes" />
              <StatCounter end={stats.users} label="Collectors" />
              <div className="flex flex-col items-center justify-center p-6">
                 <motion.div 
                    initial={{ opacity: 0, scale: 0.5 }}
                    whileInView={{ opacity: 1, scale: 1 }}
                    viewport={{ once: true }}
                    className="text-4xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-pink-400 to-purple-400 mb-2"
                 >
                    6
                 </motion.div>
                 <div className="text-gray-400 text-sm tracking-wider uppercase font-medium">Rarity Tiers</div>
              </div>
            </div>
          </div>
        </section>

        {/* Features Section */}
        <section className="py-32 max-w-7xl mx-auto px-6">
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <h2 className="text-4xl md:text-5xl font-bold mb-4">How It Works</h2>
            <div className="w-24 h-1 bg-gradient-to-r from-pink-500 to-purple-500 mx-auto rounded-full" />
          </motion.div>

          <motion.div 
            variants={staggerContainer}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            className="grid grid-cols-1 md:grid-cols-3 gap-8"
          >
            {[
              { icon: '🎴', title: 'Daily Booster Packs', desc: 'Open daily packs to discover new ingredient cards with varying rarities.', color: 'border-t-pink-500' },
              { icon: '🍳', title: 'Craft Recipes', desc: 'Combine ingredients to unlock recipes. Drag and drop your cards into the cauldron.', color: 'border-t-purple-500' },
              { icon: '🔬', title: 'Test Kitchen', desc: 'Help identify unknown ingredients. Vote as a community to expand the database.', color: 'border-t-indigo-500' }
            ].map((feature, idx) => (
              <motion.div 
                key={idx}
                variants={fadeInUp}
                className={`bg-[#151518]/50 backdrop-blur-sm border border-white/5 rounded-2xl p-8 hover:bg-[#1a1a1f]/80 transition-colors border-t-2 ${feature.color}`}
              >
                <div className="text-5xl mb-6">{feature.icon}</div>
                <h3 className="text-2xl font-bold mb-4">{feature.title}</h3>
                <p className="text-gray-400 leading-relaxed">{feature.desc}</p>
              </motion.div>
            ))}
          </motion.div>
        </section>

        {/* Rarity Showcase */}
        <section className="py-20 bg-gradient-to-b from-transparent via-[#121215] to-transparent">
          <div className="max-w-7xl mx-auto px-6">
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="mb-12 text-center md:text-left"
            >
              <h2 className="text-3xl font-bold">Chase The Rarity</h2>
            </motion.div>
            
            <div className="flex overflow-x-auto pb-8 -mx-6 px-6 gap-6 snap-x hide-scrollbar">
              {[
                { name: 'Common', color: 'bg-gray-400', glow: 'shadow-gray-400/20' },
                { name: 'Uncommon', color: 'bg-green-400', glow: 'shadow-green-400/20' },
                { name: 'Rare', color: 'bg-blue-400', glow: 'shadow-blue-400/20' },
                { name: 'Epic', color: 'bg-purple-400', glow: 'shadow-purple-400/20' },
                { name: 'Legendary', color: 'bg-amber-400', glow: 'shadow-amber-400/20' },
                { name: 'Mythic', color: 'bg-rose-500', glow: 'shadow-rose-500/20' }
              ].map((rarity, idx) => (
                <motion.div 
                  key={idx}
                  initial={{ opacity: 0, scale: 0.8 }}
                  whileInView={{ opacity: 1, scale: 1 }}
                  viewport={{ once: true }}
                  transition={{ delay: idx * 0.1 }}
                  className={`snap-center shrink-0 w-40 h-56 rounded-xl bg-[#1a1a1f] border border-white/10 flex flex-col items-center justify-center relative overflow-hidden group shadow-lg ${rarity.glow}`}
                >
                  <div className={`absolute top-0 w-full h-1 ${rarity.color}`} />
                  <div className={`w-3 h-3 rounded-full ${rarity.color} mb-4 shadow-[0_0_15px_currentColor]`} />
                  <div className="font-bold tracking-wider">{rarity.name}</div>
                  <div className="absolute inset-0 bg-gradient-to-b from-transparent to-black/50 opacity-0 group-hover:opacity-100 transition-opacity" />
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* CTA Footer */}
        <footer className="pt-32 pb-12 relative overflow-hidden">
          <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-full max-w-4xl h-64 bg-pink-600/10 rounded-full blur-[100px] pointer-events-none" />
          
          <div className="max-w-4xl mx-auto px-6 text-center relative z-10">
            <motion.div
              initial={{ opacity: 0, y: 40 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
            >
              <h2 className="text-5xl font-black mb-8">Ready to start your journey?</h2>
              <Link href="/auth" className="inline-flex items-center justify-center px-10 py-5 text-xl font-bold rounded-full bg-white text-black hover:bg-gray-200 transition-all shadow-[0_0_30px_rgba(255,255,255,0.3)] hover:shadow-[0_0_50px_rgba(255,255,255,0.5)] transform hover:-translate-y-1 mb-24">
                Begin Collecting
              </Link>
            </motion.div>
            
            <div className="border-t border-white/10 pt-8 flex flex-col md:flex-row items-center justify-between text-gray-500 text-sm">
              <div>© 2026 FlavorDex. All rights reserved.</div>
              <div className="flex gap-6 mt-4 md:mt-0">
                <Link href="#" className="hover:text-white transition-colors">Privacy</Link>
                <Link href="#" className="hover:text-white transition-colors">Terms</Link>
                <Link href="#" className="hover:text-white transition-colors">Discord</Link>
              </div>
            </div>
          </div>
        </footer>
      </main>
      
      <style dangerouslySetInnerHTML={{__html: `
        .hide-scrollbar::-webkit-scrollbar {
          display: none;
        }
        .hide-scrollbar {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
      `}} />
    </div>
  );
}
