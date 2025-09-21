# MachineLearning Module

Purpose: compute optimal (shortest) set of shops a customer should visit to collect all requested bike parts, minimizing travel distance and number of stops.

## Core Ideas
1. Represent each shop with geo-coordinates and inventory (set of part_ids).
2. Customer query = origin location + needed part_ids.
3. Build a graph (complete or road-network) between candidate shops + origin with distances (Haversine for now).
4. Solve a constrained optimization:
   - Cover all required parts
   - Minimize (#shops, total_distance) lexicographically or weighted.
5. Also support partial availability scoring (max parts covered within radius).

## Algorithms
- Greedy Set Cover + distance penalty
- Beam search improvement
- Exact small search (branch & bound) if shops < 15
- Shortest path ordering using TSP heuristic for chosen subset.

## Quick Start
```
python -m pip install -r requirements.txt
uvicorn src.api.service:app --reload --port 8010
```

POST /plan route request body example:
```
{
  "origin": {"lat":17.385, "lon":78.4867},
  "parts": ["P123","P200","P333"],
  "shops": [
    {"id":"S1","name":"Alpha","lat":17.40,"lon":78.49,"parts":["P123","P333"]},
    {"id":"S2","name":"Beta","lat":17.39,"lon":78.50,"parts":["P200"]},
    {"id":"S3","name":"Gamma","lat":17.44,"lon":78.55,"parts":["P123","P200","P333"]}
  ]
}
```

Response includes chosen shops, ordering, distances, uncovered parts if any.

## Next Steps
- Integrate with Node backend endpoint (proxy request to this service)
- Persist historical queries for ML ranking
- Replace Haversine with real road network (OSRM / Mapbox)
- Add caching layer
