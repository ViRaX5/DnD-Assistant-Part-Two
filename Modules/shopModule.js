const mongoose = require('mongoose');

const shopSchema = new mongoose.Schema({
    campaignId: { type: Number, required: true, unique: true },
    isOpen: { type: Boolean, default: false }
})

const Shop = mongoose.model('Shop', shopSchema)

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

module.exports = { Shop, handleShopToggle, getShopStatus }
