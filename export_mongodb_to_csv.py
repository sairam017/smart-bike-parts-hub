"""
One-time script to export existing MongoDB data to CSV
Run this script to populate the CSV file with existing product data
"""
import sys
import os
import asyncio
from pathlib import Path
from typing import List, Dict, Any
import time

# Load environment variables from .env file
try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    print("Warning: python-dotenv not installed. Environment variables from .env won't be loaded.")

# Add the project root to Python path
current_dir = Path(__file__).parent
project_root = current_dir.parent
sys.path.append(str(project_root))

from MachineLearning.src.data_pipeline.csv_manager import CSVManager
from MachineLearning.src.config.settings import MONGODB_URI, MONGODB_DB_NAME

# Optional: Try to import pymongo if available
try:
    from pymongo import MongoClient
    HAS_PYMONGO = True
except ImportError:
    HAS_PYMONGO = False
    print("Warning: pymongo not installed. Will use API-based export instead.")

class MongoDBExporter:
    """Exports data from MongoDB to CSV for ML training"""
    
    def __init__(self, mongo_uri: str = None, db_name: str = None):
        self.mongo_uri = mongo_uri or MONGODB_URI
        self.db_name = db_name or MONGODB_DB_NAME
        self.csv_manager = CSVManager()
        
    def export_via_pymongo(self) -> tuple[bool, str, int]:
        """Export data directly from MongoDB using pymongo"""
        if not HAS_PYMONGO:
            return False, "pymongo not available", 0
        
        try:
            # Connect to MongoDB
            client = MongoClient(self.mongo_uri)
            db = client[self.db_name]
            
            # Debug: List all collections
            collections = db.list_collection_names()
            print(f"Available collections: {collections}")
            
            # Get collections
            bike_parts = db.bikeparts
            shops = db.shops
            users = db.users
            
            print("Connected to MongoDB successfully")
            print(f"Database: {self.db_name}")
            
            # Debug: Check document counts
            bike_parts_count = bike_parts.count_documents({})
            shops_count = shops.count_documents({})
            users_count = users.count_documents({})
            print(f"Document counts - bikeparts: {bike_parts_count}, shops: {shops_count}, users: {users_count}")
            
            # Create lookup dictionaries for shops and vendors
            print("Loading shops data...")
            shops_data = {}
            for shop in shops.find():
                shop_id = str(shop['_id'])
                shops_data[shop_id] = {
                    'shop_name': shop.get('name', ''),
                    'shop_address': shop.get('address', ''),
                    'shop_lat': shop.get('location', {}).get('coordinates', [None, None])[1],
                    'shop_lon': shop.get('location', {}).get('coordinates', [None, None])[0],
                    'vendor_id': str(shop.get('vendor', ''))
                }
            
            print(f"Loaded {len(shops_data)} shops")
            
            # Load vendors data
            print("Loading vendors data...")
            vendors_data = {}
            for user in users.find({'role': {'$in': ['vendor', 'admin']}}):
                vendor_id = str(user['_id'])
                vendors_data[vendor_id] = {
                    'vendor_name': user.get('name', ''),
                    'vendor_email': user.get('email', '')
                }
            
            print(f"Loaded {len(vendors_data)} vendors")
            
            # Export bike parts
            print("Exporting bike parts...")
            products_data = []
            
            for part in bike_parts.find():
                product_id = str(part['_id'])
                shop_id = str(part.get('shop', ''))
                vendor_id = str(part.get('vendor', ''))
                
                # Get shop information
                shop_info = shops_data.get(shop_id, {})
                
                # Prepare product data
                product_data = {
                    'product_id': product_id,
                    'name': part.get('name', ''),
                    'model': part.get('model', ''),
                    'company': part.get('company', ''),
                    'vehicleYear': part.get('vehicleYear'),
                    'brand': part.get('brand', ''),
                    'type': part.get('type', ''),
                    'price': float(part.get('price', 0)),
                    'description': part.get('description', ''),
                    'countInStock': int(part.get('countInStock', 0)),
                    'rating': float(part.get('rating', 0)),
                    'numReviews': int(part.get('numReviews', 0)),
                    'compatibility': part.get('compatibility', []),
                    'images': part.get('images', []),
                    'vendor_id': vendor_id,
                    'shop_id': shop_id,
                    'shop_name': shop_info.get('shop_name', ''),
                    'shop_address': shop_info.get('shop_address', ''),
                    'shop_lat': shop_info.get('shop_lat'),
                    'shop_lon': shop_info.get('shop_lon'),
                    'created_at': part.get('createdAt'),
                    'updated_at': part.get('updatedAt')
                }
                
                products_data.append(product_data)
            
            print(f"Prepared {len(products_data)} products for export")
            
            # Bulk insert to CSV
            if products_data:
                success, message, count = self.csv_manager.bulk_insert(products_data)
                client.close()
                return success, message, count
            else:
                client.close()
                return True, "No products found to export", 0
                
        except Exception as e:
            print(f"Error exporting via pymongo: {e}")
            return False, f"Export error: {str(e)}", 0
    
    def export_via_api(self, api_base_url: str = "http://localhost:5000/api") -> tuple[bool, str, int]:
        """Export data by calling the Node.js API endpoints"""
        try:
            import requests
            
            print("Exporting data via API...")
            
            # Get all products
            products_response = requests.get(f"{api_base_url}/products?pageSize=1000")
            if products_response.status_code != 200:
                return False, f"Failed to fetch products: {products_response.status_code}", 0
            
            products_data = products_response.json()
            products = products_data.get('products', [])
            
            if not products:
                return True, "No products found to export", 0
            
            print(f"Found {len(products)} products")
            
            # Transform API data to CSV format
            csv_products = []
            for product in products:
                shop = product.get('shop', {})
                
                product_data = {
                    'product_id': product.get('_id', ''),
                    'name': product.get('name', ''),
                    'model': product.get('model', ''),
                    'company': product.get('company', ''),
                    'vehicleYear': product.get('vehicleYear'),
                    'brand': product.get('brand', ''),
                    'type': product.get('type', ''),
                    'price': float(product.get('price', 0)),
                    'description': product.get('description', ''),
                    'countInStock': int(product.get('countInStock', 0)),
                    'rating': float(product.get('rating', 0)),
                    'numReviews': int(product.get('numReviews', 0)),
                    'compatibility': product.get('compatibility', []),
                    'images': product.get('images', []),
                    'vendor_id': product.get('vendor', ''),
                    'shop_id': product.get('shop_id', shop.get('_id', '')),
                    'shop_name': shop.get('name', ''),
                    'shop_address': shop.get('address', ''),
                    'shop_lat': shop.get('location', {}).get('coordinates', [None, None])[1] if shop.get('location') else None,
                    'shop_lon': shop.get('location', {}).get('coordinates', [None, None])[0] if shop.get('location') else None,
                    'created_at': product.get('createdAt'),
                    'updated_at': product.get('updatedAt')
                }
                
                csv_products.append(product_data)
            
            # Bulk insert to CSV
            success, message, count = self.csv_manager.bulk_insert(csv_products)
            return success, message, count
            
        except ImportError:
            return False, "requests library not available for API export", 0
        except Exception as e:
            print(f"Error exporting via API: {e}")
            return False, f"API export error: {str(e)}", 0
    
    def run_export(self, method: str = "auto") -> tuple[bool, str, int]:
        """Run the export process"""
        print("=== MongoDB to CSV Export ===")
        print(f"Export method: {method}")
        
        start_time = time.time()
        
        if method == "pymongo" or (method == "auto" and HAS_PYMONGO):
            print("Using direct MongoDB connection...")
            success, message, count = self.export_via_pymongo()
        elif method == "api" or method == "auto":
            print("Using API-based export...")
            success, message, count = self.export_via_api()
        else:
            return False, f"Unknown export method: {method}", 0
        
        end_time = time.time()
        processing_time = round((end_time - start_time) * 1000, 2)
        
        print(f"\nExport completed in {processing_time}ms")
        print(f"Success: {success}")
        print(f"Message: {message}")
        print(f"Products exported: {count}")
        
        if success:
            # Show CSV info
            csv_info = self.csv_manager.get_csv_info()
            print(f"\nCSV Info:")
            print(f"  File: {csv_info.get('file_path')}")
            print(f"  Size: {csv_info.get('file_size_mb', 0)} MB")
            print(f"  Total products: {csv_info.get('total_products', 0)}")
        
        return success, message, count

def main():
    """Main function for command-line usage"""
    import argparse
    
    parser = argparse.ArgumentParser(description='Export MongoDB data to CSV for ML training')
    parser.add_argument('--method', choices=['auto', 'pymongo', 'api'], default='auto',
                        help='Export method: auto (try pymongo first), pymongo (direct), or api (via REST)')
    parser.add_argument('--mongo-uri', help='MongoDB connection URI')
    parser.add_argument('--db-name', help='MongoDB database name')
    
    args = parser.parse_args()
    
    # Create exporter
    exporter = MongoDBExporter(
        mongo_uri=args.mongo_uri,
        db_name=args.db_name
    )
    
    # Run export
    success, message, count = exporter.run_export(method=args.method)
    
    # Exit with appropriate code
    sys.exit(0 if success else 1)

if __name__ == "__main__":
    main()