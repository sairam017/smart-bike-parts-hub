"""
CSV to MongoDB Importer Script
==============================

This script imports bike parts data from Updated.csv into MongoDB Atlas.
- Database: bike_parts
- Collection: bikeparts
- First runs a test with 10 rows, then imports all data
"""

import pandas as pd
import pymongo
from pymongo import MongoClient
from bson import ObjectId
from datetime import datetime
import os
import sys
from urllib.parse import quote_plus
import json

def load_env_file(env_path):
    """Load environment variables from .env file"""
    env_vars = {}
    try:
        with open(env_path, 'r') as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith('#') and '=' in line:
                    key, value = line.split('=', 1)
                    env_vars[key.strip()] = value.strip()
    except FileNotFoundError:
        print(f"Error: .env file not found at {env_path}")
        sys.exit(1)
    return env_vars

def connect_to_mongodb(mongo_uri):
    """Connect to MongoDB Atlas"""
    try:
        client = pymongo.MongoClient(mongo_uri)
        # Test the connection
        client.admin.command('ping')
        print("✅ Successfully connected to MongoDB Atlas!")
        return client
    except Exception as e:
        print(f"❌ Error connecting to MongoDB: {e}")
        sys.exit(1)

def map_csv_to_mongodb_schema(csv_row):
    """Map CSV row to MongoDB schema structure"""
    
    # Handle images - convert single image URL to array
    images = []
    if pd.notna(csv_row.get('images', '')) and csv_row['images'].strip():
        images = [csv_row['images'].strip()]
    
    # Handle vendor_id - convert string to ObjectId if present
    vendor_id = None
    if pd.notna(csv_row.get('vendor_id', '')) and csv_row['vendor_id'].strip():
        try:
            vendor_id = ObjectId(csv_row['vendor_id'])
        except:
            vendor_id = None
    
    # Handle shop_id - convert string to ObjectId if present
    shop_id = None
    if pd.notna(csv_row.get('shop_id', '')) and csv_row['shop_id'].strip():
        try:
            shop_id = ObjectId(csv_row['shop_id'])
        except:
            shop_id = None
    
    # Handle dates
    created_at = datetime.utcnow()
    updated_at = datetime.utcnow()
    
    if pd.notna(csv_row.get('created_at', '')):
        try:
            created_at = pd.to_datetime(csv_row['created_at']).to_pydatetime()
        except:
            pass
    
    if pd.notna(csv_row.get('updated_at', '')):
        try:
            updated_at = pd.to_datetime(csv_row['updated_at']).to_pydatetime()
        except:
            pass
    
    # Build the document according to the schema
    document = {
        "name": csv_row.get('name', '').strip() if pd.notna(csv_row.get('name', '')) else '',
        "model": csv_row.get('model', '').strip() if pd.notna(csv_row.get('model', '')) else '',
        "company": csv_row.get('company', '').strip() if pd.notna(csv_row.get('company', '')) else '',
        "vehicleYear": int(csv_row['vehicleYear']) if pd.notna(csv_row.get('vehicleYear', '')) and str(csv_row['vehicleYear']).strip() else None,
        "brand": csv_row.get('brand', '').strip() if pd.notna(csv_row.get('brand', '')) else '',
        "type": csv_row.get('type', '').strip() if pd.notna(csv_row.get('type', '')) else '',
        "compatibility": [],  # CSV shows empty arrays, keeping consistent
        "countInStock": int(csv_row['countInStock']) if pd.notna(csv_row.get('countInStock', '')) and str(csv_row['countInStock']).strip() else 0,
        "price": float(csv_row['price']) if pd.notna(csv_row.get('price', '')) and str(csv_row['price']).strip() else 0.0,
        "images": images,
        "description": csv_row.get('description', '').strip() if pd.notna(csv_row.get('description', '')) else '',
        "rating": float(csv_row['rating']) if pd.notna(csv_row.get('rating', '')) and str(csv_row['rating']).strip() else 0.0,
        "numReviews": int(csv_row['numReviews']) if pd.notna(csv_row.get('numReviews', '')) and str(csv_row['numReviews']).strip() else 0,
        "reviews": [],  # Empty array as per schema
        "createdAt": created_at,
        "updatedAt": updated_at,
        "__v": 0  # Version key as per Mongoose schema
    }
    
    # Add vendor and shop only if they exist and are valid ObjectIds
    if vendor_id:
        document["vendor"] = vendor_id
    
    if shop_id:
        document["shop"] = shop_id
    
    return document

def test_import(collection, csv_file_path, num_rows=10):
    """Test import with first 10 rows"""
    print(f"\n🧪 Testing import with first {num_rows} rows...")
    
    try:
        # Read only the first num_rows
        df = pd.read_csv(csv_file_path, nrows=num_rows)
        print(f"✅ Successfully read {len(df)} rows from CSV")
        
        documents = []
        for index, row in df.iterrows():
            try:
                doc = map_csv_to_mongodb_schema(row)
                documents.append(doc)
            except Exception as e:
                print(f"⚠️  Warning: Failed to process row {index + 1}: {e}")
                continue
        
        if documents:
            # Insert documents
            result = collection.insert_many(documents)
            print(f"✅ Successfully inserted {len(result.inserted_ids)} test documents")
            
            # Show sample of inserted data
            sample_doc = collection.find_one({"_id": result.inserted_ids[0]})
            print(f"\n📋 Sample inserted document:")
            print(f"   Name: {sample_doc.get('name', 'N/A')}")
            print(f"   Model: {sample_doc.get('model', 'N/A')}")
            print(f"   Company: {sample_doc.get('company', 'N/A')}")
            print(f"   Price: ₹{sample_doc.get('price', 0)}")
            print(f"   Stock: {sample_doc.get('countInStock', 0)}")
            
            return True
        else:
            print("❌ No documents were successfully processed")
            return False
            
    except Exception as e:
        print(f"❌ Error during test import: {e}")
        return False

def full_import(collection, csv_file_path):
    """Import all data from CSV"""
    print(f"\n🚀 Starting full import...")
    
    try:
        # Read the entire CSV
        df = pd.read_csv(csv_file_path)
        total_rows = len(df)
        print(f"📊 Total rows to process: {total_rows}")
        
        # Process in batches for better performance
        batch_size = 100
        total_inserted = 0
        
        for start_idx in range(0, total_rows, batch_size):
            end_idx = min(start_idx + batch_size, total_rows)
            batch_df = df.iloc[start_idx:end_idx]
            
            documents = []
            for index, row in batch_df.iterrows():
                try:
                    doc = map_csv_to_mongodb_schema(row)
                    documents.append(doc)
                except Exception as e:
                    print(f"⚠️  Warning: Failed to process row {index + 1}: {e}")
                    continue
            
            if documents:
                try:
                    result = collection.insert_many(documents)
                    total_inserted += len(result.inserted_ids)
                    print(f"✅ Batch {start_idx//batch_size + 1}: Inserted {len(result.inserted_ids)} documents (Total: {total_inserted})")
                except Exception as e:
                    print(f"❌ Error inserting batch {start_idx//batch_size + 1}: {e}")
        
        print(f"\n🎉 Full import completed!")
        print(f"📈 Total documents inserted: {total_inserted} out of {total_rows}")
        
        return total_inserted
        
    except Exception as e:
        print(f"❌ Error during full import: {e}")
        return 0

def main():
    print("🚀 Smart Bike Parts Hub - CSV to MongoDB Importer")
    print("=" * 55)
    
    # Paths
    script_dir = os.path.dirname(os.path.abspath(__file__))
    project_root = os.path.dirname(script_dir)
    env_path = os.path.join(project_root, 'server', '.env')
    csv_path = os.path.join(project_root, 'Updated.csv')
    
    # Check if files exist
    if not os.path.exists(csv_path):
        print(f"❌ Error: Updated.csv not found at {csv_path}")
        sys.exit(1)
    
    if not os.path.exists(env_path):
        print(f"❌ Error: .env file not found at {env_path}")
        sys.exit(1)
    
    # Load environment variables
    env_vars = load_env_file(env_path)
    mongo_uri = env_vars.get('MONGO_URI')
    
    if not mongo_uri:
        print("❌ Error: MONGO_URI not found in .env file")
        sys.exit(1)
    
    print(f"📁 CSV file: {csv_path}")
    print(f"🔗 MongoDB URI: {mongo_uri[:50]}...")
    
    # Connect to MongoDB
    client = connect_to_mongodb(mongo_uri)
    db = client['bike_parts']
    collection = db['bikeparts']
    
    print(f"📚 Database: bike_parts")
    print(f"📦 Collection: bikeparts")
    
    # Check current document count
    current_count = collection.count_documents({})
    print(f"📊 Current documents in collection: {current_count}")
    
    # Test import first
    test_success = test_import(collection, csv_path, 10)
    
    if test_success:
        # Ask user if they want to proceed with full import
        print(f"\n❓ Test import successful! Do you want to proceed with full import?")
        choice = input("   Enter 'yes' to continue with full import, 'no' to exit: ").lower().strip()
        
        if choice in ['yes', 'y']:
            # Remove test data first
            new_count = collection.count_documents({})
            test_docs_inserted = new_count - current_count
            
            if test_docs_inserted > 0:
                print(f"\n🧹 Removing {test_docs_inserted} test documents...")
                # Find and remove documents inserted in the last minute
                cutoff_time = datetime.utcnow()
                cutoff_time = cutoff_time.replace(minute=cutoff_time.minute-1)
                result = collection.delete_many({"createdAt": {"$gte": cutoff_time}})
                print(f"✅ Removed {result.deleted_count} test documents")
            
            # Proceed with full import
            total_inserted = full_import(collection, csv_path)
            
            final_count = collection.count_documents({})
            print(f"\n📊 Final document count: {final_count}")
            print(f"✨ Import process completed successfully!")
            
        else:
            print("👋 Import cancelled by user. Test documents remain in database.")
    else:
        print("❌ Test import failed. Please check the data and try again.")
    
    # Close connection
    client.close()
    print("🔒 Database connection closed.")

if __name__ == "__main__":
    main()