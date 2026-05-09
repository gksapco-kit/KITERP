import logging
from typing import Optional, Tuple, List
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func as sqlfunc, and_
from uuid import UUID

from app.models.loyalty import LoyaltyProgram, LoyaltyAccount, LoyaltyTransaction

log = logging.getLogger(__name__)


class LoyaltyService:
    def __init__(self, db: AsyncSession):
        self.db = db

    # ── Program management ────────────────────────────────────

    async def get_or_create_program(self, vendor_id: UUID) -> LoyaltyProgram:
        result = await self.db.execute(
            select(LoyaltyProgram).where(LoyaltyProgram.vendor_id == vendor_id)
        )
        prog = result.scalar_one_or_none()
        if not prog:
            prog = LoyaltyProgram(vendor_id=vendor_id)
            self.db.add(prog)
            await self.db.commit()
            await self.db.refresh(prog)
        return prog

    async def update_program(self, vendor_id: UUID, data: dict) -> LoyaltyProgram:
        prog = await self.get_or_create_program(vendor_id)
        for key, value in data.items():
            if value is not None and hasattr(prog, key) and key not in ("id", "vendor_id"):
                setattr(prog, key, value)
        await self.db.commit()
        await self.db.refresh(prog)
        return prog

    # ── Account management ────────────────────────────────────

    async def get_or_create_account(self, vendor_id: UUID, customer_id: UUID) -> LoyaltyAccount:
        result = await self.db.execute(
            select(LoyaltyAccount).where(
                and_(LoyaltyAccount.vendor_id == vendor_id, LoyaltyAccount.customer_id == customer_id)
            )
        )
        acct = result.scalar_one_or_none()
        if not acct:
            prog = await self.get_or_create_program(vendor_id)
            bonus = prog.signup_bonus or 0
            acct = LoyaltyAccount(
                vendor_id=vendor_id,
                customer_id=customer_id,
                points_balance=bonus,
                lifetime_earned=bonus,
            )
            self.db.add(acct)
            await self.db.flush()

            if bonus > 0:
                txn = LoyaltyTransaction(
                    vendor_id=vendor_id,
                    customer_id=customer_id,
                    account_id=acct.id,
                    type="signup",
                    points=bonus,
                    balance_after=bonus,
                    description="Signup bonus",
                )
                self.db.add(txn)

            await self.db.commit()
            await self.db.refresh(acct)
        return acct

    async def get_account(self, vendor_id: UUID, customer_id: UUID) -> Optional[LoyaltyAccount]:
        result = await self.db.execute(
            select(LoyaltyAccount).where(
                and_(LoyaltyAccount.vendor_id == vendor_id, LoyaltyAccount.customer_id == customer_id)
            )
        )
        return result.scalar_one_or_none()

    # ── Earn points ───────────────────────────────────────────

    async def earn_points(
        self,
        vendor_id: UUID,
        customer_id: UUID,
        amount: float,
        reference_type: str = None,
        reference_id: UUID = None,
        auto_commit: bool = True,
    ) -> Optional[LoyaltyTransaction]:
        prog = await self.get_or_create_program(vendor_id)
        if not prog.is_active:
            return None

        points = int(amount * float(prog.points_per_currency or 1))
        if points <= 0:
            return None

        acct = await self.get_or_create_account(vendor_id, customer_id)
        acct.points_balance = (acct.points_balance or 0) + points
        acct.lifetime_earned = (acct.lifetime_earned or 0) + points

        txn = LoyaltyTransaction(
            vendor_id=vendor_id,
            customer_id=customer_id,
            account_id=acct.id,
            type="earn",
            points=points,
            balance_after=acct.points_balance,
            description=f"Earned on ₹{amount:.0f} purchase",
            reference_type=reference_type,
            reference_id=reference_id,
        )
        self.db.add(txn)

        if auto_commit:
            await self.db.commit()
            await self.db.refresh(txn)
        else:
            await self.db.flush()

        return txn

    # ── Redeem points ─────────────────────────────────────────

    async def redeem_points(
        self,
        vendor_id: UUID,
        customer_id: UUID,
        points: int,
        reference_type: str = None,
        reference_id: UUID = None,
        auto_commit: bool = True,
    ) -> Tuple[LoyaltyTransaction, float]:
        prog = await self.get_or_create_program(vendor_id)
        if not prog.is_active:
            raise ValueError("Loyalty program is not active")

        acct = await self.get_or_create_account(vendor_id, customer_id)
        if (acct.points_balance or 0) < points:
            raise ValueError(f"Insufficient points. Available: {acct.points_balance}")

        if points < (prog.min_redeem_points or 0):
            raise ValueError(f"Minimum {prog.min_redeem_points} points required to redeem")

        discount_value = round(points * float(prog.currency_per_point or 1), 2)

        acct.points_balance = (acct.points_balance or 0) - points
        acct.lifetime_redeemed = (acct.lifetime_redeemed or 0) + points

        txn = LoyaltyTransaction(
            vendor_id=vendor_id,
            customer_id=customer_id,
            account_id=acct.id,
            type="redeem",
            points=-points,
            balance_after=acct.points_balance,
            description=f"Redeemed {points} pts for ₹{discount_value:.0f} discount",
            reference_type=reference_type,
            reference_id=reference_id,
        )
        self.db.add(txn)

        if auto_commit:
            await self.db.commit()
            await self.db.refresh(txn)
        else:
            await self.db.flush()

        return txn, discount_value

    # ── Manual adjust ─────────────────────────────────────────

    async def adjust_points(
        self, vendor_id: UUID, customer_id: UUID, points: int, description: str = None,
    ) -> LoyaltyTransaction:
        acct = await self.get_or_create_account(vendor_id, customer_id)
        acct.points_balance = (acct.points_balance or 0) + points
        if points > 0:
            acct.lifetime_earned = (acct.lifetime_earned or 0) + points

        txn = LoyaltyTransaction(
            vendor_id=vendor_id,
            customer_id=customer_id,
            account_id=acct.id,
            type="adjust",
            points=points,
            balance_after=acct.points_balance,
            description=description or f"Manual adjustment: {'+' if points > 0 else ''}{points} pts",
        )
        self.db.add(txn)
        await self.db.commit()
        await self.db.refresh(txn)
        return txn

    # ── Queries ───────────────────────────────────────────────

    async def list_accounts(
        self, vendor_id: UUID, page: int = 1, size: int = 20,
    ) -> Tuple[List[LoyaltyAccount], int]:
        conditions = [LoyaltyAccount.vendor_id == vendor_id]
        count_q = select(sqlfunc.count(LoyaltyAccount.id)).where(and_(*conditions))
        total = (await self.db.execute(count_q)).scalar_one()
        q = (
            select(LoyaltyAccount)
            .where(and_(*conditions))
            .order_by(LoyaltyAccount.points_balance.desc())
            .offset((page - 1) * size)
            .limit(size)
        )
        result = await self.db.execute(q)
        return result.scalars().all(), total

    async def get_customer_transactions(
        self, vendor_id: UUID, customer_id: UUID, page: int = 1, size: int = 20,
    ) -> Tuple[List[LoyaltyTransaction], int]:
        conditions = [
            LoyaltyTransaction.vendor_id == vendor_id,
            LoyaltyTransaction.customer_id == customer_id,
        ]
        count_q = select(sqlfunc.count(LoyaltyTransaction.id)).where(and_(*conditions))
        total = (await self.db.execute(count_q)).scalar_one()
        q = (
            select(LoyaltyTransaction)
            .where(and_(*conditions))
            .order_by(LoyaltyTransaction.created_at.desc())
            .offset((page - 1) * size)
            .limit(size)
        )
        result = await self.db.execute(q)
        return result.scalars().all(), total
