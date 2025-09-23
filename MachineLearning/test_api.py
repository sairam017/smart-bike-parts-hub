"""
Test the FastAPI recommendation endpoints
"""

import requests
import json
import time

# Configuration
BASE_URL = "http://localhost:8010"

def test_api_endpoints():
    """Test all the ML API endpoints"""
    print("🧪 Testing Smart Bike Parts ML API Endpoints")
    print("=" * 60)
    
    # Test 1: Health check
    print("1. Testing health check...")
    try:
        response = requests.get(f"{BASE_URL}/health")
        if response.status_code == 200:
            print("   ✅ Basic health check passed")
        else:
            print(f"   ❌ Health check failed: {response.status_code}")
    except requests.exceptions.ConnectionError:
        print("   ❌ API server not running. Please start with: python main.py")
        return
    
    # Test 2: Detailed health check
    print("2. Testing detailed health check...")
    try:
        response = requests.get(f"{BASE_URL}/health/detailed")
        if response.status_code == 200:
            health_data = response.json()
            print("   ✅ Detailed health check passed")
            print(f"      Model Status: {health_data.get('model_status', 'unknown')}")
            print(f"      CSV Records: {health_data.get('csv_records_count', 0)}")
        else:
            print(f"   ❌ Detailed health check failed: {response.status_code}")
    except Exception as e:
        print(f"   ❌ Error: {e}")
    
    # Test 3: Model status
    print("3. Testing model status...")
    try:
        response = requests.get(f"{BASE_URL}/model/status")
        if response.status_code == 200:
            model_data = response.json()
            print("   ✅ Model status check passed")
            print(f"      Status: {model_data.get('status', 'unknown')}")
            print(f"      Version: {model_data.get('model_version', 'unknown')}")
            print(f"      Products: {model_data.get('products_count', 0)}")
        else:
            print(f"   ❌ Model status failed: {response.status_code}")
            return
    except Exception as e:
        print(f"   ❌ Error: {e}")
        return
    
    # Check if model is trained
    if model_data.get('status') != 'trained':
        print("4. Model not trained, triggering training...")
        try:
            training_request = {
                "force_retrain": False,
                "include_validation": True
            }
            response = requests.post(f"{BASE_URL}/model/train", json=training_request)
            if response.status_code == 200:
                training_data = response.json()
                print("   ✅ Model training completed")
                print(f"      Products: {training_data.get('products_count', 0)}")
                print(f"      Training time: {training_data.get('training_time_ms', 0):.0f}ms")
            else:
                print(f"   ❌ Model training failed: {response.status_code}")
                return
        except Exception as e:
            print(f"   ❌ Training error: {e}")
            return
    else:
        print("4. Model already trained, skipping training step")
    
    # Test 4: Product search
    print("5. Testing product search...")
    try:
        response = requests.get(f"{BASE_URL}/recommendations/search?q=brake&limit=3")
        if response.status_code == 200:
            search_data = response.json()
            print("   ✅ Product search passed")
            print(f"      Query: '{search_data.get('query', '')}'")
            print(f"      Results found: {search_data.get('total_found', 0)}")
            
            results = search_data.get('results', [])
            if results:
                print("      Sample result:")
                result = results[0]
                print(f"         - {result.get('name', 'Unknown')} ({result.get('company', 'Unknown')})")
                print(f"         - Type: {result.get('type', 'Unknown')}")
                print(f"         - Price: ₹{result.get('price', 0)}")
        else:
            print(f"   ❌ Product search failed: {response.status_code}")
    except Exception as e:
        print(f"   ❌ Search error: {e}")
    
    # Test 5: Recommendations
    print("6. Testing product recommendations...")
    try:
        # Get a product ID from search results
        search_response = requests.get(f"{BASE_URL}/recommendations/search?q=engine&limit=1")
        if search_response.status_code == 200:
            search_results = search_response.json().get('results', [])
            if search_results:
                test_product_id = search_results[0].get('product_id')
                test_product_name = search_results[0].get('name')
                
                # Test recommendations
                rec_request = {
                    "product_id": test_product_id,
                    "num_recommendations": 3,
                    "include_out_of_stock": True,
                    "price_range_factor": 0.2,
                    "same_shop_boost": 0.1
                }
                
                response = requests.post(f"{BASE_URL}/recommendations/similar", json=rec_request)
                if response.status_code == 200:
                    rec_data = response.json()
                    print("   ✅ Product recommendations passed")
                    print(f"      Target product: {test_product_name}")
                    print(f"      Recommendations found: {rec_data.get('total_found', 0)}")
                    print(f"      Processing time: {rec_data.get('processing_time_ms', 0):.1f}ms")
                    
                    recommendations = rec_data.get('recommendations', [])
                    if recommendations:
                        print("      Top recommendation:")
                        rec = recommendations[0]
                        print(f"         - {rec.get('name', 'Unknown')}")
                        print(f"         - Similarity: {rec.get('similarity_score', 0):.3f}")
                        print(f"         - Type: {rec.get('recommendation_type', 'unknown')}")
                        print(f"         - Reason: {rec.get('reason', 'N/A')}")
                else:
                    print(f"   ❌ Recommendations failed: {response.status_code}")
                    error_detail = response.json().get('detail', 'Unknown error')
                    print(f"      Error: {error_detail}")
            else:
                print("   ⚠️  No products found for recommendation test")
        else:
            print("   ❌ Could not get product for recommendation test")
    except Exception as e:
        print(f"   ❌ Recommendation error: {e}")
    
    print("\n🎉 API testing completed!")
    print("\nAPI Endpoints Ready:")
    print(f"- Health: {BASE_URL}/health")
    print(f"- Model Status: {BASE_URL}/model/status")
    print(f"- Train Model: {BASE_URL}/model/train")
    print(f"- Search: {BASE_URL}/recommendations/search?q=brake")
    print(f"- Recommendations: {BASE_URL}/recommendations/similar")

if __name__ == "__main__":
    test_api_endpoints()