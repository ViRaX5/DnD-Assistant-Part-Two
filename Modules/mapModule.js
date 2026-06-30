const mongoose = require('mongoose')

const mapStateSchema = new mongoose.Schema({
    campaignId: { type: Number, required: true, unique: true },
    backgroundUrl: { type: String, default: null },
    tokens: [{
        id: String,
        gridX: Number,
        gridY: Number,
        color: String,
        radius: Number,
        imageUrl: String
    }]
})

const MapState = mongoose.model('MapState', mapStateSchema)

async function getMapState(req, res) {
    const campaignId = Number(req.query.campaignId)

    if (!campaignId) {
        return res.status(400).json({ success: false, error: "campaignId is required" })
    }

    try {
        const mapState = await MapState.findOne({ campaignId })

        return res.json({
            success: true,
            backgroundUrl: mapState ? mapState.backgroundUrl : null,
            tokens: mapState ? mapState.tokens : []
        })
    }
    catch (err) {
        console.error("Database error during map state fetch: ", err)
        return res.status(500).json({ success: false, error: "An internal server error occurred." })
    }
}

async function persistTokenSpawn(campaignId, token) {
    try {
        await MapState.findOneAndUpdate(
            { campaignId },
            { $push: { tokens: token } },
            { upsert: true }
        )
    }
    catch (err) {
        console.error("Database error during token spawn persist: ", err)
    }
}

async function persistBackground(campaignId, imageUrl) {
    try {
        await MapState.findOneAndUpdate(
            { campaignId },
            { backgroundUrl: imageUrl },
            { upsert: true }
        )
    }
    catch (err) {
        console.error("Database error during background persist: ", err)
    }
}

async function persistTokenMove(campaignId, tokenId, newX, newY) {
    try {
        const updated = await MapState.findOneAndUpdate(
            { campaignId, "tokens.id": tokenId },
            { $set: { "tokens.$.gridX": newX, "tokens.$.gridY": newY } }
        )

        if (!updated) {
            // Guard the fallback push against a concurrent move on the same
            // token also racing here — only push if no token with this id
            // exists yet, so at most one of two racing pushes can match.
            await MapState.findOneAndUpdate(
                { campaignId, "tokens.id": { $ne: tokenId } },
                { $push: { tokens: { id: tokenId, gridX: newX, gridY: newY } } },
                { upsert: true }
            )
        }
    }
    catch (err) {
        console.error("Database error during token move persist: ", err)
    }
}

async function clearMapState(campaignId) {
    try {
        await MapState.findOneAndUpdate(
            { campaignId },
            { backgroundUrl: null, tokens: [] },
            { upsert: true }
        )
    }
    catch (err) {
        console.error("Database error during map state clear: ", err)
    }
}

module.exports = { MapState, getMapState, persistBackground, persistTokenMove, persistTokenSpawn, clearMapState }
