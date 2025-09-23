"""
CSV file management for the recommendation system
"""
import pandas as pd
import os
import shutil
from typing import List, Dict, Any, Optional
from datetime import datetime
import logging
from ..config.settings import CSV_FILE_PATH, CSV_COLUMNS
from ..utils.data_utils import prepare_csv_row, validate_product_data

logger = logging.getLogger(__name__)

class CSVManager:
    """Manages CSV file operations for product data"""
    
    def __init__(self, csv_path: str = None):
        self.csv_path = csv_path or CSV_FILE_PATH
        self.ensure_csv_exists()
    
    def ensure_csv_exists(self):
        """Ensure CSV file exists with proper headers"""
        if not os.path.exists(self.csv_path):
            # Create directory if it doesn't exist
            os.makedirs(os.path.dirname(self.csv_path), exist_ok=True)
            
            # Create empty CSV with headers
            df = pd.DataFrame(columns=CSV_COLUMNS)
            df.to_csv(self.csv_path, index=False)
            logger.info(f"Created new CSV file at {self.csv_path}")
    
    def backup_csv(self) -> str:
        """Create a backup of the current CSV file"""
        if not os.path.exists(self.csv_path):
            return ""
        
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        backup_path = f"{self.csv_path}.backup_{timestamp}"
        shutil.copy2(self.csv_path, backup_path)
        logger.info(f"Created CSV backup at {backup_path}")
        return backup_path
    
    def load_csv(self) -> pd.DataFrame:
        """Load CSV data into DataFrame"""
        try:
            if os.path.exists(self.csv_path) and os.path.getsize(self.csv_path) > 0:
                df = pd.read_csv(self.csv_path)
                
                # Ensure all required columns exist
                for col in CSV_COLUMNS:
                    if col not in df.columns:
                        df[col] = ""
                
                return df[CSV_COLUMNS]  # Reorder columns
            else:
                return pd.DataFrame(columns=CSV_COLUMNS)
        except Exception as e:
            logger.error(f"Error loading CSV: {e}")
            # Return empty DataFrame with correct columns if loading fails
            return pd.DataFrame(columns=CSV_COLUMNS)
    
    def save_csv(self, df: pd.DataFrame) -> bool:
        """Save DataFrame to CSV file"""
        try:
            # Ensure DataFrame has correct columns in correct order
            df = df.reindex(columns=CSV_COLUMNS, fill_value="")
            
            # Create backup before saving
            if os.path.exists(self.csv_path):
                self.backup_csv()
            
            # Save to CSV
            df.to_csv(self.csv_path, index=False)
            logger.info(f"Saved CSV with {len(df)} records")
            return True
        except Exception as e:
            logger.error(f"Error saving CSV: {e}")
            return False
    
    def add_product(self, product_data: Dict[str, Any]) -> tuple[bool, str]:
        """Add a new product to CSV"""
        try:
            # Validate product data
            is_valid, errors = validate_product_data(product_data)
            if not is_valid:
                return False, f"Validation errors: {'; '.join(errors)}"
            
            # Load existing data
            df = self.load_csv()
            
            # Check if product already exists (more robust check)
            product_id = str(product_data.get('product_id', '')).strip()
            if not product_id:
                return False, "Product ID is required"
            
            # Convert existing product_ids to strings for comparison
            existing_ids = df['product_id'].astype(str).str.strip()
            if product_id in existing_ids.values:
                logger.warning(f"Duplicate product detected: {product_id}. Skipping addition.")
                return False, f"Product {product_id} already exists. Use update_product instead."
            
            # Log the addition attempt
            logger.info(f"Adding new product to CSV: {product_id} - {product_data.get('name', 'Unknown')}")
            
            # Prepare CSV row
            csv_row = prepare_csv_row(product_data)
            
            # Add to DataFrame
            new_row = pd.DataFrame([csv_row])
            df = pd.concat([df, new_row], ignore_index=True)
            
            # Save CSV
            success = self.save_csv(df)
            if success:
                logger.info(f"Successfully added product {product_id} to CSV")
                return True, f"Product {product_id} added successfully"
            else:
                logger.error(f"Failed to save CSV after adding product {product_id}")
                return False, "Failed to save CSV file"
                
        except Exception as e:
            logger.error(f"Error adding product: {e}")
            return False, f"Error adding product: {str(e)}"
    
    def update_product(self, product_data: Dict[str, Any]) -> tuple[bool, str]:
        """Update an existing product in CSV"""
        try:
            # Validate product data
            is_valid, errors = validate_product_data(product_data)
            if not is_valid:
                return False, f"Validation errors: {'; '.join(errors)}"
            
            # Load existing data
            df = self.load_csv()
            
            # Check if product exists
            product_id = product_data.get('product_id')
            if product_id not in df['product_id'].values:
                return False, f"Product {product_id} not found. Use add_product instead."
            
            # Prepare CSV row
            csv_row = prepare_csv_row(product_data)
            
            # Update the row
            mask = df['product_id'] == product_id
            for col, value in csv_row.items():
                df.loc[mask, col] = value
            
            # Update timestamp
            df.loc[mask, 'updated_at'] = datetime.now().isoformat()
            
            # Save CSV
            success = self.save_csv(df)
            if success:
                return True, f"Product {product_id} updated successfully"
            else:
                return False, "Failed to save CSV file"
                
        except Exception as e:
            logger.error(f"Error updating product: {e}")
            return False, f"Error updating product: {str(e)}"
    
    def delete_product(self, product_id: str) -> tuple[bool, str]:
        """Delete a product from CSV"""
        try:
            # Load existing data
            df = self.load_csv()
            
            # Check if product exists
            if product_id not in df['product_id'].values:
                return False, f"Product {product_id} not found"
            
            # Remove the product
            df = df[df['product_id'] != product_id]
            
            # Save CSV
            success = self.save_csv(df)
            if success:
                return True, f"Product {product_id} deleted successfully"
            else:
                return False, "Failed to save CSV file"
                
        except Exception as e:
            logger.error(f"Error deleting product: {e}")
            return False, f"Error deleting product: {str(e)}"
    
    def bulk_insert(self, products_data: List[Dict[str, Any]]) -> tuple[bool, str, int]:
        """Insert multiple products in bulk"""
        try:
            if not products_data:
                return False, "No products provided", 0
            
            successful_inserts = 0
            errors = []
            
            # Load existing data
            df = self.load_csv()
            existing_ids = set(df['product_id'].values)
            
            # Prepare new rows
            new_rows = []
            for product_data in products_data:
                # Validate product data
                is_valid, validation_errors = validate_product_data(product_data)
                if not is_valid:
                    errors.append(f"Product {product_data.get('product_id', 'unknown')}: {'; '.join(validation_errors)}")
                    continue
                
                product_id = product_data.get('product_id')
                if product_id in existing_ids:
                    errors.append(f"Product {product_id} already exists, skipping")
                    continue
                
                # Prepare CSV row
                csv_row = prepare_csv_row(product_data)
                new_rows.append(csv_row)
                existing_ids.add(product_id)
                successful_inserts += 1
            
            # Add new rows to DataFrame
            if new_rows:
                new_df = pd.DataFrame(new_rows)
                df = pd.concat([df, new_df], ignore_index=True)
                
                # Save CSV
                success = self.save_csv(df)
                if not success:
                    return False, "Failed to save CSV file", 0
            
            message = f"Successfully inserted {successful_inserts} products"
            if errors:
                message += f". Errors: {'; '.join(errors[:5])}"  # Show first 5 errors
                if len(errors) > 5:
                    message += f" and {len(errors) - 5} more errors"
            
            return True, message, successful_inserts
            
        except Exception as e:
            logger.error(f"Error in bulk insert: {e}")
            return False, f"Error in bulk insert: {str(e)}", 0
    
    def get_product_count(self) -> int:
        """Get total number of products in CSV"""
        try:
            df = self.load_csv()
            return len(df)
        except Exception as e:
            logger.error(f"Error getting product count: {e}")
            return 0
    
    def get_csv_info(self) -> Dict[str, Any]:
        """Get information about the CSV file"""
        try:
            df = self.load_csv()
            
            info = {
                "file_path": str(self.csv_path),
                "file_exists": os.path.exists(self.csv_path),
                "file_size_mb": 0,
                "total_products": len(df),
                "columns": list(df.columns),
                "last_modified": None
            }
            
            if os.path.exists(self.csv_path):
                file_size = os.path.getsize(self.csv_path)
                info["file_size_mb"] = round(file_size / (1024 * 1024), 2)
                
                mod_time = os.path.getmtime(self.csv_path)
                info["last_modified"] = datetime.fromtimestamp(mod_time).isoformat()
            
            # Add some statistics if data exists
            if not df.empty:
                info.update({
                    "companies": df['company'].nunique(),
                    "types": df['type'].nunique(),
                    "brands": df['brand'].nunique(),
                    "price_range": {
                        "min": float(df['price'].min()) if 'price' in df.columns else 0,
                        "max": float(df['price'].max()) if 'price' in df.columns else 0,
                        "avg": float(df['price'].mean()) if 'price' in df.columns else 0
                    }
                })
            
            return info
            
        except Exception as e:
            logger.error(f"Error getting CSV info: {e}")
            return {"error": str(e)}
    
    def validate_csv_integrity(self) -> tuple[bool, List[str]]:
        """Validate CSV file integrity"""
        try:
            df = self.load_csv()
            issues = []
            
            # Check for required columns
            missing_columns = set(CSV_COLUMNS) - set(df.columns)
            if missing_columns:
                issues.append(f"Missing columns: {', '.join(missing_columns)}")
            
            # Check for duplicate product IDs
            if df['product_id'].duplicated().any():
                duplicates = df[df['product_id'].duplicated()]['product_id'].tolist()
                issues.append(f"Duplicate product IDs: {', '.join(duplicates[:5])}")
            
            # Check for missing critical data
            critical_fields = ['product_id', 'price', 'vendor_id', 'shop_id']
            for field in critical_fields:
                if field in df.columns:
                    missing_count = df[field].isna().sum()
                    if missing_count > 0:
                        issues.append(f"Missing {field} in {missing_count} records")
            
            # Check price ranges
            if 'price' in df.columns:
                invalid_prices = df[(df['price'] <= 0) | (df['price'] > 1000000)]
                if not invalid_prices.empty:
                    issues.append(f"Invalid prices in {len(invalid_prices)} records")
            
            return len(issues) == 0, issues
            
        except Exception as e:
            logger.error(f"Error validating CSV: {e}")
            return False, [f"Validation error: {str(e)}"]