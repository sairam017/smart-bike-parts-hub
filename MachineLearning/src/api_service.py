from fastapi import FastAPI
from pydantic import BaseModel, Field
from typing import List, Dict
from .route_planner import RoutePlanner

app = FastAPI(title="Parts Route Planner")
planner = RoutePlanner()

class ShopIn(BaseModel):
    id: str
    name: str | None = None
    lat: float
    lon: float
    parts: List[str] = Field(default_factory=list)

class PlanRequest(BaseModel):
    origin: Dict[str,float]
    parts: List[str]
    shops: List[ShopIn]

class PlanResponse(BaseModel):
    chosen_shops: List[str]
    order: List[str]
    total_distance_km: float
    uncovered_parts: List[str]
    coverage_ratio: float
    related_suggestions: List[str]

@app.post('/plan', response_model=PlanResponse)
async def plan(req: PlanRequest):
    origin = (req.origin['lat'], req.origin['lon'])
    res = planner.plan(origin, req.parts, [s.model_dump() for s in req.shops])
    return PlanResponse(**res.__dict__)

@app.get('/health')
async def health():
    return {"status":"ok"}
