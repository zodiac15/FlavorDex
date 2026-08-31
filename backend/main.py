import os
import sys
from pathlib import Path
from contextlib import asynccontextmanager
from fastapi import FastAPI, Depends, HTTPException, status, Header
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

if __package__ in (None, ""):
    project_root = Path(__file__).resolve().parent.parent
    if str(project_root) not in sys.path:
        sys.path.insert(0, str(project_root))

try:
    if __package__:
        from .database import engine, get_db
        from .models import Base, User, UserRole
        from .auth import get_password_hash, verify_password, create_access_token, get_current_active_user, get_current_moderator, ACCESS_TOKEN_EXPIRE_MINUTES, SECRET_KEY, ALGORITHM
    else:
        from backend.database import engine, get_db
        from backend.models import Base, User, UserRole
        from backend.auth import get_password_hash, verify_password, create_access_token, get_current_active_user, get_current_moderator, ACCESS_TOKEN_EXPIRE_MINUTES, SECRET_KEY, ALGORITHM
except ImportError:  # pragma: no cover - supports direct module execution in local dev
    from backend.database import engine, get_db
    from backend.models import Base, User, UserRole
    from backend.auth import get_password_hash, verify_password, create_access_token, get_current_active_user, get_current_moderator, ACCESS_TOKEN_EXPIRE_MINUTES, SECRET_KEY, ALGORITHM

import jwt
from fastapi.middleware.cors import CORSMiddleware
from datetime import timedelta

allowed_origins = [
    origin.strip()
    for origin in os.getenv("CORS_ORIGINS", "http://localhost:3000,http://127.0.0.1:3000").split(",")
    if origin.strip()
]

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Create tables automatically for development.
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield

app = FastAPI(title="FlavorDex API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.post("/register", status_code=status.HTTP_201_CREATED)
async def register(
    username: str, 
    email: str, 
    password: str, 
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(select(User).filter((User.username == username) | (User.email == email)))
    if result.scalars().first():
        raise HTTPException(status_code=400, detail="Username or Email already registered")
        
    new_user = User(
        username=username,
        email=email,
        auth_hash=get_password_hash(password)
    )
    db.add(new_user)
    await db.commit()
    return {"message": "User registered successfully"}

@app.post("/token")
async def login_for_access_token(
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(select(User).filter(User.username == form_data.username))
    user = result.scalars().first()
    if not user or not verify_password(form_data.password, user.auth_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": user.username, "role": user.role.value}, expires_delta=access_token_expires
    )
    return {"access_token": access_token, "token_type": "bearer"}

@app.get("/users/me")
async def read_users_me(current_user: User = Depends(get_current_active_user)):
    return {
        "id": current_user.id,
        "username": current_user.username,
        "email": current_user.email,
        "role": current_user.role.value,
        "xp": current_user.xp,
        "rank": current_user.rank
    }

from sqlalchemy import func

try:
    from .models import Ingredient, Recipe, RecipeIngredient
except ImportError:  # pragma: no cover - direct module execution fallback
    from models import Ingredient, Recipe, RecipeIngredient

@app.get("/admin/stats")
async def get_admin_stats(db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_moderator)):
    users_count = await db.scalar(select(func.count()).select_from(User))
    ingredients_count = await db.scalar(select(func.count()).select_from(Ingredient))
    recipes_count = await db.scalar(select(func.count()).select_from(Recipe))
    return {
        "total_users": users_count,
        "total_ingredients": ingredients_count,
        "total_recipes": recipes_count
    }

@app.get("/admin/users")
async def get_admin_users(db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_moderator)):
    result = await db.execute(select(User).order_by(User.id.desc()).limit(100))
    users = result.scalars().all()
    return [{"id": u.id, "username": u.username, "email": u.email, "role": u.role.value, "xp": u.xp, "rank": u.rank} for u in users]

@app.get("/admin/ingredients")
async def get_admin_ingredients(db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_moderator)):
    result = await db.execute(select(Ingredient).order_by(Ingredient.id.desc()).limit(100))
    ings = result.scalars().all()
    return [{"id": i.id, "name": i.name, "description": i.description, "category": i.category, "rarity": i.rarity_tier.value, "origin": i.origin} for i in ings]

from sqlalchemy.orm import selectinload

@app.get("/admin/recipes")
async def get_admin_recipes(db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_moderator)):
    # Eager load the ingredients relationship so we can include it in the response
    result = await db.execute(select(Recipe).options(selectinload(Recipe.ingredients).selectinload(RecipeIngredient.ingredient)).order_by(Recipe.id.desc()).limit(100))
    recs = result.scalars().all()
    return [{
        "id": r.id, 
        "title": r.title, 
        "instructions": r.instructions,
        "difficulty": r.difficulty, 
        "dietary_tags": r.dietary_tags or [],
        "ingredients": [
            {
                "id": ri.ingredient.id,
                "name": ri.ingredient.name,
                "quantity": ri.quantity_desc
            } for ri in r.ingredients
        ]
    } for r in recs]
from pydantic import BaseModel
from fastapi import BackgroundTasks

try:
    if __package__:
        from .scraper import process_recipe_url
    else:
        from backend.scraper import process_recipe_url
except ImportError:  # pragma: no cover - direct module execution fallback
    from backend.scraper import process_recipe_url

class RecipeSubmitRequest(BaseModel):
    url: str

@app.post("/recipes/submit")
async def submit_recipe(
    request: RecipeSubmitRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    try:
        result = await process_recipe_url(request.url, current_user.id, db)
        return result
    except Exception as e:
        raise HTTPException(
            status_code=400,
            detail=f"Failed to scrape recipe from provided URL: {str(e)}"
        )

@app.get("/users/me/discovered-recipes")
async def get_user_discovered_recipes(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    result = await db.execute(
        select(Recipe)
        .options(selectinload(Recipe.ingredients).selectinload(RecipeIngredient.ingredient))
        .filter(Recipe.discovered_by_user_id == current_user.id)
        .order_by(Recipe.id.desc())
    )
    recs = result.scalars().all()
    return [{
        "id": r.id, 
        "title": r.title, 
        "instructions": r.instructions,
        "difficulty": r.difficulty or 3, 
        "dietary_tags": r.dietary_tags or [],
        "image_url": r.image_url,
        "ingredients": [
            {
                "id": ri.ingredient.id,
                "name": ri.ingredient.name,
                "quantity": ri.quantity_desc,
                "category": ri.ingredient.category,
                "rarity": ri.ingredient.rarity_tier.value
            } for ri in r.ingredients if ri.ingredient
        ]
    } for r in recs]

try:
    from .models import UserInventory, UserActiveGoal
except ImportError:  # pragma: no cover - direct module execution fallback
    from models import UserInventory, UserActiveGoal
import random

@app.get("/ingredients")
async def get_all_ingredients(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Ingredient).order_by(Ingredient.id.desc()).limit(200))
    ings = result.scalars().all()
    return [{"id": i.id, "name": i.name, "description": i.description, "category": i.category, "rarity": i.rarity_tier.value, "origin": i.origin, "image_url": i.image_url} for i in ings]

from sqlalchemy import or_, and_
from typing import Optional

@app.get("/recipes/categories")
async def get_recipe_categories(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Recipe.dietary_tags).filter(Recipe.dietary_tags.isnot(None)))
    rows = result.scalars().all()
    categories = set()
    for row in rows:
        if isinstance(row, list):
            for item in row:
                if item and str(item).strip():
                    categories.add(str(item).strip())
    return sorted(list(categories))

@app.get("/recipes")
async def get_all_recipes(
    q: Optional[str] = None,
    ingredient: Optional[str] = None,
    category: Optional[str] = None,
    difficulty: Optional[int] = None,
    limit: int = 150,
    offset: int = 0,
    authorization: Optional[str] = Header(None),
    db: AsyncSession = Depends(get_db)
):
    current_user_id = None
    if authorization and authorization.startswith("Bearer "):
        token = authorization.split(" ")[1]
        try:
            payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
            username: str = payload.get("sub")
            if username:
                user_res = await db.execute(select(User).filter(User.username == username))
                u = user_res.scalars().first()
                if u:
                    current_user_id = u.id
        except Exception:
            pass

    try:
        if __package__:
            from .models import UserUnlockedRecipe, UserInventory
        else:
            from backend.models import UserUnlockedRecipe, UserInventory
    except ImportError:  # pragma: no cover - direct module execution fallback
        from backend.models import UserUnlockedRecipe, UserInventory
    unlocked_recipe_ids = set()
    user_inventory_ing_ids = set()
    if current_user_id:
        unlocked_res = await db.execute(
            select(UserUnlockedRecipe.recipe_id).filter(UserUnlockedRecipe.user_id == current_user_id)
        )
        unlocked_recipe_ids = set(unlocked_res.scalars().all())

        inv_res = await db.execute(
            select(UserInventory.ingredient_id).filter(UserInventory.user_id == current_user_id)
        )
        user_inventory_ing_ids = set(inv_res.scalars().all())

    query = select(Recipe).options(selectinload(Recipe.ingredients).selectinload(RecipeIngredient.ingredient))
    
    conditions = []
    if q and q.strip():
        search_pattern = f"%{q.strip()}%"
        conditions.append(
            or_(
                Recipe.title.ilike(search_pattern),
                Recipe.instructions.ilike(search_pattern),
                Recipe.ingredients.any(
                    RecipeIngredient.ingredient.has(Ingredient.name.ilike(search_pattern))
                )
            )
        )
    
    if ingredient and ingredient.strip():
        conditions.append(
            Recipe.ingredients.any(
                RecipeIngredient.ingredient.has(Ingredient.name.ilike(f"%{ingredient.strip()}%"))
            )
        )
        
    if difficulty and difficulty > 0:
        conditions.append(Recipe.difficulty == difficulty)
        
    if conditions:
        query = query.filter(and_(*conditions))
        
    query = query.order_by(Recipe.id.desc()).offset(offset).limit(limit)
    result = await db.execute(query)
    recs = result.scalars().all()
    
    if category and category.lower() != "all":
        cat_lower = category.lower()
        recs = [
            r for r in recs 
            if r.dietary_tags and any(cat_lower in str(tag).lower() for tag in r.dietary_tags)
        ]
        
    formatted_recipes = []
    for r in recs:
        is_unlocked = bool(
            (r.id in unlocked_recipe_ids) or 
            (current_user_id and r.discovered_by_user_id == current_user_id)
        )
        
        valid_ings = [ri for ri in r.ingredients if ri.ingredient]
        total_count = len(valid_ings)
        
        # Real owned count based on user's actual inventory
        owned_count = sum(1 for ri in valid_ings if ri.ingredient_id in user_inventory_ing_ids)
        
        if is_unlocked:
            instructions_text = r.instructions or "No instructions available."
            ingredients_data = [
                {
                    "id": ri.ingredient.id,
                    "name": ri.ingredient.name,
                    "quantity": ri.quantity_desc,
                    "category": ri.ingredient.category,
                    "rarity": ri.ingredient.rarity_tier.value,
                    "owned": ri.ingredient_id in user_inventory_ing_ids,
                    "locked": False
                } for ri in valid_ings
            ]
            revealed_count = total_count
            locked_count = 0
        else:
            # Partial Recipe Mode: Reveal only the first 2 ingredients as teasers
            revealed_ings = valid_ings[:2]
            hidden_ings_count = max(0, total_count - len(revealed_ings))
            
            ingredients_data = [
                {
                    "id": ri.ingredient.id,
                    "name": ri.ingredient.name,
                    "quantity": ri.quantity_desc,
                    "category": ri.ingredient.category,
                    "rarity": ri.ingredient.rarity_tier.value,
                    "owned": ri.ingredient_id in user_inventory_ing_ids,
                    "locked": False
                } for ri in revealed_ings
            ]
            
            # Add placeholders for locked mystery ingredients
            for idx in range(hidden_ings_count):
                ingredients_data.append({
                    "id": -(idx + 1),
                    "name": "??? Mystery Ingredient",
                    "quantity": "Hidden",
                    "category": "Mystery",
                    "rarity": "rare",
                    "owned": False,
                    "locked": True
                })
                
            revealed_count = len(revealed_ings)
            locked_count = hidden_ings_count
            
            # Teaser instructions preview
            raw_inst = r.instructions or "Prepare the ingredients and assemble the dish."
            teaser_sample = raw_inst[:120].strip()
            if len(raw_inst) > 120:
                teaser_sample += "..."
            instructions_text = (
                f"{teaser_sample}\n\n"
                f"🔒 [Complete Cooking Instructions Locked]\n"
                f"Search the web for '{r.title}' and import its recipe link into The Kitchen to unlock full instructions and all {total_count} ingredients!"
            )
            
        formatted_recipes.append({
            "id": r.id, 
            "title": r.title, 
            "instructions": instructions_text,
            "difficulty": r.difficulty or 3, 
            "dietary_tags": r.dietary_tags or [],
            "image_url": r.image_url,
            "is_unlocked": is_unlocked,
            "total_ingredients_count": total_count,
            "owned_ingredients_count": owned_count,
            "revealed_count": revealed_count,
            "locked_count": locked_count,
            "ingredients": ingredients_data
        })
        
    return formatted_recipes

@app.get("/users/me/inventory")
async def get_user_inventory(db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_active_user)):
    result = await db.execute(select(UserInventory).options(selectinload(UserInventory.ingredient)).filter(UserInventory.user_id == current_user.id))
    inv = result.scalars().all()
    return [{"id": i.ingredient.id, "name": i.ingredient.name, "quantity": i.quantity, "rarity": i.ingredient.rarity_tier.value, "category": i.ingredient.category} for i in inv]

@app.post("/users/me/booster")
async def open_booster_pack(db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_active_user)):
    # Give user 3 random ingredients
    result = await db.execute(select(Ingredient).order_by(func.random()).limit(3))
    ings = result.scalars().all()
    
    awarded = []
    for ing in ings:
        # Check if already in inventory
        existing = await db.execute(select(UserInventory).filter(UserInventory.user_id == current_user.id, UserInventory.ingredient_id == ing.id))
        inv_item = existing.scalars().first()
        if inv_item:
            inv_item.quantity += 1
        else:
            db.add(UserInventory(user_id=current_user.id, ingredient_id=ing.id, quantity=1))
        awarded.append({"id": ing.id, "name": ing.name, "category": ing.category, "rarity": ing.rarity_tier.value})
    
    current_user.xp += 10
    await db.commit()
    return {"message": "Pack opened!", "cards": awarded, "xp_gained": 10}

@app.get("/public/stats")
async def get_public_stats(db: AsyncSession = Depends(get_db)):
    ingredients_count = await db.scalar(select(func.count(Ingredient.id)))
    recipes_count = await db.scalar(select(func.count(Recipe.id)))
    users_count = await db.scalar(select(func.count(User.id)))
    return {
        "ingredients": ingredients_count,
        "recipes": recipes_count,
        "users": users_count,
    }

@app.get("/users/me/activity")
async def get_user_activity(db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_active_user)):
    activities = []
    
    # Get recent unlocked recipes
    unlocked_res = await db.execute(
        select(UserUnlockedRecipe)
        .options(selectinload(UserUnlockedRecipe.recipe))
        .filter(UserUnlockedRecipe.user_id == current_user.id)
        .order_by(UserUnlockedRecipe.unlocked_at.desc())
        .limit(5)
    )
    for u in unlocked_res.scalars().all():
        activities.append({
            "id": f"unlocked_{u.id}",
            "text": f"Unlocked '{u.recipe.title}'",
            "time": u.unlocked_at.strftime("%b %d, %Y"),
            "type": "pack",
            "sort_time": u.unlocked_at
        })

    # Get recent anomalies submitted
    anomalies_res = await db.execute(
        select(Anomaly)
        .filter(Anomaly.submitter_user_id == current_user.id)
        .order_by(Anomaly.created_at.desc())
        .limit(5)
    )
    for a in anomalies_res.scalars().all():
        activities.append({
            "id": f"anomaly_{a.id}",
            "text": f"Found anomaly: {a.scraped_name}",
            "time": a.created_at.strftime("%b %d, %Y"),
            "type": "xp",
            "sort_time": a.created_at
        })

    activities.sort(key=lambda x: x["sort_time"], reverse=True)
    return activities[:5]

@app.get("/users/me/goals")
async def get_user_goals(db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_active_user)):
    result = await db.execute(
        select(UserActiveGoal)
        .options(
            selectinload(UserActiveGoal.recipe)
            .selectinload(Recipe.ingredients)
            .selectinload(RecipeIngredient.ingredient)
        )
        .filter(UserActiveGoal.user_id == current_user.id)
    )
    goals = result.scalars().all()
    if not goals:
        return []
    
    # Load user inventory
    inv_res = await db.execute(select(UserInventory.ingredient_id).filter(UserInventory.user_id == current_user.id))
    owned_ids = set(inv_res.scalars().all())
    
    output = []
    for g in goals:
        if not g.recipe:
            continue
        valid_ings = [ri for ri in g.recipe.ingredients if ri.ingredient]
        total = len(valid_ings)
        current = sum(1 for ri in valid_ings if ri.ingredient_id in owned_ids)
        output.append({
            "id": g.id,
            "recipe_id": g.recipe.id,
            "name": g.recipe.title,
            "current": current,
            "total": total,
            "color": "from-emerald-500 to-teal-400" if current >= total and total > 0 else "from-purple-500 to-pink-500"
        })
    return output

@app.post("/users/me/goals/{recipe_id}")
async def toggle_user_goal(recipe_id: int, db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_active_user)):
    existing = await db.execute(select(UserActiveGoal).filter(UserActiveGoal.user_id == current_user.id, UserActiveGoal.recipe_id == recipe_id))
    goal = existing.scalars().first()
    if goal:
        await db.delete(goal)
        await db.commit()
        return {"action": "removed", "message": "Removed from Active Goals"}
    else:
        new_goal = UserActiveGoal(user_id=current_user.id, recipe_id=recipe_id)
        db.add(new_goal)
        await db.commit()
        return {"action": "added", "message": "Added to Active Goals"}

@app.get("/users/me/stats")
async def get_user_stats(db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_active_user)):
    # Calculate real user stats
    cards_result = await db.execute(select(func.sum(UserInventory.quantity)).filter(UserInventory.user_id == current_user.id))
    total_cards = cards_result.scalar() or 0
    
    recipes_result = await db.execute(select(func.count()).select_from(UserUnlockedRecipe).filter(UserUnlockedRecipe.user_id == current_user.id))
    total_recipes = recipes_result.scalar() or 0
    
    anomalies_result = await db.execute(select(func.count()).select_from(Anomaly).filter(Anomaly.submitter_user_id == current_user.id))
    total_anomalies = anomalies_result.scalar() or 0
    
    return {
        "cards_collected": total_cards,
        "recipes_unlocked": total_recipes,
        "anomalies_found": total_anomalies,
        "trades_completed": 0,
        "streak": 0
    }

try:
    if __package__:
        from .models import Anomaly, AnomalyStatus
    else:
        from backend.models import Anomaly, AnomalyStatus
except ImportError:  # pragma: no cover - direct module execution fallback
    from backend.models import Anomaly, AnomalyStatus

class AnomalySubmitRequest(BaseModel):
    name: str
    source_url: Optional[str] = None
    notes: Optional[str] = None

class FlavorPairingRequest(BaseModel):
    ingredients: list[str]

@app.get("/anomalies/stats")
async def get_anomaly_stats(db: AsyncSession = Depends(get_db)):
    pending_count = await db.scalar(select(func.count()).select_from(Anomaly).filter(Anomaly.status == AnomalyStatus.PENDING)) or 0
    approved_count = await db.scalar(select(func.count()).select_from(Anomaly).filter(Anomaly.status == AnomalyStatus.APPROVED)) or 0
    total_count = await db.scalar(select(func.count()).select_from(Anomaly)) or 0
    total_ingredients = await db.scalar(select(func.count()).select_from(Ingredient)) or 0
    return {
        "pending_count": pending_count,
        "approved_count": approved_count,
        "total_count": total_count,
        "total_ingredients": total_ingredients,
        "lab_status": "ONLINE (Quantum Culinary Node 01)"
    }

@app.get("/anomalies/graduated")
async def get_graduated_anomalies(db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Anomaly)
        .options(selectinload(Anomaly.submitter))
        .filter(Anomaly.status == AnomalyStatus.APPROVED)
        .order_by(Anomaly.id.desc())
        .limit(20)
    )
    anomalies = result.scalars().all()
    return [{
        "id": a.id,
        "name": a.scraped_name,
        "sourceUrl": a.source_url or "Web Scraper Harvest",
        "status": "APPROVED",
        "votes": a.votes_for_approval,
        "submitter": a.submitter.username if a.submitter else "DexScraperBot",
        "created_at": a.created_at.strftime("%Y-%m-%d") if a.created_at else "Recent"
    } for a in anomalies]

@app.get("/anomalies")
async def get_all_anomalies(db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Anomaly)
        .options(selectinload(Anomaly.submitter))
        .filter(Anomaly.status == AnomalyStatus.PENDING)
        .order_by(Anomaly.id.desc())
    )
    anomalies = result.scalars().all()
    return [{
        "id": a.id,
        "name": a.scraped_name,
        "sourceUrl": a.source_url or "Web Scraper Harvest",
        "status": a.status.value,
        "votes": a.votes_for_approval,
        "submitter": a.submitter.username if a.submitter else "DexScraperBot",
        "created_at": a.created_at.strftime("%Y-%m-%d") if a.created_at else "Recent"
    } for a in anomalies]

@app.post("/anomalies/submit")
async def submit_anomaly(
    request: AnomalySubmitRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    if not request.name or not request.name.strip():
        raise HTTPException(status_code=400, detail="Ingredient name is required")
        
    new_anomaly = Anomaly(
        scraped_name=request.name.strip().title(),
        source_url=request.source_url.strip() if request.source_url else None,
        submitter_user_id=current_user.id,
        votes_for_approval=0,
        status=AnomalyStatus.PENDING
    )
    db.add(new_anomaly)
    current_user.xp = (current_user.xp or 0) + 50
    await db.commit()
    return {"message": "Shadow Card submitted for community peer-review! +50 XP granted", "id": new_anomaly.id}

@app.post("/anomalies/{anomaly_id}/{action}")
async def vote_or_review_anomaly(
    anomaly_id: int,
    action: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    result = await db.execute(select(Anomaly).filter(Anomaly.id == anomaly_id))
    anomaly = result.scalars().first()
    if not anomaly:
        raise HTTPException(status_code=404, detail="Anomaly not found")
        
    xp_reward = 25
    message = ""
    graduated = False
    
    if action in ["sanction", "approve", "upvote"]:
        anomaly.votes_for_approval += 1
        message = f"Voted to Sanction '{anomaly.scraped_name}'! (+{xp_reward} XP)"
        
        # Graduate if 3 votes reached or user is moderator
        if anomaly.votes_for_approval >= 3 or current_user.role == UserRole.MODERATOR:
            anomaly.status = AnomalyStatus.APPROVED
            graduated = True
            
            # Check if exists in Ingredient table
            existing_ing = await db.execute(select(Ingredient).filter(Ingredient.name.ilike(anomaly.scraped_name)))
            if not existing_ing.scalars().first():
                new_ing = Ingredient(
                    name=anomaly.scraped_name,
                    category="Specialty",
                    rarity_tier=RarityTier.EPIC,
                    description=f"Sanctioned by community peer review in the Test Kitchen.",
                    origin="Community Research"
                )
                db.add(new_ing)
                await db.flush()
                # Grant card to voter as bonus
                db.add(UserInventory(user_id=current_user.id, ingredient_id=new_ing.id, quantity=1))
            message = f"🎉 Consensus Reached! '{anomaly.scraped_name}' has graduated to the official Dex!"
            
    elif action in ["reject", "debunk", "downvote"]:
        if current_user.role == UserRole.MODERATOR:
            anomaly.status = AnomalyStatus.REJECTED
        else:
            anomaly.votes_for_approval = max(0, anomaly.votes_for_approval - 1)
        message = f"Marked '{anomaly.scraped_name}' as suspicious. (+{xp_reward} XP)"
        
    current_user.xp = (current_user.xp or 0) + xp_reward
    await db.commit()
    return {"message": message, "votes": anomaly.votes_for_approval, "status": anomaly.status.value, "graduated": graduated}

@app.post("/lab/pairing")
async def analyze_flavor_pairing(request: FlavorPairingRequest):
    items = [i.strip() for i in request.ingredients if i.strip()]
    if len(items) < 2:
        raise HTTPException(status_code=400, detail="Select at least 2 ingredients for pairing analysis")
        
    # Heuristic flavor pairing & synergy generator based on culinary flavor matrix
    seed_val = sum(ord(c) for word in items for c in word.lower())
    
    # Calculate synergy score
    base_score = 70 + (seed_val % 28)
    if any("garlic" in i.lower() for i in items) and any("butter" in i.lower() or "oil" in i.lower() for i in items):
        base_score = 98
    if any("chocolate" in i.lower() for i in items) and any("chili" in i.lower() or "sea salt" in i.lower() for i in items):
        base_score = 95
    if any("tomato" in i.lower() for i in items) and any("basil" in i.lower() for i in items):
        base_score = 99
        
    synergy_score = min(99, max(65, base_score))
    
    flavor_profiles = ["Umami", "Sweet", "Acidic", "Aromatic", "Bitter", "Spicy", "Rich"]
    dominant = [flavor_profiles[(seed_val + idx * 3) % len(flavor_profiles)] for idx in range(3)]
    
    verdicts = [
        "Legendary Synergy: Shared Volatile Aroma Compounds",
        "High Harmony: Classic Culinary Contrast",
        "Experimental Fusion: Bold Chemical Synergy",
        "Modernist Balance: Dynamic Flavor Tension"
    ]
    verdict = verdicts[seed_val % len(verdicts)]
    
    return {
        "ingredients": items,
        "synergy_score": synergy_score,
        "verdict": verdict,
        "dominant_profiles": dominant,
        "chemistry_analysis": f"The aromatic molecular structure of {', '.join(items)} establishes a {dominant[0].lower()} and {dominant[1].lower()} backbone with balanced {dominant[2].lower()} accents.",
        "recommended_technique": ["Slow Braise", "Emulsification", "Sear & Deglaze", "Flash Infusion", "Cold Extraction"][seed_val % 5]
    }

# ==========================================
# 🕷️ AUTOMATED WEB SPIDER / CRAWLER ENDPOINTS
# ==========================================
try:
    if __package__:
        from .crawler import spider_instance
    else:
        from backend.crawler import spider_instance
except ImportError:  # pragma: no cover - direct module execution fallback
    from backend.crawler import spider_instance

class CrawlerStartRequest(BaseModel):
    limit: Optional[int] = 20
    category: Optional[str] = "all"

@app.post("/admin/crawler/start")
async def start_web_spider(
    request: CrawlerStartRequest,
    current_user: User = Depends(get_current_moderator)
):
    res = await spider_instance.start_crawl(limit=request.limit or 20, category=request.category)
    return res

@app.get("/admin/crawler/status")
async def get_spider_status(
    current_user: User = Depends(get_current_moderator)
):
    return spider_instance.stats

@app.post("/admin/crawler/stop")
async def stop_web_spider(
    current_user: User = Depends(get_current_moderator)
):
    return spider_instance.stop_crawl()


