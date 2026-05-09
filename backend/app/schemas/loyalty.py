from pydantic import BaseModel, Field
from typing import Optional, List


class LoyaltyProgramUpdate(BaseModel):
    is_active: Optional[bool] = None
    name: Optional[str] = None
    points_per_currency: Optional[float] = None
    currency_per_point: Optional[float] = None
    min_redeem_points: Optional[int] = None
    max_redeem_percent: Optional[int] = Field(None, ge=1, le=100)
    signup_bonus: Optional[int] = None
    tier_config: Optional[list] = None


class LoyaltyRedeemRequest(BaseModel):
    customer_id: str
    points: int = Field(gt=0)


class LoyaltyAdjustRequest(BaseModel):
    customer_id: str
    points: int
    description: Optional[str] = None


class LoyaltyAccountResponse(BaseModel):
    id: str
    customer_id: str
    points_balance: int
    lifetime_earned: int
    lifetime_redeemed: int
    tier: str


class LoyaltyTransactionResponse(BaseModel):
    id: str
    type: str
    points: int
    balance_after: int
    description: Optional[str] = None
    reference_type: Optional[str] = None
    created_at: Optional[str] = None
