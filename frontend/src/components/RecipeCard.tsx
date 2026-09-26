"use client";

import { motion, useMotionValue, useTransform } from "framer-motion";
import React from "react";

interface RecipeCardProps {
  title: string;
  difficulty: number;
  dietaryTags: string[];
  ingredientCount: number;
}

export default function RecipeCard({ title, difficulty, dietaryTags, ingredientCount }: RecipeCardProps) {
  const x = useMotionValue(0);
  const y = useMotionValue(0);

  const rotateX = useTransform(y, [-0.5, 0.5], ["12deg", "-12deg"]);
  const rotateY = useTransform(x, [-0.5, 0.5], ["-12deg", "12deg"]);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    x.set((e.clientX - rect.left) / rect.width - 0.5);
    y.set((e.clientY - rect.top) / rect.height - 0.5);
  };

  const handleMouseLeave = () => {
    x.set(0);
    y.set(0);
  };

  const difficultyStars = "★".repeat(difficulty) + "☆".repeat(5 - difficulty);

  return (
    <motion.div
      className="relative w-72 h-96 rounded-2xl p-[2px] cursor-pointer group select-none"
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      style={{
        perspective: 1200,
        rotateX,
        rotateY,
        transformStyle: "preserve-3d",
        background: "linear-gradient(135deg, #f59e0b 0%, #92400e 50%, #1a1a24 100%)",
      }}
    >
      <div
        className="w-full h-full rounded-[14px] flex flex-col items-center justify-between p-5 overflow-hidden relative border border-white/10"
        style={{
          background: "radial-gradient(circle at 50% 0%, #f59e0b22 0%, #111116 80%)",
          backgroundColor: "#111116",
          transform: "translateZ(30px)",
        }}
      >
        {/* Recipe badge */}
        <div className="absolute left-0 right-0 top-0 h-1 bg-gradient-to-r from-[#e9b65c] via-[#f0d58c] to-[#e77a9b]" />

        {/* Header */}
        <div className="w-full flex justify-between items-center z-30">
          <span className="text-xs font-bold uppercase tracking-[0.2em] text-[#f0d58c]/70">Recipe</span>
          <span className="rounded-full border border-[#e9b65c]/30 bg-[#e9b65c]/10 px-3 py-1 text-[10px] font-black uppercase tracking-wider text-[#e9b65c] backdrop-blur-md">
            🍳 Dish
          </span>
        </div>

        {/* Recipe artwork */}
        <div
          className="relative z-30 flex h-40 w-40 items-center justify-center rounded-2xl border border-white/10 bg-gradient-to-br from-[#e9b65c]/20 to-[#0a0a0d] shadow-2xl"
          style={{
            boxShadow: "inset 0 0 30px #f59e0b22, 0 10px 30px -10px #000",
            transform: "translateZ(25px)",
          }}
        >
          <span className="text-7xl" style={{ transform: "translateZ(10px)" }}>🍽️</span>
        </div>

        {/* Title */}
        <div className="w-full flex flex-col items-center gap-2 z-30">
          <h2
            className="bg-gradient-to-br from-[#f0d58c] to-[#e9b65c] bg-clip-text text-center text-xl font-black uppercase tracking-wider text-transparent drop-shadow-lg"
            style={{ transform: "translateZ(15px)" }}
          >
            {title}
          </h2>

          {/* Difficulty */}
          <div className="text-sm tracking-widest text-[#e9b65c]">{difficultyStars}</div>

          {/* Tags */}
          <div className="flex gap-2 flex-wrap justify-center">
            {dietaryTags.map((tag) => (
              <span key={tag} className="text-[9px] px-2 py-0.5 rounded-full bg-green-500/15 text-green-400 border border-green-500/20 uppercase tracking-wider font-bold">
                {tag}
              </span>
            ))}
            <span className="text-[9px] px-2 py-0.5 rounded-full bg-white/5 text-gray-400 border border-white/10 uppercase tracking-wider font-bold">
              {ingredientCount} ingredients
            </span>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
