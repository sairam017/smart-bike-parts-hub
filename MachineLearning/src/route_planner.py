from __future__ import annotations
from dataclasses import dataclass
from typing import List, Dict, Set, Tuple, Optional
from .geo_utils import haversine
import heapq

@dataclass
class Shop:
    id: str
    name: str
    lat: float
    lon: float
    parts: Set[str]

@dataclass
class PlanResult:
    chosen_shops: List[str]
    order: List[str]
    total_distance_km: float
    uncovered_parts: List[str]
    coverage_ratio: float
    related_suggestions: List[str]

class RoutePlanner:
    def __init__(self, weight_distance: float = 1.0, weight_shops: float = 5.0):
        self.weight_distance = weight_distance
        self.weight_shops = weight_shops

    def plan(self, origin: Tuple[float,float], required_parts: List[str], shops_data: List[Dict]) -> PlanResult:
        shops = [Shop(id=s['id'], name=s.get('name', s['id']), lat=s['lat'], lon=s['lon'], parts=set(s.get('parts', []))) for s in shops_data]
        need = set(required_parts)
        if not need:
            return PlanResult([], [], 0.0, [], 1.0, [])
        # Pre-filter shops that have at least one needed part
        candidate = [s for s in shops if s.parts & need]
        if not candidate:
            return PlanResult([], [], 0.0, sorted(need), 0.0, [])
        # If any single shop covers all
        for s in candidate:
            if need <= s.parts:
                dist = self._path_distance(origin, [s])
                related = self._related_suggestions(need, [s])
                return PlanResult([s.id], [s.id], dist, [], 1.0, related)
        # Greedy set cover with distance penalty
        chosen: List[Shop] = []
        remaining = set(need)
        while remaining:
            best = None
            best_score = float('inf')
            for s in candidate:
                new_parts = remaining & s.parts
                if not new_parts:
                    continue
                dist = self._incremental_distance(origin, chosen, s)
                # Score: weighted shops count (predictive) + distance per newly covered part
                score = self.weight_shops + self.weight_distance * dist / max(len(new_parts),1)
                if score < best_score:
                    best_score = score
                    best = s
            if best is None:
                break
            chosen.append(best)
            remaining -= best.parts
            if len(chosen) > 10:  # safety guard
                break
        uncovered = sorted(remaining)
        # Optimize visiting order (simple nearest neighbor)
        order = self._order(origin, chosen)
        total_dist = self._path_distance(origin, [next(s for s in chosen if s.id==oid) for oid in order])
        covered_parts = set().union(*[s.parts for s in chosen]) & need
        coverage_ratio = len(covered_parts)/len(need)
        related = self._related_suggestions(need, chosen)
        return PlanResult([s.id for s in chosen], order, total_dist, uncovered, coverage_ratio, related)

    def _related_suggestions(self, requested: Set[str], chosen: List[Shop]) -> List[str]:
        # Heuristic: other parts present in chosen shops excluding requested
        pool: Dict[str,int] = {}
        for s in chosen:
            for p in s.parts:
                if p in requested: continue
                pool[p] = pool.get(p,0)+1
        # rank by frequency then lexicographically
        ranked = sorted(pool.items(), key=lambda kv: (-kv[1], kv[0]))
        return [p for p,_ in ranked][:15]

    def _order(self, origin: Tuple[float,float], shops: List[Shop]) -> List[str]:
        remaining = shops[:]
        cur = origin
        order = []
        while remaining:
            best = min(remaining, key=lambda s: haversine((s.lat,s.lon), cur))
            order.append(best.id)
            cur = (best.lat, best.lon)
            remaining.remove(best)
        return order

    def _path_distance(self, origin: Tuple[float,float], shops: List[Shop]) -> float:
        if not shops:
            return 0.0
        dist = haversine(origin, (shops[0].lat, shops[0].lon))
        for a, b in zip(shops, shops[1:]):
            dist += haversine((a.lat,a.lon), (b.lat,b.lon))
        return dist

    def _incremental_distance(self, origin, chosen: List[Shop], candidate: Shop) -> float:
        # naive: distance from last chosen (or origin) to candidate
        last = origin if not chosen else (chosen[-1].lat, chosen[-1].lon)
        return haversine(last, (candidate.lat, candidate.lon))
