"""Real Estate vertical API — mounted at ``/vendors/me/realestate``."""
from fastapi import APIRouter

from . import (
    flows_admin, flows_contractors, flows_core, flows_land, flows_operations, flows_postsales, flows_projects, flows_receivables,
    flows_supply, flows_workforce,
)
from . import (  # noqa: F401  (registers resources)
    res_contractors, res_core, res_land, res_operations, res_postsales, res_projects, res_receivables, res_supply, res_workforce,
)
from .crud import build_crud_router
from .public_portal import public_router
from .registry import RESOURCES

router = APIRouter()

# Hand-written workflow routes first so literal paths (``/units/availability``) win over ``/{id}``.
for _flows in (flows_admin, flows_core, flows_receivables, flows_land, flows_projects, flows_supply, flows_contractors,
               flows_postsales, flows_operations, flows_workforce):
    router.include_router(_flows.router)

for _res in RESOURCES:
    router.include_router(build_crud_router(_res), prefix=f"/{_res.key}", tags=[f"RE · {_res.title}"])
