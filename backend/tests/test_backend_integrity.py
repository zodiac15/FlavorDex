import os
import unittest
from unittest.mock import AsyncMock, Mock, patch

os.environ.setdefault("SECRET_KEY", "test-only-secret-key-with-more-than-32-bytes")

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from backend import main, scraper
from backend.models import Anomaly, AnomalyStatus, Base, Recipe, User, UserInventory


class BackendIntegrityTests(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        self.engine = create_async_engine("sqlite+aiosqlite:///:memory:")
        async with self.engine.begin() as connection:
            await connection.run_sync(Base.metadata.create_all)
        self.sessions = async_sessionmaker(
            self.engine,
            class_=AsyncSession,
            expire_on_commit=False,
        )

    async def asyncTearDown(self):
        await self.engine.dispose()

    async def create_user(self, username="test-user"):
        async with self.sessions() as session:
            user = User(
                username=username,
                email=f"{username}@example.com",
                auth_hash="unused",
                xp=0,
                rank=1,
            )
            session.add(user)
            await session.commit()
            await session.refresh(user)
            return user.id

    def test_registration_validates_json_fields(self):
        request = main.RegisterRequest(
            username="  test.user  ",
            email="  TEST@example.com ",
            password="password",
        )
        self.assertEqual(request.username, "test.user")
        self.assertEqual(request.email, "test@example.com")
        with self.assertRaises(ValueError):
            main.RegisterRequest(
                username="valid-user",
                email="valid@example.com",
                password="x" * 73,
            )

    def test_recipe_url_rejects_private_hosts_and_nonstandard_ports(self):
        for url in (
            "http://localhost/recipe",
            "http://127.0.0.1/recipe",
            "http://[::1]/recipe",
            "https://example.com:8443/recipe",
            "https://user:pass@example.com/recipe",
        ):
            with self.subTest(url=url), self.assertRaises(scraper.UnsafeRecipeURL):
                scraper.validate_recipe_url(url)

        self.assertEqual(
            scraper.validate_recipe_url("https://example.com/recipe#section"),
            "https://example.com/recipe",
        )

    async def test_recipe_resolver_rejects_private_dns_results(self):
        class PrivateDNS:
            async def getaddrinfo(self, host, port, family, type):
                return [(2, type, 6, "", ("10.0.0.8", port))]

        with patch("backend.scraper.asyncio.get_running_loop", return_value=PrivateDNS()):
            with self.assertRaisesRegex(OSError, "non-public address"):
                await scraper.PublicOnlyResolver().resolve("recipes.example")

    async def test_duplicate_anomaly_submission_conflicts_without_xp(self):
        user_id = await self.create_user()
        async with self.sessions() as session:
            user = await session.get(User, user_id)
            first = await main.submit_anomaly(
                main.AnomalySubmitRequest(name="Test Ingredient"),
                session,
                user,
            )
            self.assertIn("if it is approved", first["message"])

            with self.assertRaises(main.HTTPException) as duplicate:
                await main.submit_anomaly(
                    main.AnomalySubmitRequest(name="test ingredient"),
                    session,
                    user,
                )
            await session.refresh(user)

        self.assertEqual(duplicate.exception.status_code, 409)
        self.assertEqual(user.xp, 0)

    async def test_category_filter_runs_before_pagination(self):
        async with self.sessions() as session:
            session.add_all(
                [
                    Recipe(title="Not Vegan", difficulty=1, dietary_tags=["Dairy"]),
                    Recipe(title="Vegan Match", difficulty=1, dietary_tags=["Vegan"]),
                ]
            )
            await session.commit()

            recipes = await main.get_all_recipes(
                q=None,
                ingredient=None,
                category="Vegan",
                difficulty=None,
                limit=1,
                offset=0,
                authorization=None,
                db=session,
            )

        self.assertEqual([recipe["title"] for recipe in recipes], ["Vegan Match"])

    async def test_xp_award_updates_rank_atomically(self):
        async with self.sessions() as session:
            user = User(
                username="xp-user",
                email="xp@example.com",
                auth_hash="unused",
                xp=249,
                rank=1,
            )
            session.add(user)
            await session.commit()
            await session.refresh(user)

            await main.award_xp(session, user.id, 1)
            await session.commit()
            await session.refresh(user)

        self.assertEqual(user.xp, 250)
        self.assertEqual(user.rank, 2)

    async def test_anomaly_vote_rewards_once_and_approval_is_terminal(self):
        submitter_id = await self.create_user("submitter")
        reviewer_ids = [
            await self.create_user("reviewer-one"),
            await self.create_user("reviewer-two"),
            await self.create_user("reviewer-three"),
        ]
        async with self.sessions() as session:
            anomaly = Anomaly(
                scraped_name="Test Ingredient",
                submitter_user_id=submitter_id,
                votes_for_approval=0,
                status=AnomalyStatus.PENDING,
            )
            session.add(anomaly)
            await session.commit()
            await session.refresh(anomaly)
            anomaly_id = anomaly.id

            first_reviewer = await session.get(User, reviewer_ids[0])
            await main.vote_or_review_anomaly(
                anomaly_id,
                "upvote",
                session,
                first_reviewer,
            )
            with self.assertRaises(main.HTTPException) as duplicate_vote:
                await main.vote_or_review_anomaly(
                    anomaly_id,
                    "upvote",
                    session,
                    first_reviewer,
                )
            self.assertEqual(duplicate_vote.exception.status_code, 409)

            for reviewer_id in reviewer_ids[1:]:
                reviewer = await session.get(User, reviewer_id)
                await main.vote_or_review_anomaly(
                    anomaly_id,
                    "upvote",
                    session,
                    reviewer,
                )

            await session.refresh(first_reviewer)
            with self.assertRaises(main.HTTPException) as terminal_vote:
                await main.vote_or_review_anomaly(
                    anomaly_id,
                    "upvote",
                    session,
                    first_reviewer,
                )

            submitter = await session.get(User, submitter_id)
            await session.refresh(submitter)

        self.assertEqual(terminal_vote.exception.status_code, 409)
        self.assertEqual(submitter.xp, 50)
        self.assertEqual(first_reviewer.xp, 25)

    async def test_recipe_import_rewards_only_first_unlock(self):
        user_id = await self.create_user()
        parser = Mock()
        parser.title.return_value = "Test Noodles"
        parser.image.return_value = None
        parser.ingredients.return_value = ["1 cup rice", "2 tbsp soy sauce"]
        parser.instructions.return_value = "Cook ingredients."

        with (
            patch(
                "backend.scraper.fetch_recipe_page",
                new=AsyncMock(
                    return_value=("<html></html>", "https://example.com/recipe")
                ),
            ),
            patch("backend.scraper.scrape_html", return_value=parser),
        ):
            async with self.sessions() as session:
                first = await scraper.process_recipe_url(
                    "https://example.com/recipe",
                    user_id,
                    session,
                )
                second = await scraper.process_recipe_url(
                    "https://example.com/recipe",
                    user_id,
                    session,
                )

            async with self.sessions() as session:
                user = await session.get(User, user_id)
                inventory_count = await session.scalar(
                    select(func.count()).select_from(UserInventory)
                )

        self.assertEqual(first["xp_gained"], 80)
        self.assertEqual(second["xp_gained"], 0)
        self.assertEqual(user.xp, 80)
        self.assertEqual(inventory_count, 2)


if __name__ == "__main__":
    unittest.main()
