const mongoose = require('mongoose');

// campaignId -> { dmSocketId, roster: Map<userId, {name, hasRolled, result}> }
const initiativeSessions = new Map();

async function handleInitiativeStart(io, socket, socketContext, pool) {
    const ctx = socketContext.get(socket.id)
    if (!ctx || !ctx.isDM) return

    const connectedUserIds = [...new Set(
        [...socketContext.values()]
            .filter(c => c.campaignId === ctx.campaignId && !c.isDM)
            .map(c => c.userId)
    )]

    if (connectedUserIds.length === 0) {
        const session = { dmSocketId: socket.id, roster: new Map() }
        initiativeSessions.set(ctx.campaignId, session)
        socket.emit('initiative:panelUpdate', [])
        return
    }

    try {
        const [rows] = await pool.promise().query(
            `SELECT cp.user_id, u.first_name, u.last_name FROM capmaign_participants AS cp
             INNER JOIN users_info AS u ON u.id = cp.user_id
             WHERE cp.campaign_id = ? AND cp.user_id IN (?)`,
            [ctx.campaignId, connectedUserIds]
        )

        const roster = new Map()
        rows.forEach(row => {
            roster.set(row.user_id, {
                name: `${row.first_name} ${row.last_name}`,
                hasRolled: false,
                result: null
            })
        })

        initiativeSessions.set(ctx.campaignId, { dmSocketId: socket.id, roster })

        socket.emit('initiative:panelUpdate', rosterToArray(roster))
        io.to(`campaign:${ctx.campaignId}`).emit('initiative:rollPrompt')
    }
    catch (err) {
        console.error("Database error during initiative start: ", err)
    }
}

async function handleInitiativeSubmitRoll(io, socket, socketContext, payload) {
    const ctx = socketContext.get(socket.id)
    if (!ctx) return

    const session = initiativeSessions.get(ctx.campaignId)
    if (!session || !session.roster.has(ctx.userId)) return

    const { d20Result } = payload

    try {
        const Character = mongoose.model('Character')
        const character = await Character.findOne({ campaignId: ctx.campaignId, userId: ctx.userId })
        const bonus = character?.combat?.initiative || 0

        const entry = session.roster.get(ctx.userId)
        entry.hasRolled = true
        entry.result = d20Result + bonus

        io.to(session.dmSocketId).emit('initiative:panelUpdate', rosterToArray(session.roster))
    }
    catch (err) {
        console.error("Database error during initiative roll: ", err)
    }
}

function handleInitiativeEnd(io, socket, socketContext) {
    const ctx = socketContext.get(socket.id)
    if (!ctx || !ctx.isDM) return

    initiativeSessions.delete(ctx.campaignId)
    io.to(`campaign:${ctx.campaignId}`).emit('initiative:rollPromptClear')
}

function checkReconnectingRoller(socket, campaignId, userId) {
    const session = initiativeSessions.get(campaignId)
    if (!session) return

    const entry = session.roster.get(userId)
    if (entry && !entry.hasRolled) {
        socket.emit('initiative:rollPrompt')
    }
}

function rosterToArray(roster) {
    return [...roster.entries()].map(([userId, entry]) => ({ userId, ...entry }))
}

module.exports = {
    handleInitiativeStart,
    handleInitiativeSubmitRoll,
    handleInitiativeEnd,
    checkReconnectingRoller
}
