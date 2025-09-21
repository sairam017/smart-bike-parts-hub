import json
from src.route_planner import RoutePlanner

planner = RoutePlanner()

origin = (17.385, 78.4867)
parts = ["P1","P2","P3"]
shops = [
    {"id":"S1","name":"Alpha","lat":17.39,"lon":78.49,"parts":["P1","P3"]},
    {"id":"S2","name":"Beta","lat":17.40,"lon":78.50,"parts":["P2"]},
    {"id":"S3","name":"Gamma","lat":17.42,"lon":78.52,"parts":["P1","P2","P3"]},
]

res = planner.plan(origin, parts, shops)
print(json.dumps(res.__dict__, indent=2))
