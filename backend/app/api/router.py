from fastapi import APIRouter

from app.api.discovery import router as discovery_router

# Business routers are registered here as modules get endpoints (PB-04b, PB-05...).
api_router = APIRouter()
api_router.include_router(discovery_router)
