const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
    campaignId: { type: Number, required: true },
    senderId: { type: Number, required: true },
    senderName: { type: String, required: true },
    type: { type: String, required: true },
    text: { type: String, required: true },
    targetId: { type: Number, default: null },
    targetName: { type: String, default: null },
    meta: { type: mongoose.Schema.Types.Mixed, default: {} },
    createdAt: { type: Date, default: Date.now }
})

const Message = mongoose.model('Message', messageSchema)

async function handleMessageSend(io, socket, socketContext, payload) {
    const ctx = socketContext.get(socket.id)
    if (!ctx) return

    const { type, text, targetId = null, targetName = null, meta = {}, senderName } = payload

    try {
        const message = new Message({
            campaignId: ctx.campaignId,
            senderId: ctx.userId,
            senderName: senderName,
            type: type,
            text: text,
            targetId: targetId,
            targetName: targetName,
            meta: meta
        })

        await message.save()

        const wireMessage = {
            _id: message._id,
            campaignId: message.campaignId,
            senderId: message.senderId,
            senderName: message.senderName,
            type: message.type,
            text: message.text,
            targetId: message.targetId,
            targetName: message.targetName,
            meta: message.meta,
            createdAt: message.createdAt
        }

        if (targetId) {
            // Whisper: deliver to sender, target, and any DM in the campaign (DM oversight).
            for (const [sockId, c] of socketContext) {
                if (c.campaignId === ctx.campaignId && (c.userId === targetId || c.userId === ctx.userId || c.isDM)) {
                    io.to(sockId).emit('chat:newMessage', wireMessage)
                }
            }
        }
        else {
            io.to(`campaign:${ctx.campaignId}`).emit('chat:newMessage', wireMessage)
        }
    }
    catch (err) {
        console.error("Database error during message send: ", err)
    }
}

async function getChatHistory(req, res) {
    const campaignId = Number(req.query.campaignId)
    const userId = req.user.userId
    const isDM = req.query.isDM === 'true'

    if (!campaignId || !userId) {
        return res.status(400).json({ success: false, error: "campaignId and userId are required" })
    }

    try {
        // The DM can see every message in the campaign, including whispers between
        // other players. Everyone else only sees broadcasts plus whispers they sent or received.
        const query = isDM
            ? { campaignId: campaignId }
            : {
                campaignId: campaignId,
                $or: [
                    { targetId: null },
                    { senderId: userId },
                    { targetId: userId }
                ]
            }

        const messages = await Message.find(query).sort({ createdAt: -1 }).limit(50)

        messages.reverse()

        return res.json({ success: true, messages: messages })
    }
    catch (err) {
        console.error("Database error during chat history fetch: ", err)
        return res.status(500).json({ success: false, error: "An internal server error occurred." })
    }
}

module.exports = { Message, handleMessageSend, getChatHistory }
