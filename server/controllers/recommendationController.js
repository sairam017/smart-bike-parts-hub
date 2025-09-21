const haversine = require('haversine-distance');
const BikePart = require('../models/BikePart');
const Shop = require('../models/Shop');

// Helper: get related items by category/type
async function findRelatedItems(partIds) {
    // Fetch selected parts
    const selectedParts = await BikePart.find({ _id: { $in: partIds } });
    const categories = selectedParts.map(p => p.type);
    // Find other parts in same categories, not already selected
    const related = await BikePart.find({ type: { $in: categories }, _id: { $nin: partIds } });
    return related;
}

exports.getRecommendations = async (req, res) => {
    try {
        const { partIds, location } = req.body;
        if (!Array.isArray(partIds) || !location) return res.status(400).json({ items: [] });
        // 1. Find related items
        let relatedItems = await findRelatedItems(partIds);
        // 2. Filter by rating
        relatedItems = relatedItems.filter(item => (item.rating || 0) >= 4);
        // 3. Calculate distance
        for (const item of relatedItems) {
            const shop = await Shop.findById(item.shop);
            if (shop && shop.location && shop.location.coordinates) {
                const [lng, lat] = shop.location.coordinates;
                item.distance = haversine(
                    { lat: location.latitude, lon: location.longitude },
                    { lat, lon: lng }
                ) / 1000; // km
                item.shopName = shop.name;
            } else {
                item.distance = null;
            }
        }
        // 4. Sort by distance (nearest first)
        relatedItems = relatedItems.filter(item => item.distance !== null);
        relatedItems.sort((a, b) => a.distance - b.distance);
        // 5. Return top 10
        res.json({ items: relatedItems.slice(0, 10) });
    } catch (err) {
        res.status(500).json({ items: [] });
    }
};
