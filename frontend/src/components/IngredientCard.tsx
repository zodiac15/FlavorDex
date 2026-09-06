"use client";

import { motion, useMotionValue, useTransform, useSpring } from "framer-motion";
import React, { useMemo } from "react";

interface IngredientCardProps {
  name: string;
  category: string;
  rarity: "common" | "uncommon" | "rare" | "epic" | "legendary" | "mythic";
  imageUrl?: string;
  isActiveGoal?: boolean;
}

const rarityData: Record<string, { color: string; stars: number; hasGlow: boolean; hasHolo: boolean; extraFlair?: boolean }> = {
  common: { color: "#3b82f6", stars: 1, hasGlow: false, hasHolo: false },
  uncommon: { color: "#10b981", stars: 2, hasGlow: false, hasHolo: false },
  rare: { color: "#c026d3", stars: 3, hasGlow: true, hasHolo: true },
  epic: { color: "#06b6d4", stars: 4, hasGlow: true, hasHolo: true },
  legendary: { color: "#db2777", stars: 5, hasGlow: true, hasHolo: true },
  mythic: { color: "#c026d3", stars: 6, hasGlow: true, hasHolo: true, extraFlair: true },
};

const categoryEmojis: Record<string, string> = {
  fruit: "🍎",
  spice: "🧂",
  herb: "🌿",
  meat: "🥩",
  condiment: "🧈",
  vegetable: "🥕",
  other: "🍳",
};

export default function IngredientCard({ name, category, rarity, imageUrl, isActiveGoal }: IngredientCardProps) {
  const x = useMotionValue(0);
  const y = useMotionValue(0);

  const mouseXSpring = useSpring(x, { stiffness: 300, damping: 20 });
  const mouseYSpring = useSpring(y, { stiffness: 300, damping: 20 });

  const rotateX = useTransform(mouseYSpring, [-0.5, 0.5], ["17.5deg", "-17.5deg"]);
  const rotateY = useTransform(mouseXSpring, [-0.5, 0.5], ["-17.5deg", "17.5deg"]);

  const glareX = useTransform(mouseXSpring, [-0.5, 0.5], ["0%", "100%"]);
  const glareY = useTransform(mouseYSpring, [-0.5, 0.5], ["0%", "100%"]);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    x.set(mouseX / rect.width - 0.5);
    y.set(mouseY / rect.height - 0.5);
  };

  const handleMouseLeave = () => {
    x.set(0);
    y.set(0);
  };

  const data = rarityData[rarity] || rarityData.common;
  const emoji = useMemo(() => {
    const normalizedCat = category.toLowerCase().trim();
    return categoryEmojis[normalizedCat] || categoryEmojis.other;
  }, [category]);

  const { color, stars, hasGlow, hasHolo, extraFlair } = data;
  const starString = "◆".repeat(stars);

  const outerBg = isActiveGoal
    ? "linear-gradient(135deg, #eab308 0%, #ca8a04 100%)"
    : `linear-gradient(135deg, ${color} 0%, #1a1a24 100%)`;

  const innerBg = `radial-gradient(circle at 50% 0%, ${color}22 0%, #111116 80%)`;
  const artShadow = `inset 0 0 30px ${color}44, 0 10px 30px -10px #000`;
  const starGlow = `0 0 10px ${color}`;
  const rarityBadgeBg = `${color}33`;

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes holoShimmer {
          0% { background-position: 0% 50%; }
          100% { background-position: 200% 50%; }
        }
        @keyframes pulseGlow {
          0%, 100% { opacity: 0.6; }
          50% { opacity: 1; }
        }
        @keyframes goalBounce {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-4px); }
        }
        .holo-overlay {
          background: linear-gradient(
            115deg,
            transparent 20%,
            rgba(255, 255, 255, 0.1) 25%,
            rgba(255, 255, 255, 0.4) 45%,
            transparent 50%,
            rgba(255, 255, 255, 0.1) 55%,
            rgba(255, 255, 255, 0.4) 75%,
            transparent 80%
          );
          background-size: 200% auto;
          animation: holoShimmer 3s linear infinite;
        }
        .animate-goal {
          animation: goalBounce 2s ease-in-out infinite;
        }
        .mythic-flair {
          background: radial-gradient(circle at center, rgba(192, 38, 211, 0.8) 0%, transparent 70%);
          mix-blend-mode: color-dodge;
          animation: pulseGlow 2s ease-in-out infinite;
        }
      `}} />

      <motion.div
        className="relative w-72 h-96 rounded-2xl p-[2px] cursor-pointer group select-none"
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        style={{
          perspective: 1200,
          rotateX,
          rotateY,
          transformStyle: "preserve-3d",
          background: outerBg,
          boxShadow: isActiveGoal ? "0 0 40px rgba(234, 179, 8, 0.6)" : "none",
        }}
      >
        {/* Pulsing glow for rare+ */}
        {hasGlow && !isActiveGoal && (
          <div
            className="absolute inset-0 rounded-2xl pointer-events-none"
            style={{
              boxShadow: `inset 0 0 20px ${color}88, 0 0 15px ${color}66`,
              animation: "pulseGlow 3s ease-in-out infinite",
            }}
          />
        )}

        {/* Goal Badge */}
        {isActiveGoal && (
          <div
            className="absolute -top-3 -right-3 z-50 bg-yellow-400 text-yellow-900 text-xs font-black px-3 py-1 rounded-full border-2 border-yellow-200 shadow-[0_0_15px_rgba(234,179,8,0.8)] animate-goal"
            style={{ transform: "translateZ(40px)" }}
          >
            🎯 GOAL
          </div>
        )}

        {/* Glare overlay */}
        <div className="absolute inset-0 rounded-2xl overflow-hidden pointer-events-none z-40">
          <motion.div
            className="absolute inset-0 opacity-40 pointer-events-none mix-blend-overlay"
            style={{
              background: "radial-gradient(circle at center, rgba(255,255,255,0.8) 0%, rgba(255,255,255,0) 50%)",
              left: glareX,
              top: glareY,
              transform: "translate(-50%, -50%)",
              width: "200%",
              height: "200%",
            }}
          />
        </div>

        {/* Main Card Content */}
        <div
          className="w-full h-full rounded-[14px] flex flex-col items-center justify-between p-5 overflow-hidden relative z-10 border border-white/10"
          style={{
            transform: "translateZ(30px)",
            background: innerBg,
            backgroundColor: "#111116",
          }}
        >
          {/* Holographic shimmer for rare+ */}
          {hasHolo && (
            <div className="absolute inset-0 holo-overlay opacity-50 pointer-events-none mix-blend-color-dodge z-20" />
          )}

          {/* Mythic extra flair */}
          {extraFlair && (
            <div className="absolute inset-0 mythic-flair pointer-events-none z-0 opacity-30" />
          )}

          {/* Header */}
          <div className="w-full flex justify-between items-center z-30">
            <span className="text-xs uppercase tracking-[0.2em] font-bold text-white/50 drop-shadow-md">
              {category}
            </span>
            <span
              className="text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-wider border border-white/20 shadow-lg backdrop-blur-md"
              style={{ backgroundColor: rarityBadgeBg, color: color }}
            >
              {rarity}
            </span>
          </div>

          {/* Artwork */}
          <div
            className="relative w-40 h-40 rounded-full border border-white/20 shadow-2xl flex items-center justify-center bg-[#0a0a0d] z-30 group-hover:scale-105 transition-transform duration-500"
            style={{
              boxShadow: artShadow,
              transform: "translateZ(25px)",
            }}
          >
            {imageUrl ? (
              <img src={imageUrl} alt={name} className="w-full h-full object-cover rounded-full p-2" />
            ) : (
              <span className="text-6xl drop-shadow-[0_0_15px_rgba(255,255,255,0.2)]" style={{ transform: "translateZ(10px)" }}>
                {emoji}
              </span>
            )}
          </div>

          {/* Title */}
          <div className="w-full flex flex-col items-center gap-1 z-30">
            <h2 className="text-2xl font-black text-center uppercase tracking-widest text-transparent bg-clip-text bg-gradient-to-br from-white to-white/60 drop-shadow-lg" style={{ transform: "translateZ(15px)" }}>
              {name}
            </h2>
          </div>

          {/* Star rating */}
          <div className="absolute bottom-4 left-5 z-30">
            <span className="text-[10px] tracking-[0.2em] opacity-80" style={{ color: color, textShadow: starGlow }}>
              {starString}
            </span>
          </div>
        </div>
      </motion.div>
    </>
  );
}
