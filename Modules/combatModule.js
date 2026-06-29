// campaignId -> { combatActive, currentTurnUserId }
const combatStateByCampaign = new Map();

function handleTurnChanged(io, socket, socketContext, payload) {
    const ctx = socketContext.get(socket.id)
    if (!ctx || !ctx.isDM) return

    combatStateByCampaign.set(ctx.campaignId, payload)
    io.to(`campaign:${ctx.campaignId}`).emit('combat:turnChanged', payload)
}

function handleRestRequest(io, socket, socketContext, payload) {
    const ctx = socketContext.get(socket.id)
    if (!ctx) return

    const { restType, playerName } = payload

    const dmEntry = [...socketContext.entries()]
        .find(([, c]) => c.campaignId === ctx.campaignId && c.isDM)

    if (!dmEntry) {
        socket.emit('rest:response', { restType, approved: false, reason: "DM not connected" })
        return
    }

    const [dmSocketId] = dmEntry
    io.to(dmSocketId).emit('rest:approvalRequest', { playerUserId: ctx.userId, playerName, restType })
}

function handleRestRespond(io, socket, socketContext, payload) {
    const ctx = socketContext.get(socket.id)
    if (!ctx || !ctx.isDM) return

    const { playerUserId, restType, approved } = payload

    for (const [sockId, c] of socketContext) {
        if (c.campaignId === ctx.campaignId && c.userId === playerUserId) {
            io.to(sockId).emit('rest:response', { restType, approved })
        }
    }
}

function checkReconnectingCombatState(socket, campaignId) {
    if (combatStateByCampaign.has(campaignId)) {
        socket.emit('combat:turnChanged', combatStateByCampaign.get(campaignId))
    }
}

module.exports = {
    handleTurnChanged,
    handleRestRequest,
    handleRestRespond,
    checkReconnectingCombatState
}
