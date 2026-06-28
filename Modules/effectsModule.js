const mongoose = require('mongoose');

const effectSchema = new mongoose.Schema({
    campaignId: { type: Number, required: true },
    name: { type: String, required: true },
    duration: { type: String, required: true },
    createdAt: { type: Date, default: Date.now }
})

const Effect = mongoose.model('Effect', effectSchema)

async function handleEffectAdd(io, socket, socketContext, payload) {
    const ctx = socketContext.get(socket.id)
    if (!ctx) return

    const { name, duration } = payload

    try {
        const effect = new Effect({
            campaignId: ctx.campaignId,
            name: name,
            duration: duration
        })

        await effect.save()

        const wireEffect = {
            _id: effect._id,
            campaignId: effect.campaignId,
            name: effect.name,
            duration: effect.duration
        }

        io.to(`campaign:${ctx.campaignId}`).emit('effects:new', wireEffect)
    }
    catch (err) {
        console.error("Database error during effect add: ", err)
    }
}

async function getActiveEffects(req, res) {
    const campaignId = Number(req.query.campaignId)

    if (!campaignId) {
        return res.status(400).json({ success: false, error: "campaignId is required" })
    }

    try {
        const effects = await Effect.find({ campaignId })

        return res.json({ success: true, effects: effects })
    }
    catch (err) {
        console.error("Database error during effects fetch: ", err)
        return res.status(500).json({ success: false, error: "An internal server error occurred." })
    }
}

module.exports = { Effect, handleEffectAdd, getActiveEffects }
