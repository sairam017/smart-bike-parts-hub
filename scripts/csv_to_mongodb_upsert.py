"""
CSV to MongoDB Upsert Script
============================

This script upserts bike parts data from Updated.csv into MongoDB Atlas.
- Checks for existing documents using name + model + company as unique identifiers
- Updates existing documents with vendor/shop ObjectIds
- Inserts new documents if not found
- Database: bike_parts
- Collection: bikeparts
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

def is_valid_objectid(oid_string):
    """Check if string is a valid ObjectId format"""
    if not oid_string or pd.isna(oid_string):
        return False
    oid_string = str(oid_string).strip()
    if len(oid_string) != 24:
        return False
    try:
        int(oid_string, 16)  # Check if it's valid hex
        return True
    except ValueError:
        return False

def map_csv_to_mongodb_schema(csv_row):
    """Map CSV row to MongoDB schema structure"""
    
    # Handle images - convert single image URL to array
    images = []
    if pd.notna(csv_row.get('images', '')) and csv_row['images'].strip():
        images = [csv_row['images'].strip()]
    
    # Handle vendor_id - convert string to ObjectId if valid
    vendor_id = None
    vendor_id_str = str(csv_row.get('vendor_id', '')).strip()
    if is_valid_objectid(vendor_id_str):
        try:
            vendor_id = ObjectId(vendor_id_str)
        except Exception as e:
            print(f"⚠️  Warning: Invalid vendor_id '{vendor_id_str}': {e}")
    
    # Handle shop_id - convert string to ObjectId if valid
    shop_id = None
    shop_id_str = str(csv_row.get('shop_id', '')).strip()
    if is_valid_objectid(shop_id_str):
        try:
            shop_id = ObjectId(shop_id_str)
        except Exception as e:
            print(f"⚠️  Warning: Invalid shop_id '{shop_id_str}': {e}")
    
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
        "updatedAt": updated_at,
        "__v": 0  # Version key as per Mongoose schema
    }
    
    # Add vendor and shop only if they exist and are valid ObjectIds
    if vendor_id:
        document["vendor"] = vendor_id
    
    if shop_id:
        document["shop"] = shop_id
    
    # Only add createdAt for new documents (will be handled in upsert logic)
    document["createdAt"] = created_at
    
    return document

def create_unique_query(csv_row):
    """Create a query to find existing document using unique identifiers"""
    # Use name + model + company as unique identifiers
    query = {}
    
    name = csv_row.get('name', '').strip() if pd.notna(csv_row.get('name', '')) else ''
    model = csv_row.get('model', '').strip() if pd.notna(csv_row.get('model', '')) else ''
    company = csv_row.get('company', '').strip() if pd.notna(csv_row.get('company', '')) else ''
    
    if name:
        query["name"] = name
    if model:
        query["model"] = model
    if company:
        query["company"] = company
    
    return query

def upsert_document(collection, csv_row, stats):
    """Upsert a single document - update if exists, insert if new"""
    try:
        # Create document from CSV row
        document = map_csv_to_mongodb_schema(csv_row)
        
        # Create query to find existing document
        query = create_unique_query(csv_row)
        
        if not query:
            print(f"⚠️  Warning: Cannot create query for row - missing name/model/company")
            stats['skipped'] += 1
            return None
        
        # Check if document exists
        existing_doc = collection.find_one(query)
        
        if existing_doc:
            # Document exists - update it
            update_data = {"$set": document.copy()}
            
            # Don't update createdAt for existing documents
            if "createdAt" in update_data["$set"]:
                del update_data["$set"]["createdAt"]
            
            result = collection.update_one(query, update_data)
            
            if result.modified_count > 0:
                stats['updated'] += 1
                return {'action': 'updated', 'id': existing_doc['_id']}
            else:
                stats['unchanged'] += 1
                return {'action': 'unchanged', 'id': existing_doc['_id']}
        else:
            # Document doesn't exist - insert new
            result = collection.insert_one(document)
            stats['inserted'] += 1
            return {'action': 'inserted', 'id': result.inserted_id}
            
    except Exception as e:
        print(f"❌ Error processing row {csv_row.get('name', 'Unknown')}: {e}")
        stats['errors'] += 1
        return None

def test_upsert(collection, csv_file_path, num_rows=10):
    """Test upsert with first 10 rows"""
    print(f"\n🧪 Testing upsert with first {num_rows} rows...")
    
    try:
        # Read only the first num_rows
        df = pd.read_csv(csv_file_path, nrows=num_rows)
        print(f"✅ Successfully read {len(df)} rows from CSV")
        
        stats = {'updated': 0, 'inserted': 0, 'unchanged': 0, 'skipped': 0, 'errors': 0}
        results = []
        
        for index, row in df.iterrows():
            result = upsert_document(collection, row, stats)
            if result:
                results.append(result)
                print(f"   Row {index + 1}: {result['action'].upper()} - {row.get('name', 'Unknown')}")
        
        # Show statistics
        print(f"\n📊 Test Results:")
        print(f"   ✅ Updated: {stats['updated']}")
        print(f"   ➕ Inserted: {stats['inserted']}")
        print(f"   ⏸️  Unchanged: {stats['unchanged']}")
        print(f"   ⏭️  Skipped: {stats['skipped']}")
        print(f"   ❌ Errors: {stats['errors']}")
        
        # Show sample document
        if results:
            sample_result = results[0]
            sample_doc = collection.find_one({"_id": sample_result['id']})
            print(f"\n📋 Sample document after upsert:")
            print(f"   Name: {sample_doc.get('name', 'N/A')}")
            print(f"   Model: {sample_doc.get('model', 'N/A')}")
            print(f"   Company: {sample_doc.get('company', 'N/A')}")
            print(f"   Price: ₹{sample_doc.get('price', 0)}")
            print(f"   Vendor: {'✅' if sample_doc.get('vendor') else '❌'}")
            print(f"   Shop: {'✅' if sample_doc.get('shop') else '❌'}")
        
        return stats['errors'] == 0
        
    except Exception as e:
        print(f"❌ Error during test upsert: {e}")
        return False

def full_upsert(collection, csv_file_path):
    """Upsert all data from CSV"""
    print(f"\n🚀 Starting full upsert...")
    
    try:
        # Read the entire CSV
        df = pd.read_csv(csv_file_path)
        total_rows = len(df)
        print(f"📊 Total rows to process: {total_rows}")
        
        # Process in batches for better performance and progress tracking
        batch_size = 50
        overall_stats = {'updated': 0, 'inserted': 0, 'unchanged': 0, 'skipped': 0, 'errors': 0}
        
        for start_idx in range(0, total_rows, batch_size):
            end_idx = min(start_idx + batch_size, total_rows)
            batch_df = df.iloc[start_idx:end_idx]
            
            batch_stats = {'updated': 0, 'inserted': 0, 'unchanged': 0, 'skipped': 0, 'errors': 0}
            
            for index, row in batch_df.iterrows():
                result = upsert_document(collection, row, batch_stats)
            
            # Update overall stats
            for key in overall_stats:
                overall_stats[key] += batch_stats[key]
            
            # Show batch progress
            batch_num = start_idx // batch_size + 1
            total_batches = (total_rows + batch_size - 1) // batch_size
            processed = end_idx
            
            print(f"✅ Batch {batch_num}/{total_batches}: "
                  f"Updated:{batch_stats['updated']} "
                  f"Inserted:{batch_stats['inserted']} "
                  f"Unchanged:{batch_stats['unchanged']} "
                  f"(Progress: {processed}/{total_rows})")
        
        print(f"\n🎉 Full upsert completed!")
        print(f"📈 Final Statistics:")
        print(f"   ✅ Documents Updated: {overall_stats['updated']}")
        print(f"   ➕ Documents Inserted: {overall_stats['inserted']}")
        print(f"   ⏸️  Documents Unchanged: {overall_stats['unchanged']}")
        print(f"   ⏭️  Rows Skipped: {overall_stats['skipped']}")
        print(f"   ❌ Errors: {overall_stats['errors']}")
        print(f"   📊 Total Processed: {overall_stats['updated'] + overall_stats['inserted'] + overall_stats['unchanged']}")
        
        return overall_stats
        
    except Exception as e:
        print(f"❌ Error during full upsert: {e}")
        return None

def main():
    print("🚀 Smart Bike Parts Hub - CSV to MongoDB Upsert Tool")
    print("=" * 60)
    
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
    
    # Check how many have vendor/shop references
    vendor_count = collection.count_documents({"vendor": {"$exists": True}})
    shop_count = collection.count_documents({"shop": {"$exists": True}})
    print(f"👤 Documents with vendor reference: {vendor_count}")
    print(f"🏪 Documents with shop reference: {shop_count}")
    
    # Test upsert first
    test_success = test_upsert(collection, csv_path, 10)
    
    if test_success:
        # Ask user if they want to proceed with full upsert
        print(f"\n❓ Test upsert successful! Do you want to proceed with full upsert?")
        choice = input("   Enter 'yes' to continue with full upsert, 'no' to exit: ").lower().strip()
        
        if choice in ['yes', 'y']:
            # Proceed with full upsert
            final_stats = full_upsert(collection, csv_path)
            
            if final_stats:
                # Show final collection status
                final_count = collection.count_documents({})
                final_vendor_count = collection.count_documents({"vendor": {"$exists": True}})
                final_shop_count = collection.count_documents({"shop": {"$exists": True}})
                
                print(f"\n📊 Final Collection Status:")
                print(f"   📄 Total documents: {final_count}")
                print(f"   👤 With vendor reference: {final_vendor_count}")
                print(f"   🏪 With shop reference: {final_shop_count}")
                print(f"✨ Upsert process completed successfully!")
            
        else:
            print("👋 Upsert cancelled by user.")
    else:
        print("❌ Test upsert failed. Please check the data and try again.")
    
    # Close connection
    client.close()
    print("🔒 Database connection closed.")

if __name__ == "__main__":
    main()