from datetime import datetime, timezone
from typing import List, Optional, Any
from sqlalchemy import String, Integer, ForeignKey, DateTime, Enum, JSON, Text
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship
import enum

class Base(DeclarativeBase):
    pass

class UserRole(enum.Enum):
    USER = "user"
    MODERATOR = "moderator"

class RarityTier(enum.Enum):
    COMMON = "common"
    UNCOMMON = "uncommon"
    RARE = "rare"
    EPIC = "epic"
    LEGENDARY = "legendary"
    MYTHIC = "mythic"

class AnomalyStatus(enum.Enum):
    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"

class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True)
    username: Mapped[str] = mapped_column(String(50), unique=True, index=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    auth_hash: Mapped[str] = mapped_column(String(255))
    xp: Mapped[int] = mapped_column(default=0)
    rank: Mapped[int] = mapped_column(default=1)
    role: Mapped[UserRole] = mapped_column(Enum(UserRole), default=UserRole.USER)
    
    # Relationships
    inventory: Mapped[List["UserInventory"]] = relationship(back_populates="user", cascade="all, delete-orphan")
    discovered_recipes: Mapped[List["Recipe"]] = relationship(back_populates="discoverer")
    active_goals: Mapped[List["UserActiveGoal"]] = relationship(back_populates="user", cascade="all, delete-orphan")
    submitted_anomalies: Mapped[List["Anomaly"]] = relationship(back_populates="submitter")

class Ingredient(Base):
    __tablename__ = "ingredients"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(100), unique=True, index=True)
    description: Mapped[Optional[str]] = mapped_column(Text)
    category: Mapped[str] = mapped_column(String(50))
    rarity_tier: Mapped[RarityTier] = mapped_column(Enum(RarityTier))
    origin: Mapped[Optional[str]] = mapped_column(String(100))
    flavor_profile: Mapped[Optional[str]] = mapped_column(Text)
    image_url: Mapped[Optional[str]] = mapped_column(String(500))
    
    # Relationships
    recipe_associations: Mapped[List["RecipeIngredient"]] = relationship(back_populates="ingredient")
    user_inventories: Mapped[List["UserInventory"]] = relationship(back_populates="ingredient")

class Recipe(Base):
    __tablename__ = "recipes"

    id: Mapped[int] = mapped_column(primary_key=True)
    title: Mapped[str] = mapped_column(String(200), index=True)
    instructions: Mapped[Optional[str]] = mapped_column(Text)
    image_url: Mapped[Optional[str]] = mapped_column(String(500))
    difficulty: Mapped[Optional[int]] = mapped_column(Integer) # e.g., 1-5
    dietary_tags: Mapped[Optional[list[str]]] = mapped_column(JSON) # e.g., ["Vegetarian", "Vegan"]
    
    discovered_by_user_id: Mapped[Optional[int]] = mapped_column(ForeignKey("users.id"))
    
    # Relationships
    discoverer: Mapped[Optional["User"]] = relationship(back_populates="discovered_recipes")
    ingredients: Mapped[List["RecipeIngredient"]] = relationship(back_populates="recipe", cascade="all, delete-orphan")
    users_with_goal: Mapped[List["UserActiveGoal"]] = relationship(back_populates="recipe", cascade="all, delete-orphan")

class RecipeIngredient(Base):
    __tablename__ = "recipe_ingredients"

    id: Mapped[int] = mapped_column(primary_key=True)
    recipe_id: Mapped[int] = mapped_column(ForeignKey("recipes.id"), index=True)
    ingredient_id: Mapped[int] = mapped_column(ForeignKey("ingredients.id"), index=True)
    quantity_desc: Mapped[Optional[str]] = mapped_column(String(100)) # e.g., "2 cups", "1 tbsp"
    
    # Relationships
    recipe: Mapped["Recipe"] = relationship(back_populates="ingredients")
    ingredient: Mapped["Ingredient"] = relationship(back_populates="recipe_associations")

class UserInventory(Base):
    __tablename__ = "user_inventory"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    ingredient_id: Mapped[int] = mapped_column(ForeignKey("ingredients.id"), index=True)
    quantity: Mapped[int] = mapped_column(default=1)
    
    # Relationships
    user: Mapped["User"] = relationship(back_populates="inventory")
    ingredient: Mapped["Ingredient"] = relationship(back_populates="user_inventories")

class UserActiveGoal(Base):
    __tablename__ = "user_active_goals"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    recipe_id: Mapped[int] = mapped_column(ForeignKey("recipes.id"), index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc))
    
    # Relationships
    user: Mapped["User"] = relationship(back_populates="active_goals")
    recipe: Mapped["Recipe"] = relationship(back_populates="users_with_goal")

class Anomaly(Base):
    """
    Shadow cards / Unidentified Anomalies detected by the web scraper
    that aren't in the main Ingredients table yet.
    """
    __tablename__ = "anomalies"

    id: Mapped[int] = mapped_column(primary_key=True)
    scraped_name: Mapped[str] = mapped_column(String(100))
    source_url: Mapped[Optional[str]] = mapped_column(String(500))
    submitter_user_id: Mapped[Optional[int]] = mapped_column(ForeignKey("users.id"))
    votes_for_approval: Mapped[int] = mapped_column(default=0)
    status: Mapped[AnomalyStatus] = mapped_column(Enum(AnomalyStatus), default=AnomalyStatus.PENDING)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc))

    # Relationships
    submitter: Mapped[Optional["User"]] = relationship(back_populates="submitted_anomalies")

class UserUnlockedRecipe(Base):
    __tablename__ = "user_unlocked_recipes"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    recipe_id: Mapped[int] = mapped_column(ForeignKey("recipes.id"), index=True)
    unlocked_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc))

    # Relationships
    user: Mapped["User"] = relationship()
    recipe: Mapped["Recipe"] = relationship()

