"""
Data pipeline service for handling real-time CSV updates
This service provides endpoints for the Node.js backend to update CSV data
"""
import logging
import time
from datetime import datetime
from typing import Dict, Any
from .csv_manager import CSVManager
from ..models.schemas import ProductUpdateRequest, DataPipelineStatus
from ..utils.data_utils import validate_product_data

logger = logging.getLogger(__name__)

class DataPipelineService:
    """Service for managing data pipeline operations"""
    
    def __init__(self):
        self.csv_manager = CSVManager()
        
    async def handle_product_update(self, request: ProductUpdateRequest) -> DataPipelineStatus:
        """Handle product create/update/delete operations"""
        start_time = time.time()
        
        try:
            if request.action == "create":
                return await self._handle_create(request, start_time)
            elif request.action == "update":
                return await self._handle_update(request, start_time)
            elif request.action == "delete":
                return await self._handle_delete(request, start_time)
            else:
                return DataPipelineStatus(
                    success=False,
                    message=f"Unknown action: {request.action}",
                    processing_time_ms=self._get_processing_time(start_time)
                )
                
        except Exception as e:
            logger.error(f"Error handling product update: {e}")
            return DataPipelineStatus(
                success=False,
                message=f"Pipeline error: {str(e)}",
                processing_time_ms=self._get_processing_time(start_time)
            )
    
    async def _handle_create(self, request: ProductUpdateRequest, start_time: float) -> DataPipelineStatus:
        """Handle product creation"""
        if not request.product_data:
            return DataPipelineStatus(
                success=False,
                message="Product data required for create operation",
                processing_time_ms=self._get_processing_time(start_time)
            )
        
        # Convert Pydantic model to dict
        product_dict = request.product_data.model_dump()
        
        # Add to CSV
        success, message = self.csv_manager.add_product(product_dict)
        
        return DataPipelineStatus(
            success=success,
            message=message,
            products_processed=1 if success else 0,
            processing_time_ms=self._get_processing_time(start_time)
        )
    
    async def _handle_update(self, request: ProductUpdateRequest, start_time: float) -> DataPipelineStatus:
        """Handle product update"""
        if not request.product_data:
            return DataPipelineStatus(
                success=False,
                message="Product data required for update operation",
                processing_time_ms=self._get_processing_time(start_time)
            )
        
        # Convert Pydantic model to dict
        product_dict = request.product_data.model_dump()
        
        # Update in CSV
        success, message = self.csv_manager.update_product(product_dict)
        
        return DataPipelineStatus(
            success=success,
            message=message,
            products_processed=1 if success else 0,
            processing_time_ms=self._get_processing_time(start_time)
        )
    
    async def _handle_delete(self, request: ProductUpdateRequest, start_time: float) -> DataPipelineStatus:
        """Handle product deletion"""
        if not request.product_id:
            return DataPipelineStatus(
                success=False,
                message="Product ID required for delete operation",
                processing_time_ms=self._get_processing_time(start_time)
            )
        
        # Delete from CSV
        success, message = self.csv_manager.delete_product(request.product_id)
        
        return DataPipelineStatus(
            success=success,
            message=message,
            products_processed=1 if success else 0,
            processing_time_ms=self._get_processing_time(start_time)
        )
    
    async def bulk_sync_from_mongodb(self, products_data: list) -> DataPipelineStatus:
        """Bulk synchronization from MongoDB (for scheduled updates)"""
        start_time = time.time()
        
        try:
            if not products_data:
                return DataPipelineStatus(
                    success=True,
                    message="No products to sync",
                    products_processed=0,
                    processing_time_ms=self._get_processing_time(start_time)
                )
            
            # Bulk insert/update
            success, message, count = self.csv_manager.bulk_insert(products_data)
            
            return DataPipelineStatus(
                success=success,
                message=message,
                products_processed=count,
                processing_time_ms=self._get_processing_time(start_time)
            )
            
        except Exception as e:
            logger.error(f"Error in bulk sync: {e}")
            return DataPipelineStatus(
                success=False,
                message=f"Bulk sync error: {str(e)}",
                processing_time_ms=self._get_processing_time(start_time)
            )
    
    async def get_pipeline_status(self) -> Dict[str, Any]:
        """Get current status of the data pipeline"""
        try:
            csv_info = self.csv_manager.get_csv_info()
            is_valid, issues = self.csv_manager.validate_csv_integrity()
            
            return {
                "csv_status": "healthy" if is_valid else "issues_detected",
                "csv_info": csv_info,
                "validation_issues": issues,
                "last_check": datetime.now().isoformat()
            }
            
        except Exception as e:
            logger.error(f"Error getting pipeline status: {e}")
            return {
                "csv_status": "error",
                "error": str(e),
                "last_check": datetime.now().isoformat()
            }
    
    def _get_processing_time(self, start_time: float) -> float:
        """Calculate processing time in milliseconds"""
        import time
        return round((time.time() - start_time) * 1000, 2)