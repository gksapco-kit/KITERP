# app/schemas/bank_account.py
from pydantic import BaseModel, Field, field_validator
from typing import Optional
from enum import Enum
import re


class AccountType(str, Enum):
    SAVINGS = "savings"
    CURRENT = "current"


class BankAccountCreate(BaseModel):
    bank_name: str = Field(..., min_length=2, max_length=255)
    account_number: str = Field(..., min_length=8, max_length=20)
    account_holder_name: str = Field(..., min_length=2, max_length=255)
    ifsc_code: str = Field(..., min_length=11, max_length=11)
    account_type: AccountType = AccountType.SAVINGS
    is_primary: bool = True

    @field_validator("ifsc_code")
    @classmethod
    def validate_ifsc(cls, v: str) -> str:
        if not re.match(r"^[A-Z]{4}0[A-Z0-9]{6}$", v.upper()):
            raise ValueError("Invalid IFSC code format")
        return v.upper()

    @field_validator("account_number")
    @classmethod
    def validate_account_number(cls, v: str) -> str:
        if not v.isdigit():
            raise ValueError("Account number must contain only digits")
        return v


class BankAccountUpdate(BaseModel):
    is_primary: Optional[bool] = None


class BankAccountResponse(BaseModel):
    id: str
    vendor_id: str
    bank_name: str
    account_number: str
    account_holder_name: str
    ifsc_code: str
    account_type: AccountType
    is_primary: bool
    is_verified: bool
    verified_at: Optional[str] = None
    created_at: Optional[str] = None
