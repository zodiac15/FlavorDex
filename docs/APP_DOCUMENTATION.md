# App Documentation

## Product Purpose

FlavorDex is a culinary collection game built to turn ingredient discovery and recipe experimentation into a progression system. It combines exploration, social/community validation, and collection mechanics to create a product that feels more like a card game than a traditional recipe site.

## User Personas

### Collector

A user who enjoys opening booster packs, discovering rare ingredients, and growing their inventory.

Needs:

- clear rarity progression
- satisfying card collection feeling
- easy recipe discovery
- progress tracking and goals

### Home Cook / Recipe Explorer

A user who wants to find recipes, see ingredient compatibility, and learn from curated categories.

Needs:

- searchable recipe list
- filters by ingredient and dietary tags
- ingredient metadata and rarity context

### Moderator / Admin

A user who reviews submitted content, inspects user activity, and maintains the ingredient and recipe database.

Needs:

- admin dashboards
- statistics and aggregated metrics
- moderation and crawler controls

## Core App Flows

### 1. Sign up and login

A user registers with a username, email, and password. The backend hashes the password and stores the user record. Authentication is handled through JWT access tokens.

Important files:

- `backend/auth.py`
- `backend/main.py`

### 2. Open booster packs

The frontend presents collection-style interfaces for users to open packs and claim ingredient cards. The backend supports booster-related endpoints and tracks user inventory.

### 3. Discover recipes

Users can search recipe data, filter by ingredient or dietary tags, and unlock recipes as they progress. Some recipes can be discovered via scraped URLs submitted by users.

### 4. Submit and validate anomalies

The app includes an anomaly workflow for strange or unrecognized ingredient names. These records are reviewed and approved or rejected by moderators.

### 5. Manage goals and progression

Users can set active recipe goals and track inventory-based progress. The app includes data objects for `UserActiveGoal` and progression fields such as XP and rank.

## Frontend Architecture

The frontend is a Next.js App Router project with multiple route pages under `frontend/src/app`.

### Main routes

- `/` — landing page / homepage
- `/auth` — login and register screen
- `/dashboard` — main user dashboard
- `/collection` — collection or inventory overview
- `/recipes` — recipe discovery
- `/crafting` — crafting or recipe creation area
- `/test-kitchen` — experimentation and validation
- `/profile` — user account/profile page
- `/admin` — moderator/admin dashboard

### Shared UI components

- `Navbar` for navigation
- `IngredientCard` for ingredient tiles
- `RecipeCard` for recipe cards
- `SwipeDeck` for interactive card deck behavior
- `BoosterPack` for pack-opening experience

## Backend Architecture

The backend is organized around API endpoints and database models.

### Primary modules

- `backend/main.py` — API definition and route handlers
- `backend/models.py` — SQLAlchemy ORM schema
- `backend/database.py` — async database session setup
- `backend/auth.py` — JWT and password authentication logic
- `backend/scraper.py` — URL scraping and recipe import logic

### Main API groups

#### Authentication

- `POST /register`
- `POST /token`
- `GET /users/me`

#### Inventory / progression

- `GET /users/me/inventory`
- `GET /users/me/goals`
- `POST /users/me/goals/{recipe_id}`
- `POST /users/me/booster`

#### Recipes

- `GET /recipes`
- `GET /recipes/categories`
- `POST /recipes/submit`
- `GET /users/me/discovered-recipes`

#### Admin

- `GET /admin/stats`
- `GET /admin/users`
- `GET /admin/ingredients`
- `GET /admin/recipes`
- `POST /admin/crawler/start`
- `GET /admin/crawler/status`

## Data Model Summary

### User

Stores identity, role, XP, and rank.

### Ingredient

A catalog item with a name, category, rarity, provenance, and image.

### Recipe

A crafted recipe containing instructions, dietary tags, difficulty, and links to ingredient records.

### RecipeIngredient

Maps many ingredients to a recipe with optional quantity metadata.

### UserInventory

Tracks which ingredients a user owns and how many.

### UserActiveGoal

Tracks a user’s active recipe objective.

### Anomaly

Captures possibly missing or unrecognized ingredient entries submitted by users or discovered by scraping.

## Security Notes

- Passwords are hashed with `bcrypt` via `passlib`
- JWT-based auth secures user-specific endpoints
- Moderator routes require a moderator role check
- CORS is enabled for local frontend access on `localhost:3000`

## Local Development Notes

- `backend/main.py` initializes tables on startup by calling SQLAlchemy metadata creation
- `flavordex.db` is the default local database file
- the frontend expects the backend API at `http://localhost:8000`
- both services must be running together for end-to-end app behavior

## Suggested Improvements

- add automated backend tests
- add frontend integration tests for key flows
- replace local SQLite with a managed production database
- add deployment configuration for Vercel and Render/Azure
- formalize admin moderation review flows and audit logs

## Appendix: Product Feel

FlavorDex is best understood as a hybrid between a recipe app and a collectible card game. The aesthetic and feature structure emphasize rarity, collection, unlock loops, and gamified progression while still preserving practical ingredient and recipe discovery workflows.
