"use client";

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";

interface BoosterPackProps {
  onOpen: () => void;
}

const particles = Array.from({ length: 30 }).map((_, i) => ({
  id: i,
  x: (Math.random() - 0.5) * 400,
  y: (Math.random() - 0.5) * 400,
  scale: Math.random() * 1.5 + 0.5,
  delay: Math.random() * 0.1,
  color: ["#FBBF24", "#F472B6", "#A78BFA", "#38BDF8", "#E879F9"][
    Math.floor(Math.random() * 5)
  ],
}));

export default function BoosterPack({ onOpen }: BoosterPackProps) {
  // stage 0: sealed, stage 1: half-torn, stage 2: fully open
  const [stage, setStage] = useState(0);

  const handleClick = () => {
    if (stage === 0) {
      setStage(1);
    } else if (stage === 1) {
      setStage(2);
    }
  };

  useEffect(() => {
    if (stage === 2) {
      const timer = setTimeout(() => {
        onOpen();
      }, 600);
      return () => clearTimeout(timer);
    }
  }, [stage, onOpen]);

  // The visual content of the pack itself
  const PackContent = () => (
    <div className="absolute inset-0 bg-gradient-to-br from-indigo-950 via-purple-900 to-black rounded-xl border border-white/10 shadow-2xl overflow-hidden flex flex-col items-center justify-center cursor-pointer">
      {/* Holographic Shimmer */}
      <motion.div
        className="absolute inset-0 pointer-events-none mix-blend-overlay opacity-40"
        style={{
          background:
            "linear-gradient(115deg, transparent 20%, rgba(255,255,255,0.7) 40%, rgba(255,255,255,0.7) 60%, transparent 80%)",
          backgroundSize: "200% 200%",
        }}
        animate={{
          backgroundPosition: ["200% 200%", "-100% -100%"],
        }}
        transition={{
          repeat: Infinity,
          duration: 3,
          ease: "linear",
        }}
      />

      {/* Decorative Corners */}
      <div className="absolute top-3 left-3 w-4 h-4 border-t-2 border-l-2 border-white/30" />
      <div className="absolute top-3 right-3 w-4 h-4 border-t-2 border-r-2 border-white/30" />
      <div className="absolute bottom-3 left-3 w-4 h-4 border-b-2 border-l-2 border-white/30" />
      <div className="absolute bottom-3 right-3 w-4 h-4 border-b-2 border-r-2 border-white/30" />

      {/* Branding */}
      <div className="z-10 text-center flex flex-col items-center space-y-2 select-none">
        <div className="text-4xl font-black tracking-widest bg-clip-text text-transparent bg-gradient-to-b from-gray-100 via-gray-300 to-gray-500 drop-shadow-lg">
          FLAVORDEX
        </div>
        <div className="text-sm font-bold tracking-[0.3em] text-purple-300/80 uppercase">
          Daily Booster
        </div>
      </div>

      {/* Internal glow accents */}
      <div className="absolute bottom-0 w-full h-1/2 bg-gradient-to-t from-purple-500/20 to-transparent pointer-events-none" />
      <div className="absolute top-0 w-full h-1/2 bg-gradient-to-b from-indigo-500/20 to-transparent pointer-events-none" />
    </div>
  );

  return (
    <div className="relative w-72 h-[26rem] perspective-[1000px]">
      <AnimatePresence>
        {stage < 2 && (
          <motion.div
            className="absolute inset-0 flex items-center justify-center"
            initial={{ opacity: 1 }}
            exit={{ opacity: 0, transition: { duration: 0.1 } }}
          >
            {/* The inner light that pours out when half-torn */}
            <motion.div
              className="absolute top-[25%] w-full h-4 bg-white shadow-[0_0_40px_20px_rgba(255,255,255,0.8)] z-0 rounded-full"
              initial={{ opacity: 0 }}
              animate={{ opacity: stage === 1 ? 1 : 0 }}
              transition={{ duration: 0.2 }}
            />

            {/* Top Half of the Pack */}
            <motion.div
              className="absolute inset-0 z-10 origin-bottom"
              style={{ clipPath: "polygon(0 0, 100% 0, 100% 25%, 0 25%)" }}
              animate={{
                y: stage === 1 ? -15 : 0,
                rotateX: stage === 1 ? 15 : 0,
                scale: stage === 1 ? 1.02 : 1,
              }}
              transition={{ type: "spring", stiffness: 300, damping: 15 }}
              onClick={handleClick}
            >
              <PackContent />
            </motion.div>

            {/* Bottom Half of the Pack */}
            <motion.div
              className="absolute inset-0 z-10"
              style={{ clipPath: "polygon(0 25%, 100% 25%, 100% 100%, 0 100%)" }}
              animate={
                stage === 0
                  ? { scale: [1, 1.02, 1] }
                  : stage === 1
                  ? {
                      x: [-2, 2, -2, 2, 0],
                      transition: { repeat: Infinity, duration: 0.2 },
                    }
                  : {}
              }
              transition={
                stage === 0
                  ? { repeat: Infinity, duration: 4, ease: "easeInOut" }
                  : {}
              }
              onClick={handleClick}
            >
              <PackContent />
            </motion.div>

            {/* Visible Tear Line on the Pack Surface */}
            <div
              className="absolute top-[25%] w-full flex items-center pointer-events-none z-20"
              style={{ transform: "translateY(-50%)" }}
            >
              <div className="w-full h-[2px] bg-gradient-to-r from-transparent via-purple-300/50 to-transparent border-t border-dashed border-white/40 drop-shadow-[0_0_3px_rgba(255,255,255,0.8)]" />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Explosion Particles for Stage 2 */}
      {stage === 2 && (
        <div className="absolute inset-0 flex items-center justify-center z-30 pointer-events-none">
          {particles.map((p) => (
            <motion.div
              key={p.id}
              className="absolute w-2 h-2 rounded-full shadow-lg"
              style={{ backgroundColor: p.color }}
              initial={{ x: 0, y: 0, opacity: 1, scale: 0 }}
              animate={{
                x: p.x,
                y: p.y,
                opacity: 0,
                scale: p.scale,
              }}
              transition={{
                duration: 0.6,
                ease: "easeOut",
                delay: p.delay,
              }}
            />
          ))}

          {/* Explosive flash */}
          <motion.div
            className="absolute inset-0 bg-white rounded-full blur-2xl"
            initial={{ opacity: 0.8, scale: 0.5 }}
            animate={{ opacity: 0, scale: 2 }}
            transition={{ duration: 0.4, ease: "easeOut" }}
          />

          {/* Flying halves (simulated by copies that fly apart) */}
          <motion.div
            className="absolute inset-0"
            style={{ clipPath: "polygon(0 0, 100% 0, 100% 25%, 0 25%)" }}
            initial={{ y: -15, rotateX: 15, scale: 1.02 }}
            animate={{ y: -200, x: -100, rotateZ: -25, opacity: 0 }}
            transition={{ duration: 0.5, ease: "easeOut" }}
          >
            <PackContent />
          </motion.div>
          <motion.div
            className="absolute inset-0"
            style={{ clipPath: "polygon(0 25%, 100% 25%, 100% 100%, 0 100%)" }}
            initial={{ scale: 1 }}
            animate={{ y: 200, x: 100, rotateZ: 25, opacity: 0 }}
            transition={{ duration: 0.5, ease: "easeOut" }}
          >
            <PackContent />
          </motion.div>
        </div>
      )}
    </div>
  );
}
