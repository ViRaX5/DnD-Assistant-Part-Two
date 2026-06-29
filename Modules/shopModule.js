const mongoose = require('mongoose');

const shopSchema = new mongoose.Schema({
    campaignId: { type: Number, required: true, unique: true },
    isOpen: { type: Boolean, default: false },
    items: { type: Array, default: [] } // <-- New field for the inventory
}, { timestamps: true });

const Shop = mongoose.models.Shop || mongoose.model('Shop', shopSchema);

async function handleShopToggle(io, socket, socketContext, payload) {
    const ctx = socketContext.get(socket.id)
    if (!ctx || !ctx.isDM) return

    const { isOpen } = payload

    try {
        await Shop.findOneAndUpdate(
            { campaignId: ctx.campaignId },
            { isOpen: isOpen },
            { upsert: true }
        )

        io.to(`campaign:${ctx.campaignId}`).emit('shop:status', { isOpen: isOpen })
    }
    catch (err) {
        console.error("Database error during shop toggle: ", err)
    }
}

async function getShopStatus(req, res) {
    const campaignId = Number(req.query.campaignId)

    if (!campaignId) {
        return res.status(400).json({ success: false, error: "campaignId is required" })
    }

    try {
        const shop = await Shop.findOne({ campaignId })

        return res.json({ success: true, isOpen: shop ? shop.isOpen : false })
    }
    catch (err) {
        console.error("Database error during shop status fetch: ", err)
        return res.status(500).json({ success: false, error: "An internal server error occurred." })
    }
}

async function getShopInventory(req, res) {
    // Ensuring it's cast to a Number to match your schema!
    const campaignId = Number(req.query.campaignID); 

    if (!campaignId) {
        return res.status(400).json({ success: false, error: "Campaign ID is required." });
    }

    try {
        const shop = await Shop.findOne({ campaignId: campaignId });
        return res.json({ success: true, shop: shop || { items: [] } });
    } catch (err) {
        console.error("MongoDB GET Shop Error:", err);
        return res.status(500).json({ success: false, error: "Database error fetching shop." });
    }
}

async function updateShopInventory(req, res) {
    const { campaignID, items } = req.body;

    if (!campaignID || !Array.isArray(items)) {
        return res.status(400).json({ success: false, error: "Invalid data provided." });
    }

    try {
        // Upsert: Find by campaignId. If it exists, update it. If not, create it.
        await Shop.findOneAndUpdate(
            { campaignId: Number(campaignID) },
            { items: items },
            { upsert: true, new: true }
        );

        return res.json({ success: true, message: "Shop updated successfully!" });
    } catch (err) {
        console.error("MongoDB POST Shop Error:", err);
        return res.status(500).json({ success: false, error: "Database error saving shop." });
    }
}

module.exports = { 
    Shop, 
    handleShopToggle, 
    getShopStatus, 
    getShopInventory, 
    updateShopInventory 
}
