import asyncio, json, os
from uuid import uuid4
from datetime import date
import asyncpg

DB = os.environ.get("DATABASE_URL", "postgresql+asyncpg://postgres:postgres@kiterp-postgres:5432/kiterp")
DB = DB.replace("postgresql+asyncpg://", "postgresql://").replace("postgresql+psycopg2://", "postgresql://")

TEMPLATES = [
    dict(basic=45000, hra=18000, da=5000, special=8000, conv=2000, pf=5400, esi=1125, pt=200, tds=0),
    dict(basic=35000, hra=14000, da=4000, special=6000, conv=1600, pf=4200, esi=878,  pt=200, tds=0),
    dict(basic=28000, hra=11200, da=3000, special=4500, conv=1400, pf=3360, esi=703,  pt=150, tds=0),
    dict(basic=22000, hra=8800,  da=2500, special=3500, conv=1200, pf=2640, esi=550,  pt=150, tds=0),
    dict(basic=55000, hra=22000, da=6000, special=10000,conv=2500, pf=6600, esi=1375, pt=200, tds=2000),
    dict(basic=18000, hra=7200,  da=2000, special=2800, conv=1000, pf=2160, esi=450,  pt=100, tds=0),
    dict(basic=42000, hra=16800, da=5000, special=7000, conv=2000, pf=5040, esi=1050, pt=200, tds=0),
    dict(basic=32000, hra=12800, da=3500, special=5500, conv=1500, pf=3840, esi=800,  pt=150, tds=0),
    dict(basic=25000, hra=10000, da=3000, special=4000, conv=1300, pf=3000, esi=625,  pt=150, tds=0),
    dict(basic=15000, hra=6000,  da=1500, special=2500, conv=800,  pf=1800, esi=375,  pt=100, tds=0),
    dict(basic=38000, hra=15200, da=4500, special=6500, conv=1800, pf=4560, esi=950,  pt=200, tds=0),
]

async def main():
    conn = await asyncpg.connect(DB)
    emps = await conn.fetch(
        "SELECT id, employee_code FROM hr_employee_profile WHERE status='active' ORDER BY employee_code"
    )
    print(f"Found {len(emps)} active employees")
    deleted = await conn.execute("DELETE FROM hr_salary_structure")
    print(f"Cleared: {deleted}")

    for i, emp in enumerate(emps):
        t = TEMPLATES[i % len(TEMPLATES)]
        earnings = {
            "Basic": t["basic"], "HRA": t["hra"], "DA": t["da"],
            "Special Allowance": t["special"], "Conveyance": t["conv"]
        }
        deductions = {
            "PF Employee": t["pf"], "ESI Employee": t["esi"], "Professional Tax": t["pt"]
        }
        if t["tds"]:
            deductions["TDS"] = t["tds"]

        gross = sum(earnings.values())
        total_ded = sum(deductions.values())
        net = gross - total_ded

        await conn.execute(
            """INSERT INTO hr_salary_structure
               (id, employee_id, effective_from, is_active, earnings, deductions,
                ctc_annual, ctc_monthly, gross_monthly, net_monthly)
               VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)""",
            uuid4(), emp["id"], date(2026, 1, 1), True,
            json.dumps(earnings), json.dumps(deductions),
            float(gross * 12), float(gross), float(gross), float(net)
        )
        print(f"  {emp['employee_code']}: gross=Rs.{gross:,}  net=Rs.{net:,}")

    await conn.close()
    print("\nAll salary structures created successfully!")

asyncio.run(main())
