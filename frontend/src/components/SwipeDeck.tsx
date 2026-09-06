"use client";

import { motion, useMotionValue, useTransform } from "framer-motion";
import { useState } from "react";
import IngredientCard from "./IngredientCard";
import RecipeCard from "./RecipeCard";

type BoosterCard =
  | { type: "ingredient"; id: number; name: string; category: string; rarity: "common" | "uncommon" | "rare" | "epic" | "legendary" | "mythic"; isActiveGoal?: boolean }
  | { type: "recipe"; id: number; title: string; difficulty: number; dietaryTags: string[]; ingredientCount: number };

export default function SwipeDeck({ initialCards }: { initialCards?: BoosterCard[] }) {
  const [deck, setDeck] = useState(initialCards || []);
  const [collected, setCollected] = useState<BoosterCard[]>([]);

  const removeCard = (id: number) => {
    const card = deck.find((c) => c.id === id);
    if (card) setCollected((prev) => [...prev, card]);
    setDeck((prev) => prev.filter((c) => c.id !== id));
  };

  return (
    <div className="flex flex-col items-center w-full">
      {/* Counter */}
      <div className="mb-6 text-center">
        <span className="text-gray-500 text-sm uppercase tracking-widest font-bold">
          {deck.length} / {(initialCards || []).length} cards remaining
        </span>
      </div>

      {/* Card stack */}
      <div className="relative w-full h-[440px] flex items-center justify-center" style={{ perspective: 1000 }}>
        {deck.map((card, index) => {
          const isTop = index === deck.length - 1;
          return (
            <SwipeableCard
              key={card.id}
              card={card}
              isTop={isTop}
              index={index}
              total={deck.length}
              onSwipe={() => removeCard(card.id)}
            />
          );
        })}

        {deck.length === 0 && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            className="text-center"
          >
            <p className="text-6xl mb-4">🎉</p>
            <p className="text-xl font-bold font-display text-white mb-2">Pack Complete!</p>
            <p className="text-gray-400">
              You collected <span className="text-purple-400 font-bold">{collected.filter(c => c.type === "ingredient").length} ingredients</span> and <span className="text-amber-400 font-bold">{collected.filter(c => c.type === "recipe").length} recipes</span>
            </p>
          </motion.div>
        )}
      </div>

      {/* Swipe hint */}
      {deck.length > 0 && (
        <p className="text-gray-600 text-xs uppercase tracking-widest mt-4 animate-pulse">
          ← swipe to pass · swipe to collect →
        </p>
      )}
    </div>
  );
}

function SwipeableCard({ card, isTop, index, total, onSwipe }: {
  card: BoosterCard;
  isTop: boolean;
  index: number;
  total: number;
  onSwipe: () => void;
}) {
  const x = useMotionValue(0);
  const rotate = useTransform(x, [-200, 200], [-15, 15]);
  const opacity = useTransform(x, [-200, -100, 0, 100, 200], [0, 1, 1, 1, 0]);

  const handleDragEnd = (_event: any, info: any) => {
    if (Math.abs(info.offset.x) > 100) {
      onSwipe();
    }
  };

  const stackIndex = total - 1 - index;

  return (
    <motion.div
      className="absolute"
      style={{
        x: isTop ? x : 0,
        rotate: isTop ? rotate : 0,
        opacity: isTop ? opacity : 1,
        zIndex: index,
        scale: isTop ? 1 : 0.95 - stackIndex * 0.03,
        y: isTop ? 0 : stackIndex * 12,
      }}
      drag={isTop ? "x" : false}
      dragConstraints={{ left: 0, right: 0 }}
      onDragEnd={handleDragEnd}
      whileTap={{ cursor: "grabbing" }}
      animate={{
        scale: isTop ? 1 : 0.95 - stackIndex * 0.03,
        y: isTop ? 0 : stackIndex * 12,
      }}
      transition={{ duration: 0.3 }}
    >
      {card.type === "ingredient" ? (
        <IngredientCard
          name={card.name}
          category={card.category}
          rarity={card.rarity}
          isActiveGoal={card.isActiveGoal}
        />
      ) : (
        <RecipeCard
          title={card.title}
          difficulty={card.difficulty}
          dietaryTags={card.dietaryTags}
          ingredientCount={card.ingredientCount}
        />
      )}
    </motion.div>
  );
}
