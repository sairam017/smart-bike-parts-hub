# Content-Based Recommendation System Plan
## Smart Bike Parts Hub

**Created:** September 21, 2025  
**Status:** Planning Phase  
**Type:** Content-Based ML Recommendations  

---

## Data Analysis

Based on the BikePart schema, here are the key features for content-based recommendations:

### **Available Features:**
1. **Textual Features:**
   - `name` - Product name
   - `model` - Bike model 
   - `company` - Manufacturer (Hero, Bajaj, etc.)
   - `brand` - Part brand
   - `type` - Part category (Engine, Brake, etc.)
   - `description` - Product description
   - `compatibility` - Array of compatible models

2. **Numerical Features:**
   - `price` - Product price
   - `vehicleYear` - Year of vehicle
   - `rating` - Average rating
   - `numReviews` - Review count

3. **Categorical Features:**
   - `company`, `brand`, `type` can be encoded

---

## Phase 1: Feature Engineering Strategy

### **1.1 Text Processing Pipeline:**
```python
# Combine textual features into rich feature vectors
combined_text = f"{name} {model} {company} {brand} {type} {description}"
compatibility_text = " ".join(compatibility)

# Apply TF-IDF vectorization for semantic similarity
# Use n-grams (1,2) to capture phrases like "brake disc", "fuel tank"
```

### **1.2 Numerical Feature Engineering:**
```python
# Price buckets (budget, mid-range, premium)
price_category = categorize_price(price)

# Year ranges (vintage, classic, modern)
year_category = categorize_year(vehicleYear)

# Rating tiers (poor, good, excellent)
rating_tier = categorize_rating(rating)
```

### **1.3 Multi-Modal Feature Fusion:**
```python
# Combine different feature types with appropriate weights
final_features = concatenate([
    tfidf_features * 0.4,           # Text similarity (40%)
    categorical_features * 0.3,      # Category matching (30%)
    numerical_features * 0.2,        # Price/rating similarity (20%)
    compatibility_features * 0.1     # Compatibility bonus (10%)
])
```

---

## Phase 2: ML Model Architecture

### **2.1 Similarity Calculation Methods:**
1. **TF-IDF + Cosine Similarity** (Primary)
   - For textual content similarity
   - Fast computation, interpretable results

2. **Feature-based Euclidean Distance** (Secondary)
   - For numerical features (price, year, rating)
   - Normalized to 0-1 scale

3. **Jaccard Similarity** (Tertiary)
   - For compatibility arrays
   - Measures overlap in compatible models

### **2.2 Recommendation Algorithm:**
```python
def get_recommendations(product_id, num_recommendations=5):
    # 1. Extract features for target product
    # 2. Calculate similarity with all other products
    # 3. Apply business rules (same company boost, price range filtering)
    # 4. Rank and return top N similar products
```

---

## Phase 3: Implementation Architecture

### **3.1 File Structure:**
```
MachineLearning/
├── src/
│   ├── recommendations/
│   │   ├── __init__.py
│   │   ├── feature_extractor.py
│   │   ├── similarity_engine.py
│   │   ├── recommendation_model.py
│   │   └── data_preprocessor.py
│   └── api/
│       └── recommendation_service.py (FastAPI endpoint)
```

### **3.2 Data Pipeline:**
```python
# 1. Data Collection: Fetch from MongoDB
# 2. Preprocessing: Clean and normalize
# 3. Feature Extraction: TF-IDF + numerical features
# 4. Similarity Matrix: Precompute for fast lookup
# 5. Real-time Recommendations: Query similarity matrix
```

---

## Phase 4: API Integration

### **4.1 FastAPI Endpoint:**
```python
@app.post('/recommendations')
async def get_product_recommendations(request: RecommendationRequest):
    # Input: product_id, user_context (optional)
    # Output: list of recommended products with similarity scores
```

### **4.2 Node.js Integration:**
```javascript
// Add new route in server
app.use('/api/recommendations', require('./routes/recommendationRoutes'));

// Proxy to Python ML service
router.post('/similar/:productId', async (req, res) => {
    // Forward request to FastAPI service
    // Return recommendations to frontend
});
```

---

## Phase 5: Frontend Integration

### **5.1 Recommendation Components:**
- "Similar Products" section on product detail page
- "You might also like" on cart page
- "Related items" in search results

### **5.2 Display Strategy:**
- Show 4-6 recommendations
- Include similarity percentage
- Add "Why recommended?" explanations

---

## Specific Features for Bike Parts Domain

### **Smart Business Rules:**
1. **Category Affinity:** Engine parts → related engine components
2. **Brand Loyalty:** Same brand parts get similarity boost
3. **Price Range:** Similar price range products (±20%)
4. **Compatibility:** Parts for same bike models
5. **Upgrade Path:** OEM → Performance parts suggestions

### **Cold Start Handling:**
- New products: Use category and brand similarity
- Popular items fallback
- Trending in same category

---

## Expected Performance

### **Accuracy Metrics:**
- **Precision@5:** 70-80% (5 out of 5 recommendations relevant)
- **Diversity:** 60-70% (recommendations from different categories)
- **Coverage:** 90%+ (recommendations available for most products)

### **Performance:**
- **Response Time:** <200ms for real-time recommendations
- **Batch Processing:** Update similarity matrix daily/weekly
- **Memory Usage:** ~100MB for 10K products

---

## Implementation Timeline

1. **Week 1:** Data preprocessing + Feature engineering
2. **Week 2:** ML model development + testing
3. **Week 3:** API integration + backend routes
4. **Week 4:** Frontend components + testing

---

## Questions for Confirmation

1. **Recommendation Types:** Do you want to focus on "similar products" or also include "complementary products" (parts that go together)?

2. **Performance Priority:** Should we optimize for speed (precomputed) or freshness (real-time calculation)?

3. **Business Rules:** Any specific business logic? (e.g., promote certain brands, avoid out-of-stock items)

4. **User Context:** Should recommendations consider user's previous purchases/views, or purely product-based for now?

5. **Explanation:** Do you want to show users why items were recommended? ("Similar brand", "Same category", etc.)

---

## Change Log

| Date | Change | Reason |
|------|--------|--------|
| 2025-09-21 | Initial plan created | Planning phase for content-based recommendations |

---

## Next Steps

- [ ] Get confirmation on plan details
- [ ] Set up development environment
- [ ] Implement Phase 1: Feature Engineering
- [ ] Build and test ML model
- [ ] Create API endpoints
- [ ] Integrate with frontend

---

**Note:** This document will be updated as the plan evolves and implementation progresses.