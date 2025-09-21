# Integration Notes (Node <-> Python)

Option A: Run FastAPI separately on port 8010. From Node server, create an endpoint that forwards client route-planning requests.

Example Node proxy endpoint (add to Express):
```js
const axios = require('axios');
router.post('/route-plan', async (req,res) => {
  try {
    const resp = await axios.post(process.env.ML_ROUTE_URL || 'http://localhost:8010/plan', req.body, { timeout: 4000 });
    res.json(resp.data);
  } catch(e){
    res.status(500).json({ message: 'Route planning failed', detail: e.message });
  }
});
```

Request body:
```
{
  origin: { lat: <number>, lon: <number> },
  parts: ["partId1", ...],
  shops: [{ id, name, lat, lon, parts: [partIds...] }]
}
```

Populate shops + parts via Mongo queries (aggregate by shop collecting part ids). See helper snippet soon.
