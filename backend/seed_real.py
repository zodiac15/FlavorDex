import asyncio
import aiohttp
import random
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import sessionmaker
from sqlalchemy import select
from models import Ingredient, Recipe, RecipeIngredient, RarityTier, Base
from database import engine

async def get_all_ingredients(session: aiohttp.ClientSession):
    async with session.get('https://www.themealdb.com/api/json/v1/1/list.php?i=list') as resp:
        data = await resp.json()
        return data.get('meals', [])

async def get_random_recipe(session: aiohttp.ClientSession):
    async with session.get('https://www.themealdb.com/api/json/v1/1/random.php') as resp:
        data = await resp.json()
        if data and data.get('meals'):
            return data['meals'][0]
        return None

async def seed_real_data():
    async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    
    # We will use aiohttp to make concurrent requests where possible
    async with aiohttp.ClientSession() as http_session:
        print("Fetching real ingredients from TheMealDB...")
        raw_ingredients = await get_all_ingredients(http_session)
        
        async with async_session() as db:
            # Check existing ingredients so we don't duplicate
            existing_result = await db.execute(select(Ingredient.name))
            existing_names = set(row[0].lower() for row in existing_result.fetchall())
            
            new_ingredients_count = 0
            db_ingredients_map = {}
            
            print(f"Found {len(raw_ingredients)} ingredients. Inserting...")
            
            for item in raw_ingredients:
                name = item.get('strIngredient', '').strip()
                if not name or name.lower() in existing_names:
                    continue
                
                desc = item.get('strDescription')
                if desc and len(desc) > 500:
                    desc = desc[:497] + "..."
                    
                category = item.get('strType') or "Miscellaneous"
                
                # Assign random rarity, weighted towards common
                rarities = [
                    RarityTier.COMMON, RarityTier.COMMON, RarityTier.COMMON, 
                    RarityTier.UNCOMMON, RarityTier.UNCOMMON, 
                    RarityTier.RARE, 
                    RarityTier.EPIC, 
                    RarityTier.LEGENDARY, 
                    RarityTier.MYTHIC
                ]
                
                ing = Ingredient(
                    name=name,
                    description=desc,
                    category=category[:50],
                    rarity_tier=random.choice(rarities),
                    image_url=f"https://www.themealdb.com/images/ingredients/{name.replace(' ', '%20')}.png"
                )
                db.add(ing)
                new_ingredients_count += 1
                existing_names.add(name.lower())
            
            await db.commit()
            print(f"Inserted {new_ingredients_count} new ingredients.")
            
            # Reload all ingredients into a map for fast lookup
            all_ings = await db.execute(select(Ingredient))
            for ing in all_ings.scalars().all():
                db_ingredients_map[ing.name.lower()] = ing
            
            print("Fetching 120 random recipes...")
            # Fetch 120 recipes
            recipes_to_fetch = 120
            inserted_recipes = 0
            
            # Fetch in batches of 10 to avoid hammering the API too hard but stay fast
            for i in range(0, recipes_to_fetch, 10):
                tasks = [get_random_recipe(http_session) for _ in range(10)]
                meals = await asyncio.gather(*tasks)
                
                for meal in meals:
                    if not meal:
                        continue
                    
                    title = meal.get('strMeal')
                    
                    # Check if recipe exists
                    check = await db.execute(select(Recipe).filter_by(title=title))
                    if check.scalars().first():
                        continue
                        
                    instructions = meal.get('strInstructions')
                    image_url = meal.get('strMealThumb')
                    category = meal.get('strCategory')
                    
                    recipe = Recipe(
                        title=title,
                        instructions=instructions,
                        image_url=image_url,
                        difficulty=random.randint(2, 5),
                        dietary_tags=[category] if category else []
                    )
                    
                    db.add(recipe)
                    await db.flush() # get recipe ID
                    
                    # Process 1-20 ingredients
                    for j in range(1, 21):
                        ing_name = meal.get(f'strIngredient{j}')
                        ing_measure = meal.get(f'strMeasure{j}')
                        
                        if ing_name and ing_name.strip():
                            ing_name = ing_name.strip().lower()
                            # Lookup ingredient
                            db_ing = db_ingredients_map.get(ing_name)
                            if db_ing:
                                ri = RecipeIngredient(
                                    recipe_id=recipe.id,
                                    ingredient_id=db_ing.id,
                                    quantity_desc=ing_measure.strip() if ing_measure else ""
                                )
                                db.add(ri)
                    inserted_recipes += 1
                
                await db.commit()
                print(f"Batch {i//10 + 1}/12 processed...")
            
            print(f"Successfully inserted {inserted_recipes} real recipes with ingredient relationships!")

if __name__ == "__main__":
    asyncio.run(seed_real_data())
