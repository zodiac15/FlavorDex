"""
FlavorDex Automated Web Crawler & Recipe Spider
Traverses the internet and open culinary repositories to harvest new recipes and ingredients,
normalizes culinary metadata, and populates the database automatically.
"""

import asyncio
import logging
import re
import random
import sys
from pathlib import Path
from typing import Optional, List, Dict, Any
from datetime import datetime, timezone

import aiohttp
from bs4 import BeautifulSoup
from recipe_scrapers import scrape_me
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import sessionmaker
from sqlalchemy import select, func

if __package__ in (None, ""):
    project_root = Path(__file__).resolve().parent.parent
    if str(project_root) not in sys.path:
        sys.path.insert(0, str(project_root))

try:
    if __package__:
        from .models import Recipe, Ingredient, RecipeIngredient, Anomaly, AnomalyStatus, RarityTier
        from .database import engine
    else:
        from backend.models import Recipe, Ingredient, RecipeIngredient, Anomaly, AnomalyStatus, RarityTier
        from backend.database import engine
except ImportError:
    sys.path.append(str(Path(__file__).parent))
    from backend.models import Recipe, Ingredient, RecipeIngredient, Anomaly, AnomalyStatus, RarityTier
    from backend.database import engine

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("flavordex.crawler")

# Seed categories and culinary hubs
CULINARY_AREAS = [
    "Italian", "Mexican", "Japanese", "Indian", "Chinese", "French", 
    "Thai", "Spanish", "Greek", "Moroccan", "Jamaican", "British", 
    "American", "Vietnamese", "Turkish", "Korean", "Portuguese", "Egyptian"
]

COMMON_UNITS = [
    "cup", "cups", "tbsp", "tablespoon", "tablespoons", "tsp", "teaspoon", "teaspoons",
    "oz", "ounce", "ounces", "lb", "lbs", "pound", "pounds", "g", "gram", "grams",
    "kg", "ml", "liter", "liters", "pinch", "dash", "clove", "cloves", "slice", "slices",
    "piece", "pieces", "can", "cans", "package", "packages", "handful", "bunch", "sprig", "sprigs"
]

DESCRIPTORS = [
    "fresh", "freshly", "ground", "chopped", "diced", "minced", "sliced", "peeled",
    "crushed", "grated", "shredded", "cooked", "uncooked", "raw", "organic", "dried",
    "whole", "large", "medium", "small", "thinly", "finely", "roughly", "boneless",
    "skinless", "extra", "virgin", "warm", "cold", "hot", "melted", "softened", "frozen"
]

def clean_ingredient_name(raw_text: str) -> str:
    """Extracts a clean, canonical ingredient name from noisy recipe strings."""
    if not raw_text:
        return "Unknown Ingredient"
    
    text = raw_text.lower().strip()
    # Remove contents inside parentheses
    text = re.sub(r'\(.*?\)', '', text)
    # Remove numbers and fractions
    text = re.sub(r'[\d/\.\-\,\:]+', ' ', text)
    
    words = [w.strip() for w in text.split() if w.strip()]
    filtered = [w for w in words if w not in COMMON_UNITS and w not in DESCRIPTORS and len(w) > 2]
    
    if not filtered:
        return raw_text.strip().title()[:40]
    
    # Return Title Cased canonical name
    return " ".join(filtered[:3]).title()

def guess_ingredient_category(name: str) -> str:
    """Classifies an ingredient into a standard culinary Dex category."""
    n = name.lower()
    if any(k in n for k in ["beef", "chicken", "pork", "lamb", "duck", "turkey", "bacon", "sausage", "veal", "steak"]):
        return "Meat"
    if any(k in n for k in ["fish", "salmon", "tuna", "prawn", "shrimp", "crab", "lobster", "cod", "halibut", "squid", "anchovy"]):
        return "Seafood"
    if any(k in n for k in ["onion", "garlic", "tomato", "potato", "carrot", "pepper", "spinach", "broccoli", "mushroom", "celery", "cabbage", "zucchini", "lettuce", "cucumber", "eggplant", "pea", "corn", "bean"]):
        return "Vegetable"
    if any(k in n for k in ["apple", "banana", "lemon", "lime", "orange", "berry", "mango", "avocado", "pineapple", "coconut", "peach", "grape", "cherry"]):
        return "Fruit"
    if any(k in n for k in ["basil", "parsley", "cilantro", "thyme", "rosemary", "oregano", "mint", "dill", "sage", "tarragon", "chive"]):
        return "Herb"
    if any(k in n for k in ["cumin", "paprika", "cinnamon", "turmeric", "coriander", "cardamom", "nutmeg", "ginger", "curry", "clove", "pepper", "saffron", "chili", "vanilla"]):
        return "Spice"
    if any(k in n for k in ["milk", "cheese", "butter", "cream", "yogurt", "egg", "cheddar", "parmesan", "mozzarella", "ricotta"]):
        return "Dairy"
    if any(k in n for k in ["sauce", "oil", "vinegar", "mustard", "mayonnaise", "ketchup", "honey", "syrup", "paste", "soy", "tamari"]):
        return "Condiment"
    return "Pantry"

def assign_rarity() -> RarityTier:
    """Randomly assigns weighted trading card rarity."""
    weights = [
        (RarityTier.COMMON, 50),
        (RarityTier.UNCOMMON, 25),
        (RarityTier.RARE, 15),
        (RarityTier.EPIC, 7),
        (RarityTier.LEGENDARY, 2.5),
        (RarityTier.MYTHIC, 0.5),
    ]
    tiers, probs = zip(*weights)
    return random.choices(tiers, weights=probs, k=1)[0]


class RecipeSpider:
    def __init__(self):
        self.is_running = False
        self.should_stop = False
        self.stats = {
            "status": "idle",
            "recipes_harvested": 0,
            "ingredients_added": 0,
            "anomalies_flagged": 0,
            "current_target": "None",
            "started_at": None,
            "logs": []
        }
        self.async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    def log(self, message: str):
        timestamp = datetime.now().strftime("%H:%M:%S")
        entry = f"[{timestamp}] {message}"
        logger.info(entry)
        self.stats["logs"].append(entry)
        if len(self.stats["logs"]) > 50:
            self.stats["logs"].pop(0)

    async def start_crawl(self, limit: int = 25, category: Optional[str] = None):
        if self.is_running:
            return {"status": "already_running", "message": "Spider is already active"}
        
        self.is_running = True
        self.should_stop = False
        self.stats["status"] = "crawling"
        self.stats["started_at"] = datetime.now(timezone.utc).isoformat()
        self.stats["recipes_harvested"] = 0
        self.stats["ingredients_added"] = 0
        self.stats["anomalies_flagged"] = 0
        self.log(f"🕷️ Web Spider launched. Target limit: {limit} recipes.")

        # Run the crawl task asynchronously in background
        asyncio.create_task(self._run_crawl_pipeline(limit, category))
        return {"status": "started", "message": "Crawler pipeline started in background"}

    def stop_crawl(self):
        if not self.is_running:
            return {"status": "not_running", "message": "Spider is not currently active"}
        self.should_stop = True
        self.log("🛑 Stop signal sent to Web Spider...")
        return {"status": "stopping", "message": "Crawler is shutting down gracefully"}

    async def _run_crawl_pipeline(self, limit: int, target_area: Optional[str]):
        try:
            async with aiohttp.ClientSession() as http_session:
                areas = [target_area] if target_area and target_area != "all" else CULINARY_AREAS
                random.shuffle(areas)

                for area in areas:
                    if self.should_stop or self.stats["recipes_harvested"] >= limit:
                        break

                    self.stats["current_target"] = f"Cuisine: {area}"
                    self.log(f"🔍 Searching culinary sector: {area}...")

                    # Fetch list of meals for this area
                    url = f"https://www.themealdb.com/api/json/v1/1/filter.php?a={area}"
                    try:
                        async with http_session.get(url, timeout=10) as resp:
                            if resp.status != 200:
                                continue
                            data = await resp.json()
                            meals = data.get("meals") or []
                    except Exception as e:
                        self.log(f"⚠️ Error querying sector {area}: {e}")
                        continue

                    random.shuffle(meals)

                    for meal_stub in meals:
                        if self.should_stop or self.stats["recipes_harvested"] >= limit:
                            break

                        meal_id = meal_stub.get("idMeal")
                        if not meal_id:
                            continue

                        # Fetch full recipe details
                        detail_url = f"https://www.themealdb.com/api/json/v1/1/lookup.php?i={meal_id}"
                        try:
                            async with http_session.get(detail_url, timeout=10) as detail_resp:
                                if detail_resp.status != 200:
                                    continue
                                detail_data = await detail_resp.json()
                                meal_list = detail_data.get("meals") or []
                                if not meal_list:
                                    continue
                                meal = meal_list[0]
                        except Exception as e:
                            self.log(f"⚠️ Error fetching recipe ID {meal_id}: {e}")
                            continue

                        # Ingest into database
                        await self._ingest_meal(meal, area)
                        # Polite crawler pacing
                        await asyncio.sleep(0.4)

        except Exception as err:
            self.log(f"❌ Fatal error in crawler pipeline: {err}")
            logger.error("Crawler crash", exc_info=True)
        finally:
            self.is_running = False
            self.stats["status"] = "idle"
            self.stats["current_target"] = "None"
            self.log(f"✨ Spider finished. Harvested {self.stats['recipes_harvested']} recipes, cataloged {self.stats['ingredients_added']} new ingredients.")

    async def _ingest_meal(self, meal: dict, area: str):
        title = (meal.get("strMeal") or "").strip()
        if not title:
            return

        instructions = meal.get("strInstructions") or ""
        image_url = meal.get("strMealThumb") or None
        category_tag = meal.get("strCategory") or "Main"

        dietary_tags = [area, category_tag]

        async with self.async_session() as db:
            # Check duplicate recipe
            existing = await db.execute(select(Recipe).filter(Recipe.title.ilike(title)))
            if existing.scalars().first():
                self.log(f"⏭️ Skipping duplicate: '{title}'")
                return

            # Extract raw ingredients and quantities
            extracted_ingredients = []
            for i in range(1, 21):
                raw_name = (meal.get(f"strIngredient{i}") or "").strip()
                raw_measure = (meal.get(f"strMeasure{i}") or "").strip()
                if raw_name:
                    extracted_ingredients.append((raw_name, raw_measure))

            difficulty = min(5, max(1, len(extracted_ingredients) // 3)) if extracted_ingredients else 3

            new_recipe = Recipe(
                title=title,
                instructions=instructions,
                image_url=image_url,
                difficulty=difficulty,
                dietary_tags=dietary_tags
            )
            db.add(new_recipe)
            await db.flush()

            # Load all ingredients for matching
            all_ings_res = await db.execute(select(Ingredient))
            db_ings = all_ings_res.scalars().all()
            ing_map = {ing.name.lower(): ing for ing in db_ings}

            for raw_name, raw_measure in extracted_ingredients:
                clean_name = clean_ingredient_name(raw_name)
                matched_ing = ing_map.get(raw_name.lower()) or ing_map.get(clean_name.lower())

                if not matched_ing:
                    # Search substring match
                    for key, ing_obj in ing_map.items():
                        if clean_name.lower() in key or key in clean_name.lower():
                            matched_ing = ing_obj
                            break

                if not matched_ing:
                    # New ingredient discovered!
                    cat = guess_ingredient_category(clean_name)
                    matched_ing = Ingredient(
                        name=clean_name,
                        category=cat,
                        rarity_tier=assign_rarity(),
                        description=f"Authentic culinary ingredient discovered via {area} cuisine.",
                        origin=area,
                        image_url=f"https://www.themealdb.com/images/ingredients/{clean_name.replace(' ', '%20')}.png"
                    )
                    db.add(matched_ing)
                    await db.flush()
                    ing_map[clean_name.lower()] = matched_ing
                    self.stats["ingredients_added"] += 1
                    self.log(f"🌱 Cataloged new ingredient: '{clean_name}' [{cat}]")

                # Link recipe with ingredient
                db.add(RecipeIngredient(
                    recipe_id=new_recipe.id,
                    ingredient_id=matched_ing.id,
                    quantity_desc=raw_measure or "To taste"
                ))

            await db.commit()
            self.stats["recipes_harvested"] += 1
            self.log(f"🍳 Successfully harvested: '{title}' ({len(extracted_ingredients)} ingredients)")


# Global Spider instance
spider_instance = RecipeSpider()

if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser(description="FlavorDex Recipe Spider")
    parser.add_argument("--limit", type=int, default=10, help="Number of recipes to harvest")
    parser.add_argument("--area", type=str, default=None, help="Specific culinary region")
    args = parser.parse_args()

    spider = RecipeSpider()
    asyncio.run(spider._run_crawl_pipeline(limit=args.limit, target_area=args.area))

