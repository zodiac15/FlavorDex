import asyncio
import ipaddress
import logging
import re
import json
import socket
from urllib.parse import urljoin, urlsplit, urlunsplit
import aiohttp
from bs4 import BeautifulSoup
from recipe_scrapers import scrape_html
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func

try:
    if __package__:
        from .models import Recipe, Ingredient, RecipeIngredient, UserInventory, User, UserUnlockedRecipe, RarityTier, Anomaly, AnomalyStatus
    else:
        from backend.models import Recipe, Ingredient, RecipeIngredient, UserInventory, User, UserUnlockedRecipe, RarityTier, Anomaly, AnomalyStatus
except ImportError:  # pragma: no cover - direct module execution fallback
    from backend.models import Recipe, Ingredient, RecipeIngredient, UserInventory, User, UserUnlockedRecipe, RarityTier, Anomaly, AnomalyStatus

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

MAX_RECIPE_PAGE_BYTES = 5 * 1024 * 1024
MAX_RECIPE_REDIRECTS = 5
RECIPE_FETCH_TIMEOUT = aiohttp.ClientTimeout(total=15, connect=5, sock_read=10)


class UnsafeRecipeURL(ValueError):
    pass


class RecipeFetchError(RuntimeError):
    pass


class RecipeParseError(ValueError):
    pass


def validate_recipe_url(url: str) -> str:
    if len(url) > 2048:
        raise UnsafeRecipeURL("Recipe URL exceeds 2048 characters")

    try:
        parsed = urlsplit(url.strip())
        port = parsed.port
    except ValueError as exc:
        raise UnsafeRecipeURL("Recipe URL is invalid") from exc

    if parsed.scheme.lower() not in {"http", "https"} or not parsed.hostname:
        raise UnsafeRecipeURL("Recipe URL must use HTTP or HTTPS and include a host")
    if parsed.username or parsed.password:
        raise UnsafeRecipeURL("Recipe URL must not contain credentials")
    expected_port = 443 if parsed.scheme.lower() == "https" else 80
    if port is not None and port != expected_port:
        raise UnsafeRecipeURL("Recipe URL must use the standard HTTP or HTTPS port")

    hostname = parsed.hostname.lower().rstrip(".")
    if hostname in {"localhost", "localhost.localdomain"} or hostname.endswith(
        (".localhost", ".local", ".internal", ".test")
    ):
        raise UnsafeRecipeURL("Recipe URL host must be publicly routable")

    try:
        address = ipaddress.ip_address(hostname)
    except ValueError:
        pass
    else:
        if not address.is_global:
            raise UnsafeRecipeURL("Recipe URL host must be publicly routable")

    return urlunsplit(parsed._replace(fragment=""))


class PublicOnlyResolver(aiohttp.abc.AbstractResolver):
    async def resolve(self, host, port=0, family=socket.AF_INET):
        try:
            address = ipaddress.ip_address(host)
            resolved = [(socket.AF_INET6 if address.version == 6 else socket.AF_INET, str(address))]
        except ValueError:
            loop = asyncio.get_running_loop()
            infos = await loop.getaddrinfo(host, port, family=family, type=socket.SOCK_STREAM)
            resolved = list(dict.fromkeys((info[0], info[4][0]) for info in infos))

        if not resolved or any(not ipaddress.ip_address(address).is_global for _, address in resolved):
            raise OSError("Recipe URL resolved to a non-public address")

        return [
            {
                "hostname": host,
                "host": address,
                "port": port,
                "family": address_family,
                "proto": 0,
                "flags": 0,
            }
            for address_family, address in resolved
        ]

    async def close(self):
        return None


async def fetch_recipe_page(url: str) -> tuple[str, str]:
    current_url = validate_recipe_url(url)
    connector = aiohttp.TCPConnector(
        resolver=PublicOnlyResolver(),
        use_dns_cache=False,
    )
    headers = {"User-Agent": "FlavorDex recipe importer/1.0"}
    async with aiohttp.ClientSession(
        connector=connector,
        timeout=RECIPE_FETCH_TIMEOUT,
        trust_env=False,
        headers=headers,
    ) as session:
        for redirect_count in range(MAX_RECIPE_REDIRECTS + 1):
            current_url = validate_recipe_url(current_url)
            try:
                async with session.get(current_url, allow_redirects=False) as response:
                    if response.status in {301, 302, 303, 307, 308}:
                        location = response.headers.get("Location")
                        if not location or redirect_count == MAX_RECIPE_REDIRECTS:
                            raise RecipeFetchError("Recipe source redirected too many times")
                        current_url = urljoin(current_url, location)
                        continue

                    response.raise_for_status()
                    content_type = response.headers.get("Content-Type", "").lower()
                    if content_type and not (
                        content_type.startswith("text/html")
                        or content_type.startswith("application/xhtml+xml")
                    ):
                        raise RecipeFetchError("Recipe source did not return an HTML page")

                    content_length = response.headers.get("Content-Length")
                    if content_length and int(content_length) > MAX_RECIPE_PAGE_BYTES:
                        raise RecipeFetchError("Recipe source page exceeds the 5 MB limit")

                    body = bytearray()
                    async for chunk in response.content.iter_chunked(64 * 1024):
                        body.extend(chunk)
                        if len(body) > MAX_RECIPE_PAGE_BYTES:
                            raise RecipeFetchError("Recipe source page exceeds the 5 MB limit")

                    try:
                        encoding = response.charset or "utf-8"
                        html = bytes(body).decode(encoding, errors="replace")
                    except LookupError:
                        html = bytes(body).decode("utf-8", errors="replace")
                    return html, str(response.url)
            except UnsafeRecipeURL:
                raise
            except RecipeFetchError:
                raise
            except (aiohttp.ClientError, asyncio.TimeoutError, OSError, ValueError) as exc:
                raise RecipeFetchError("Could not fetch recipe source") from exc

    raise RecipeFetchError("Could not fetch recipe source")


def _recipe_objects(data):
    if isinstance(data, list):
        for item in data:
            yield from _recipe_objects(item)
    elif isinstance(data, dict):
        if "@graph" in data:
            yield from _recipe_objects(data["@graph"])
        else:
            yield data


def _instruction_text(value) -> str:
    if isinstance(value, str):
        return value
    if isinstance(value, dict):
        return _instruction_text(value.get("text") or value.get("itemListElement") or "")
    if isinstance(value, list):
        return "\n".join(filter(None, (_instruction_text(item) for item in value)))
    return ""


def scrape_generic_fallback(html: str, source_url: str):
    soup = BeautifulSoup(html, "html.parser")
    for script in soup.find_all("script", type="application/ld+json"):
        try:
            data = json.loads(script.string or script.get_text())
        except (json.JSONDecodeError, TypeError):
            continue
        for item in _recipe_objects(data):
            item_type = item.get("@type", [])
            if not isinstance(item_type, list):
                item_type = [item_type]
            if not any(str(value).rstrip("/").split("/")[-1] == "Recipe" for value in item_type):
                continue

            title = item.get("name")
            ingredients = item.get("recipeIngredient") or []
            if not isinstance(ingredients, list):
                continue
            image = item.get("image")
            if isinstance(image, list):
                image = image[0] if image else None
            if isinstance(image, dict):
                image = image.get("url")
            if isinstance(image, str):
                image = urljoin(source_url, image)

            instructions = _instruction_text(item.get("recipeInstructions") or "")
            if title and ingredients:
                return {
                    "title": str(title).strip(),
                    "image": image if isinstance(image, str) else None,
                    "ingredients": [str(value) for value in ingredients if str(value).strip()],
                    "instructions": instructions,
                }

    raise RecipeParseError("No recipe details found on this page")

async def process_recipe_url(url: str, user_id: int, db: AsyncSession):
    try:
        safe_url = validate_recipe_url(url)
        html, source_url = await fetch_recipe_page(safe_url)
        try:
            scraper = await asyncio.to_thread(
                scrape_html,
                html,
                source_url,
                supported_only=False,
            )
            title = scraper.title()
            image_url = scraper.image()
            ingredients_list = scraper.ingredients()
            try:
                instructions = scraper.instructions()
            except Exception:
                instructions = ""
            if not title or not ingredients_list:
                raise RecipeParseError("Recipe parser returned incomplete details")
        except Exception:
            logger.info(
                "Recipe parser did not extract structured data from %s; trying JSON-LD",
                urlsplit(source_url).hostname,
            )
            fallback = await asyncio.to_thread(scrape_generic_fallback, html, source_url)
            title = fallback["title"]
            image_url = fallback["image"]
            ingredients_list = fallback["ingredients"]
            instructions = fallback["instructions"]

        if not title or not ingredients_list:
            raise RecipeParseError("No recipe details found on this page")

        user_res = await db.execute(select(User).where(User.id == user_id).with_for_update())
        user_obj = user_res.scalars().first()
        if not user_obj:
            raise ValueError("User no longer exists")

        unlocked_check = await db.execute(
            select(UserUnlockedRecipe.id).filter(
                UserUnlockedRecipe.user_id == user_id,
                UserUnlockedRecipe.recipe_id.in_(
                    select(Recipe.id).filter(func.lower(Recipe.title) == title.lower())
                ),
            )
        )
        is_first_unlock = unlocked_check.scalar_one_or_none() is None

        existing_recipe_res = await db.execute(
            select(Recipe).filter(func.lower(Recipe.title) == title.lower())
        )
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
            
        all_db_ings_res = await db.execute(select(Ingredient))
        all_db_ings = all_db_ings_res.scalars().all()
        db_ings_by_name = {ing.name.lower(): ing for ing in all_db_ings}
        
        user_inv_res = await db.execute(select(UserInventory).filter(UserInventory.user_id == user_id))
        user_inv_map = {item.ingredient_id: item for item in user_inv_res.scalars().all()}
        recipe_link_res = await db.execute(
            select(RecipeIngredient.ingredient_id).filter(RecipeIngredient.recipe_id == recipe.id)
        )
        linked_ingredient_ids = set(recipe_link_res.scalars().all())
        seen_ingredient_ids: set[int] = set()
        
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
            
            if matched_ing.id in seen_ingredient_ids:
                continue
            seen_ingredient_ids.add(matched_ing.id)

            if matched_ing.id not in linked_ingredient_ids:
                db.add(RecipeIngredient(
                    recipe_id=recipe.id,
                    ingredient_id=matched_ing.id,
                    quantity_desc=raw_ing_str[:100]
                ))
                linked_ingredient_ids.add(matched_ing.id)
                
            is_new_to_user = matched_ing.id not in user_inv_map
            if is_first_unlock:
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
            
        if is_first_unlock:
            db.add(UserUnlockedRecipe(user_id=user_id, recipe_id=recipe.id))

        xp_gained = 50 + (len(unlocked_ingredients) * 15) if is_first_unlock else 0
        if is_first_unlock:
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
            "message": (
                f"Successfully imported '{recipe.title}'! "
                f"{len(unlocked_ingredients)} ingredients processed in your Dex."
            )
        }
        
    except Exception as e:
        logger.error("Failed to import recipe from submitted URL: %s", e, exc_info=True)
        await db.rollback()
        raise
