"""
Data models for the recommendation system
"""
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
from datetime import datetime

class ProductData(BaseModel):
    """Model for product data from MongoDB"""
    product_id: str
    name: Optional[str] = None
    model: Optional[str] = None
    company: Optional[str] = None
    vehicleYear: Optional[int] = None
    brand: Optional[str] = None
    type: Optional[str] = None
    price: float
    description: Optional[str] = None
    countInStock: int = 0
    rating: float = 0.0
    numReviews: int = 0
    compatibility: List[str] = Field(default_factory=list)
    images: List[str] = Field(default_factory=list)
    vendor_id: str
    shop_id: str
    shop_name: Optional[str] = None
    shop_address: Optional[str] = None
    shop_lat: Optional[float] = None
    shop_lon: Optional[float] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

class ProcessedProductData(ProductData):
    """Product data with processed features for ML"""
    price_category: Optional[str] = None
    year_category: Optional[str] = None
    rating_tier: Optional[str] = None
    text_combined: Optional[str] = None
    compatibility_count: int = 0

class RecommendationRequest(BaseModel):
    """Request model for getting recommendations"""
    product_id: str
    num_recommendations: int = Field(default=5, ge=1, le=20)
    include_out_of_stock: bool = False
    price_range_factor: float = Field(default=0.2, ge=0.0, le=1.0)  # ±20% price range
    same_shop_boost: float = Field(default=0.1, ge=0.0, le=0.5)

class RecommendationResponse(BaseModel):
    """Response model for recommendations"""
    model_config = {"protected_namespaces": ()}
    
    product_id: str
    recommendations: List[Dict[str, Any]]
    total_found: int
    processing_time_ms: float
    model_version: Optional[str] = None

class ProductUpdateRequest(BaseModel):
    """Request model for updating CSV with new/updated product"""
    action: str = Field(..., pattern="^(create|update|delete)$")
    product_data: Optional[ProductData] = None
    product_id: Optional[str] = None  # For delete operations

class DataPipelineStatus(BaseModel):
    """Status model for data pipeline operations"""
    success: bool
    message: str
    products_processed: int = 0
    processing_time_ms: float = 0
    timestamp: datetime = Field(default_factory=datetime.now)

class ModelTrainingRequest(BaseModel):
    """Request model for manual model training trigger"""
    force_retrain: bool = False
    include_validation: bool = True
    
class ModelTrainingResponse(BaseModel):
    """Response model for model training"""
    model_config = {"protected_namespaces": ()}
    
    success: bool
    message: str
    model_version: str
    training_time_ms: float
    products_count: int
    similarity_matrix_size: tuple
    performance_metrics: Dict[str, float] = Field(default_factory=dict)

class HealthCheckResponse(BaseModel):
    """Health check response model"""
    model_config = {"protected_namespaces": ()}
    
    status: str
    timestamp: datetime = Field(default_factory=datetime.now)
    version: str = "1.0.0"
    data_pipeline_status: str
    model_status: str
    csv_records_count: int = 0
    last_training_time: Optional[datetime] = None