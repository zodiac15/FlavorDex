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
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-amber-500 via-orange-500 to-red-500" />

        {/* Header */}
        <div className="w-full flex justify-between items-center z-30">
          <span className="text-xs uppercase tracking-[0.2em] font-bold text-amber-400/70">Recipe</span>
          <span className="text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-wider border border-amber-500/30 text-amber-400 bg-amber-500/10 backdrop-blur-md">
            🍳 Dish
          </span>
        </div>

        {/* Recipe artwork */}
        <div
          className="relative w-40 h-40 rounded-2xl border border-white/10 shadow-2xl flex items-center justify-center bg-gradient-to-br from-amber-950/50 to-[#0a0a0d] z-30"
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
            className="text-xl font-black text-center uppercase tracking-wider text-transparent bg-clip-text bg-gradient-to-br from-amber-200 to-amber-500 drop-shadow-lg"
            style={{ transform: "translateZ(15px)" }}
          >
            {title}
          </h2>

          {/* Difficulty */}
          <div className="text-amber-400 text-sm tracking-widest">{difficultyStars}</div>

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
