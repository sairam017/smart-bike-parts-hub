"""
Demo Script for Smart Bike Parts Recommendation System
Shows how to use the complete ML pipeline
"""

import sys
from pathlib import Path

# Add src to path
sys.path.append(str(Path(__file__).parent / "src"))

from recommendations.recommendation_model import BikePartsRecommendationModel
import pandas as pd

def demo_recommendation_system():
    """Demonstrate the recommendation system"""
    print("🏍️  Smart Bike Parts Recommendation System Demo")
    print("=" * 60)
    
    # Initialize model
    model = BikePartsRecommendationModel()
    
    # Dataset path
    dataset_path = "data/bike_parts_dataset.csv"
    
    print("1. Training the recommendation model...")
    print("-" * 40)
    
    try:
        # Train the model (or load if already exists)
        training_info = model.train_model(dataset_path)
        
        print(f"✅ Model trained successfully!")
        print(f"   📊 Dataset size: {training_info['dataset_size']} products")
        print(f"   ⏱️  Training time: {training_info['training_time_seconds']:.2f} seconds")
        print(f"   🎯 Quality score: {training_info['quality_score']:.1f}%")
        
    except Exception as e:
        print(f"❌ Training failed: {e}")
        return
    
    print("\n2. Getting product recommendations...")
    print("-" * 40)
    
    # Load processed data to get sample products
    df = pd.read_csv("models/processed_data.csv")
    
    # Try different types of products
    sample_products = [
        ("Engine part", df[df['type'].str.contains('Engine', case=False, na=False)]),
        ("Brake part", df[df['type'].str.contains('Brake', case=False, na=False)]),
        ("Any part", df)
    ]
    
    for category, category_df in sample_products:
        if len(category_df) == 0:
            continue
            
        # Get a sample product
        sample_product = category_df.iloc[0]
        product_id = sample_product['product_id']
        
        print(f"\n🔍 Sample {category}:")
        print(f"   Product: {sample_product['name']}")
        print(f"   Company: {sample_product['company']}")
        print(f"   Type: {sample_product['type']}")
        print(f"   Price: ₹{sample_product['price']}")
        
        # Get recommendations
        recommendations = model.get_recommendations(
            product_id=product_id,
            num_recommendations=3,
            include_complementary=True
        )
        
        print(f"\n   💡 Recommendations:")
        for i, rec in enumerate(recommendations, 1):
            print(f"   {i}. {rec['name']}")
            print(f"      Company: {rec['company']}")
            print(f"      Type: {rec['type']}")
            print(f"      Price: ₹{rec['price']}")
            print(f"      Score: {rec['similarity_score']:.3f}")
            print(f"      Reason: {rec['reason']}")
            print(f"      Rec Type: {rec['recommendation_type']}")
            print()
        
        break  # Just show first category for demo
    
    print("3. Testing search functionality...")
    print("-" * 40)
    
    # Test search
    search_queries = ["brake", "engine", "hero"]
    
    for query in search_queries:
        results = model.search_products(query, limit=3)
        print(f"\n🔎 Search results for '{query}':")
        
        if results:
            for i, product in enumerate(results, 1):
                print(f"   {i}. {product['name']} ({product['company']})")
                print(f"      Type: {product['type']}, Price: ₹{product['price']}")
        else:
            print("   No results found")
    
    print("\n4. Model information...")
    print("-" * 40)
    
    # Get model info
    model_info = model.get_model_info()
    print(f"✅ Model Status: {model_info['status']}")
    print(f"📊 Dataset Size: {model_info['dataset_size']} products")
    print(f"🏗️  Version: {model_info['version']}")
    print(f"📅 Trained: {model_info['metadata'].get('training_date', 'Unknown')}")
    
    print("\n🎉 Demo completed successfully!")
    print("\nThe recommendation system is ready for integration with your API!")
    print("\nNext steps:")
    print("- Integrate with FastAPI service (api_service.py)")
    print("- Connect to Node.js backend")
    print("- Add to frontend components")

if __name__ == "__main__":
    demo_recommendation_system()