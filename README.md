# FlavorDex

FlavorDex is a gamified food discovery and collection application that blends recipe browsing, ingredient collecting, trading-card style booster packs, and community-driven ingredient validation. The project is split into a FastAPI backend and a Next.js frontend, with a SQLite database for local development.

## Overview

FlavorDex lets users:

- collect ingredient cards from booster packs
- browse and unlock recipes
- track inventory and active goals
- discover new recipes from submitted URLs
- participate in anomaly validation for unknown ingredients
- manage moderator workflows in an admin dashboard

The app is designed around a lightweight game loop: gather ingredients, unlock recipes, complete goals, and grow your profile progression.

## Tech Stack

- Backend: Python, FastAPI, SQLAlchemy, SQLite, JWT auth
- Frontend: Next.js, React, TypeScript, Tailwind CSS, Framer Motion
- Database: SQLite via `aiosqlite`
- Authentication: JWT with password hashing via `passlib`

## Project Structure

```text
FlavorDex/
├── .gitignore
├── README.md
├── backend/
│   ├── auth.py
│   ├── database.py
│   ├── main.py
│   ├── models.py
│   ├── requirements.txt
│   ├── scraper.py
│   └── seed_real.py
├── docs/
│   └── APP_DOCUMENTATION.md
├── frontend/
│   ├── package.json
│   ├── public/
│   ├── src/
│   ├── next.config.ts
│   ├── tsconfig.json
│   └── eslint.config.mjs
├── flavordex.db
└── .venv/ (optional local environment)
```

## Features

### User Experience

- home page with animated launch experience and stats
- auth flow for sign-in and account creation
- booster pack opening experience
- recipe discovery and filtering pages
- profile and collection views
- dashboard for user progression and goals

### Backend Features

- user registration and login via JWT
- protected user endpoints and moderator-only admin routes
- ingredient and recipe retrieval with search and filtering
- recipe submission from external URLs using scraper logic
- anomaly submission and moderation workflow
- user inventory tracking and unlock progression

### Admin Capabilities

- admin stats dashboard
- user list and user role monitoring
- ingredient management overview
- recipe management overview
- crawler management endpoints for background tasks

## Getting Started

### 1. Clone and install backend dependencies

```bash
cd FlavorDex/backend
python -m venv .venv
# Windows PowerShell
.venv\Scripts\Activate.ps1
# macOS/Linux
source .venv/bin/activate
pip install -r requirements.txt
```

### 2. Run the backend

```bash
cd FlavorDex/backend
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

The API docs will be available at:

- http://localhost:8000/docs
- http://localhost:8000/redoc

### 3. Install frontend dependencies

```bash
cd FlavorDex/frontend
npm install
```

### 4. Run the frontend

```bash
cd FlavorDex/frontend
npm run dev
```

Then open:

- http://localhost:3000

## Environment and Configuration

The app uses sensible defaults for local development, including:

- SQLite database: `backend/flavordex.db`
- API base URL expected by frontend: `http://localhost:8000`
- JWT secret fallback is defined in `backend/auth.py`

For production or custom local setup, you can set environment variables such as:

```bash
DATABASE_URL=sqlite+aiosqlite:///./flavordex.db
SECRET_KEY=your-secret-key
```

## Core API Flows

### Authentication

- `POST /register` creates a new user
- `POST /token` authenticates and returns a JWT
- `GET /users/me` returns the current user profile

### Recipes and Ingredients

- `GET /ingredients` lists ingredients
- `GET /recipes` lists and filters recipes
- `GET /recipes/categories` returns dietary categories
- `POST /recipes/submit` submits a recipe URL for scraping

### User Progression

- `GET /users/me/inventory` returns a user inventory
- `GET /users/me/goals` returns active goals
- `POST /users/me/goals/{recipe_id}` sets a goal
- `POST /users/me/booster` opens a booster pack

### Admin

- `GET /admin/stats`
- `GET /admin/users`
- `GET /admin/ingredients`
- `GET /admin/recipes`
- `POST /admin/crawler/start`

## Database Model Summary

The main persisted entities include:

- `User`
- `Ingredient`
- `Recipe`
- `RecipeIngredient`
- `UserInventory`
- `UserActiveGoal`
- `Anomaly`
- `UserUnlockedRecipe`

The schema is defined in `backend/models.py` and is created automatically during FastAPI startup for local development.

## Notes for Development

- The backend creates database tables automatically on app startup using SQLAlchemy metadata.
- The SQLite database file is intentionally part of the local workspace for easy development and testing.
- The frontend calls the backend at `http://localhost:8000`, so both apps must be running at the same time for full functionality.
- The project includes seed and scraper utilities for populating and discovering recipe content.

## Documentation

Additional app-level documentation is available in:

- [docs/APP_DOCUMENTATION.md](docs/APP_DOCUMENTATION.md)

## Next Steps

Possible extensions include:

- replacing the local SQLite database with Postgres for production
- adding richer onboarding and user profile polish
- expanding moderation tools and anomaly review flows
- adding automated tests for backend routes and frontend components
- deploying the frontend and backend separately

## License

This project does not yet define a formal license file. If you intend to share or distribute the project publicly, add a license before release.
