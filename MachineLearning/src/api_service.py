"""
Enhanced FastAPI service for Smart Bike Parts Recommendation System
Includes data pipeline endpoints for CSV management and model training
"""
from fastapi import FastAPI, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from typing import List, Dict, Any
import logging
import time
from datetime import datetime

# Import existing route planner
from .route_planner import RoutePlanner
from .models.schemas import (
    RecommendationRequest, RecommendationResponse,
    ProductUpdateRequest, DataPipelineStatus,
    ModelTrainingRequest, ModelTrainingResponse,
    HealthCheckResponse
)
from .data_pipeline.pipeline_service import DataPipelineService
from .config.settings import API_HOST, API_PORT

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Initialize FastAPI app
app = FastAPI(
    title="Smart Bike Parts AI Service",
    description="ML-powered recommendations and route planning for bike parts",
    version="1.0.0"
)

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:5000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize services
route_planner = RoutePlanner()
data_pipeline = DataPipelineService()

# Existing route planner models (keeping for compatibility)
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

# ============================================================================
# EXISTING ROUTE PLANNER ENDPOINTS (unchanged)
# ============================================================================

@app.post('/plan', response_model=PlanResponse)
async def plan_route(req: PlanRequest):
    """Plan optimal route for visiting shops to collect bike parts"""
    try:
        origin = (req.origin['lat'], req.origin['lon'])
        res = route_planner.plan(origin, req.parts, [s.model_dump() for s in req.shops])
        return PlanResponse(**res.__dict__)
    except Exception as e:
        logger.error(f"Route planning error: {e}")
        raise HTTPException(status_code=500, detail=f"Route planning failed: {str(e)}")

@app.get('/')
async def health_check():
    """Basic health check"""
    return {"status": "ok", "timestamp": datetime.now().isoformat()}


@app.get('/health')
async def health_check():
    """Basic health check"""
    return {"status": "ok", "timestamp": datetime.now().isoformat()}

# ============================================================================
# NEW DATA PIPELINE ENDPOINTS
# ============================================================================

@app.post('/data-pipeline/update', response_model=DataPipelineStatus)
async def update_csv_data(request: ProductUpdateRequest):
    """Update CSV data when products are created/updated/deleted"""
    try:
        logger.info(f"Processing {request.action} operation for product data pipeline")
        result = await data_pipeline.handle_product_update(request)
        return result
    except Exception as e:
        logger.error(f"Data pipeline update error: {e}")
        raise HTTPException(status_code=500, detail=f"Data pipeline error: {str(e)}")

@app.post('/data-pipeline/bulk-sync', response_model=DataPipelineStatus)
async def bulk_sync_data(products_data: List[Dict[str, Any]]):
    """Bulk synchronization of MongoDB data to CSV"""
    try:
        logger.info(f"Processing bulk sync for {len(products_data)} products")
        result = await data_pipeline.bulk_sync_from_mongodb(products_data)
        return result
    except Exception as e:
        logger.error(f"Bulk sync error: {e}")
        raise HTTPException(status_code=500, detail=f"Bulk sync error: {str(e)}")

@app.get('/data-pipeline/status')
async def get_pipeline_status():
    """Get current status of the data pipeline"""
    try:
        status = await data_pipeline.get_pipeline_status()
        return status
    except Exception as e:
        logger.error(f"Pipeline status error: {e}")
        raise HTTPException(status_code=500, detail=f"Status check error: {str(e)}")

@app.post('/data-pipeline/sync-product')
async def sync_single_product(product_data: Dict[str, Any]):
    """Sync a single product to CSV when it's created or updated from Node.js"""
    try:
        logger.info(f"Syncing single product: {product_data.get('name', 'Unknown')}")
        
        # Transform MongoDB document to match our schema
        transformed_data = {
            "product_id": str(product_data.get('_id', '')),
            "name": product_data.get('name'),
            "model": product_data.get('model'),
            "company": product_data.get('company'),
            "vehicleYear": product_data.get('vehicleYear'),
            "brand": product_data.get('brand'),
            "type": product_data.get('type'),
            "price": float(product_data.get('price', 0)),
            "description": product_data.get('description'),
            "countInStock": product_data.get('countInStock', 0),
            "rating": float(product_data.get('rating', 0)),
            "numReviews": product_data.get('numReviews', 0),
            "compatibility": product_data.get('compatibility', []),
            "images": product_data.get('images', []),
            "vendor_id": str(product_data.get('vendor', '')),
            "shop_id": str(product_data.get('shop', '')),
            "shop_name": product_data.get('shop_name'),
            "shop_address": product_data.get('shop_address'),
            "shop_lat": product_data.get('shop_lat'),
            "shop_lon": product_data.get('shop_lon'),
            "created_at": product_data.get('createdAt'),
            "updated_at": product_data.get('updatedAt')
        }
        
        # Create the ProductUpdateRequest with transformed data
        update_request = ProductUpdateRequest(
            action="create",
            product_data=transformed_data
        )
        
        result = await data_pipeline.handle_product_update(update_request)
        return {
            "success": True,
            "message": f"Product '{product_data.get('name', 'Unknown')}' synced to CSV",
            "product_id": transformed_data["product_id"]
        }
    except Exception as e:
        logger.error(f"Single product sync error: {e}")
        raise HTTPException(status_code=500, detail=f"Product sync error: {str(e)}")

# ============================================================================
# MODEL TRAINING ENDPOINTS (Placeholder - to be implemented)
# ============================================================================

@app.post('/model/train', response_model=ModelTrainingResponse)
async def train_recommendation_model(request: ModelTrainingRequest, background_tasks: BackgroundTasks):
    """Trigger model training (manual trigger from frontend)"""
    try:
        logger.info("Model training requested")
        
        # For now, return a placeholder response
        # TODO: Implement actual model training
        return ModelTrainingResponse(
            success=True,
            message="Model training initiated (placeholder)",
            model_version="v1.0.0-placeholder",
            training_time_ms=0.0,
            products_count=0,
            similarity_matrix_size=(0, 0),
            performance_metrics={}
        )
    except Exception as e:
        logger.error(f"Model training error: {e}")
        raise HTTPException(status_code=500, detail=f"Model training error: {str(e)}")

@app.get('/model/status')
async def get_model_status():
    """Get current model status and information"""
    try:
        # TODO: Implement actual model status checking
        return {
            "model_version": "v1.0.0-placeholder",
            "last_trained": None,
            "status": "not_trained",
            "products_count": 0,
            "model_file_exists": False
        }
    except Exception as e:
        logger.error(f"Model status error: {e}")
        raise HTTPException(status_code=500, detail=f"Model status error: {str(e)}")

# ============================================================================
# RECOMMENDATION ENDPOINTS (Placeholder - to be implemented)
# ============================================================================

@app.post('/recommendations/similar', response_model=RecommendationResponse)
async def get_similar_products(request: RecommendationRequest):
    """Get product recommendations based on similarity"""
    try:
        logger.info(f"Recommendations requested for product: {request.product_id}")
        
        # TODO: Implement actual recommendation logic
        return RecommendationResponse(
            product_id=request.product_id,
            recommendations=[],
            total_found=0,
            processing_time_ms=0.0,
            model_version="v1.0.0-placeholder"
        )
    except Exception as e:
        logger.error(f"Recommendation error: {e}")
        raise HTTPException(status_code=500, detail=f"Recommendation error: {str(e)}")

# ============================================================================
# ENHANCED HEALTH CHECK
# ============================================================================

@app.get('/health/detailed', response_model=HealthCheckResponse)
async def detailed_health_check():
    """Detailed health check including data pipeline and model status"""
    try:
        # Check data pipeline status
        pipeline_status = await data_pipeline.get_pipeline_status()
        pipeline_health = "healthy" if pipeline_status.get("csv_status") == "healthy" else "unhealthy"
        
        # Check CSV records count
        csv_info = pipeline_status.get("csv_info", {})
        csv_count = csv_info.get("total_products", 0)
        
        return HealthCheckResponse(
            status="healthy",
            data_pipeline_status=pipeline_health,
            model_status="not_trained",  # TODO: Check actual model status
            csv_records_count=csv_count,
            last_training_time=None  # TODO: Get actual last training time
        )
    except Exception as e:
        logger.error(f"Health check error: {e}")
        return HealthCheckResponse(
            status="unhealthy",
            data_pipeline_status="error",
            model_status="error"
        )

# ============================================================================
# STARTUP/SHUTDOWN EVENTS
# ============================================================================

@app.on_event("startup")
async def startup_event():
    """Initialize services on startup"""
    logger.info("Starting Smart Bike Parts AI Service")
    logger.info("Route planner: Ready")
    logger.info("Data pipeline: Ready")
    logger.info("Recommendation engine: Not yet implemented")

@app.on_event("shutdown")
async def shutdown_event():
    """Cleanup on shutdown"""
    logger.info("Shutting down Smart Bike Parts AI Service")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host=API_HOST, port=API_PORT, reload=True)
