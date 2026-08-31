import asyncio
import logging
import re
import json
import sys
from pathlib import Path
import requests
from bs4 import BeautifulSoup
from recipe_scrapers import scrape_me
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

if __package__ in (None, ""):
    project_root = Path(__file__).resolve().parent.parent
    if str(project_root) not in sys.path:
        sys.path.insert(0, str(project_root))

try:
    if __package__:
        from .models import Recipe, Ingredient, RecipeIngredient, UserInventory, User, RarityTier, Anomaly, AnomalyStatus
    else:
        from backend.models import Recipe, Ingredient, RecipeIngredient, UserInventory, User, RarityTier, Anomaly, AnomalyStatus
except ImportError:  # pragma: no cover - direct module execution fallback
    from backend.models import Recipe, Ingredient, RecipeIngredient, UserInventory, User, RarityTier, Anomaly, AnomalyStatus

logger = logging.getLogger(__name__)

MEASUREMENT_PREFIX_REGEX = re.compile(
    r'^(?:(?:\d+[\s\/\.\-]?\d*|\d+\/\d+|a|an|one|two|three|four|five|six|seven|eight|nine|ten|few|pinch|dash|handful)\s*)?'
    r'(?:(?:cup|cups|tbsp|tablespoon|tablespoons|tsp|teaspoon|teaspoons|oz|ounce|ounces|lb|lbs|pound|pounds|g|gram|grams|kg|ml|l|liter|liters|pinch|pinches|dash|dashes|slice|slices|clove|cloves|can|cans|package|packages|pkg|stalk|stalks|bunch|bunches|piece|pieces|head|heads|sprig|sprigs|fillet|fillets|rasher|rashers)\s+(?:of\s+)?)?',
    re.IGNORECASE
)

def clean_ingredient_name(raw: str) -> str:
    cleaned = MEASUREMENT_PREFIX_REGEX.sub('', raw.strip()).strip()
    # Remove descriptions after comma, e.g. "onions, finely chopped" -> "onions"
    if ',' in cleaned:
        cleaned = cleaned.split(',')[0].strip()
    # Remove parenthetical notes e.g. "flour (all purpose)" -> "flour"
    cleaned = re.sub(r'\(.*?\)', '', cleaned).strip()
    # Title case
    words = [w.capitalize() for w in cleaned.split() if w]
    result = " ".join(words)
    return result if len(result) >= 2 else raw.strip().title()

def guess_ingredient_category(name: str) -> str:
    name_l = name.lower()
    if any(w in name_l for w in ["beef", "chicken", "pork", "lamb", "steak", "bacon", "turkey", "duck", "sausage", "meat"]):
        return "Meat"
    if any(w in name_l for w in ["fish", "salmon", "tuna", "prawn", "shrimp", "cod", "crab", "lobster", "squid"]):
        return "Seafood"
    if any(w in name_l for w in ["basil", "oregano", "thyme", "rosemary", "parsley", "cilantro", "mint", "dill", "sage"]):
        return "Herb"
    if any(w in name_l for w in ["pepper", "salt", "cumin", "paprika", "cinnamon", "nutmeg", "turmeric", "saffron", "chili", "curry", "cardamom"]):
        return "Spice"
    if any(w in name_l for w in ["onion", "garlic", "tomato", "potato", "carrot", "broccoli", "spinach", "eggplant", "zucchini", "lettuce", "pepper", "cucumber", "mushroom", "celery", "cabbage", "pea", "bean"]):
        return "Vegetable"
    if any(w in name_l for w in ["apple", "lemon", "lime", "orange", "berry", "banana", "mango", "peach", "fruit", "avocado", "coconut"]):
        return "Fruit"
    if any(w in name_l for w in ["cheese", "milk", "butter", "cream", "yogurt", "egg"]):
        return "Dairy"
    if any(w in name_l for w in ["oil", "vinegar", "sauce", "mustard", "mayo", "ketchup", "honey", "syrup", "paste", "dressing"]):
        return "Condiment"
    if any(w in name_l for w in ["flour", "sugar", "rice", "pasta", "noodle", "bread", "oat", "yeast"]):
        return "Pantry"
    return "Miscellaneous"

def scrape_generic_fallback(url: str):
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    }
    resp = requests.get(url, headers=headers, timeout=10)
    resp.raise_for_status()
    soup = BeautifulSoup(resp.text, "html.parser")
    
    # Try Schema.org JSON-LD
    scripts = soup.find_all("script", type="application/ld+json")
    for script in scripts:
        try:
            if not script.string:
                continue
            data = json.loads(script.string)
            items = data if isinstance(data, list) else data.get("@graph", [data])
            for item in items:
                if isinstance(item, dict) and item.get("@type") in ["Recipe", "https://schema.org/Recipe"]:
                    title = item.get("name")
                    image = item.get("image")
                    if isinstance(image, list):
                        image = image[0]
                    elif isinstance(image, dict):
                        image = image.get("url")
                    ingredients = item.get("recipeIngredient", [])
                    instructions_raw = item.get("recipeInstructions", [])
                    instructions = ""
                    if isinstance(instructions_raw, list):
                        instructions = "\n".join(
                            step.get("text", str(step)) if isinstance(step, dict) else str(step)
                            for step in instructions_raw
                        )
                    elif isinstance(instructions_raw, str):
                        instructions = instructions_raw
                    if title and ingredients:
                        return {
                            "title": title,
                            "image": image,
                            "ingredients": ingredients,
                            "instructions": instructions
                        }
        except Exception:
            continue
            
    # Fallback to OpenGraph and meta
    title_tag = soup.find("meta", property="og:title") or soup.find("title")
    title = title_tag.get("content", title_tag.text) if title_tag else "Imported Web Recipe"
    img_tag = soup.find("meta", property="og:image")
    image = img_tag.get("content") if img_tag else None
    
    return {
        "title": title.split(" - ")[0].split(" | ")[0].strip(),
        "image": image,
        "ingredients": ["1 portion Assorted Fresh Ingredients"],
        "instructions": "Follow cooking steps from source URL: " + url
    }

async def process_recipe_url(url: str, user_id: int, db: AsyncSession):
    try:
        # Step 1: Attempt scraping
        title = None
        image_url = None
        ingredients_list = []
        instructions = ""
        
        try:
            scraper = await asyncio.to_thread(scrape_me, url)
            title = scraper.title()
            image_url = scraper.image()
            ingredients_list = scraper.ingredients()
            try:
                instructions = scraper.instructions()
            except Exception:
                instructions = ""
        except Exception as scrape_err:
            logger.warning(f"recipe_scrapers failed on {url}: {scrape_err}. Trying generic fallback...")
            fallback = await asyncio.to_thread(scrape_generic_fallback, url)
            title = fallback["title"]
            image_url = fallback["image"]
            ingredients_list = fallback["ingredients"]
            instructions = fallback["instructions"]

        if not title:
            raise ValueError(f"Could not extract recipe details from {url}")

        # Step 2: Check if recipe exists or create new
        existing_recipe_res = await db.execute(select(Recipe).filter(Recipe.title.ilike(title)))
        recipe = existing_recipe_res.scalars().first()
        
        difficulty = min(5, max(1, len(ingredients_list) // 3)) if ingredients_list else 3
        
        if not recipe:
            recipe = Recipe(
                title=title,
                image_url=image_url,
                instructions=instructions,
                difficulty=difficulty,
                dietary_tags=["Imported", "Web Recipe"],
                discovered_by_user_id=user_id
            )
            db.add(recipe)
            await db.flush()
        elif not recipe.discovered_by_user_id:
            recipe.discovered_by_user_id = user_id
            
        # Step 3: Fetch existing DB ingredients for matching
        all_db_ings_res = await db.execute(select(Ingredient))
        all_db_ings = all_db_ings_res.scalars().all()
        db_ings_by_name = {ing.name.lower(): ing for ing in all_db_ings}
        
        # User inventory lookup
        user_inv_res = await db.execute(select(UserInventory).filter(UserInventory.user_id == user_id))
        user_inv_map = {item.ingredient_id: item for item in user_inv_res.scalars().all()}
        
        unlocked_ingredients = []
        
        for raw_ing_str in ingredients_list:
            if not raw_ing_str or not raw_ing_str.strip():
                continue
                
            clean_name = clean_ingredient_name(raw_ing_str)
            clean_name_l = clean_name.lower()
            
            # Match or create Ingredient
            matched_ing = None
            # Direct match
            if clean_name_l in db_ings_by_name:
                matched_ing = db_ings_by_name[clean_name_l]
            else:
                # Substring match against existing DB ingredients
                for db_name_l, db_ing in db_ings_by_name.items():
                    if len(db_name_l) > 3 and (db_name_l in clean_name_l or clean_name_l in db_name_l):
                        matched_ing = db_ing
                        break
            
            # If still no match, create new Ingredient!
            if not matched_ing:
                category = guess_ingredient_category(clean_name)
                rarity = RarityTier.UNCOMMON if category in ["Herb", "Spice", "Seafood"] else RarityTier.COMMON
                matched_ing = Ingredient(
                    name=clean_name,
                    category=category,
                    rarity_tier=rarity,
                    description=f"Discovered by cooking {title}.",
                    origin="Global Recipe"
                )
                db.add(matched_ing)
                await db.flush()
                db_ings_by_name[clean_name.lower()] = matched_ing
            
            # Ensure RecipeIngredient link exists
            link_check = await db.execute(
                select(RecipeIngredient).filter(
                    RecipeIngredient.recipe_id == recipe.id,
                    RecipeIngredient.ingredient_id == matched_ing.id
                )
            )
            if not link_check.scalars().first():
                db.add(RecipeIngredient(
                    recipe_id=recipe.id,
                    ingredient_id=matched_ing.id,
                    quantity_desc=raw_ing_str[:100]
                ))
                
            # CRITICAL REQUIREMENT: Unlock ingredient in user's inventory
            is_new_to_user = matched_ing.id not in user_inv_map
            if is_new_to_user:
                new_inv = UserInventory(
                    user_id=user_id,
                    ingredient_id=matched_ing.id,
                    quantity=1
                )
                db.add(new_inv)
                user_inv_map[matched_ing.id] = new_inv
            else:
                user_inv_map[matched_ing.id].quantity += 1
                
            unlocked_ingredients.append({
                "id": matched_ing.id,
                "name": matched_ing.name,
                "category": matched_ing.category,
                "rarity": matched_ing.rarity_tier.value,
                "quantity": raw_ing_str,
                "is_new": is_new_to_user
            })
            
        # Step 4: Grant XP to user and record unlocked recipe
        from .models import UserUnlockedRecipe
        unlocked_check = await db.execute(
            select(UserUnlockedRecipe).filter(
                UserUnlockedRecipe.user_id == user_id,
                UserUnlockedRecipe.recipe_id == recipe.id
            )
        )
        if not unlocked_check.scalars().first():
            db.add(UserUnlockedRecipe(user_id=user_id, recipe_id=recipe.id))

        user_res = await db.execute(select(User).filter(User.id == user_id))
        user_obj = user_res.scalars().first()
        xp_gained = 50 + (len(unlocked_ingredients) * 15)
        if user_obj:
            user_obj.xp = (user_obj.xp or 0) + xp_gained
            user_obj.rank = max(user_obj.rank or 1, 1 + (user_obj.xp // 250))
            
        await db.commit()
        
        return {
            "status": "success",
            "recipe": {
                "id": recipe.id,
                "title": recipe.title,
                "image_url": recipe.image_url,
                "difficulty": recipe.difficulty,
                "instructions": recipe.instructions,
                "dietary_tags": recipe.dietary_tags or []
            },
            "unlocked_ingredients": unlocked_ingredients,
            "xp_gained": xp_gained,
            "message": f"Successfully scraped '{recipe.title}'! {len(unlocked_ingredients)} ingredients unlocked in your Dex!"
        }
        
    except Exception as e:
        logger.error(f"Failed to scrape recipe from {url}: {e}", exc_info=True)
        await db.rollback()
        raise e

