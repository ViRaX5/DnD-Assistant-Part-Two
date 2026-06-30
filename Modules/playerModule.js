const mongoose = require('mongoose')

// Mirrors the frontend's parseCostToCP (ui-interactions.js) so prices are
// computed from the same "X gp/sp/cp/ep/pp" strings stored in Shop.items.
function parseCostToCP(costString) {
    if (!costString) return 0
    const match = costString.toLowerCase().match(/(\d+(?:\.\d+)?)\s*(cp|sp|ep|gp|pp)/)
    if (!match) return 0

    const amount = parseFloat(match[1])
    const unit = match[2]

    switch (unit) {
        case 'cp': return amount
        case 'sp': return amount * 10
        case 'ep': return amount * 50
        case 'gp': return amount * 100
        case 'pp': return amount * 1000
        default: return 0
    }
}

async function processCheckout(req, res) {
    const userId = req.user.userId
    const { campaignId, cart } = req.body

    if (!campaignId || !cart || cart.length === 0) {
        return res.status(400).json({ success: false, error: "Invalid cart data." })
    }

    try {
        // Grab the Character model that was already registered in campaignListModule.js
        const Character = mongoose.models.Character
        const Shop = mongoose.models.Shop

        if (!Character || !Shop) {
            return res.status(500).json({ success: false, error: "Required model not initialized." })
        }

        const character = await Character.findOne({ userId: userId, campaignId: campaignId })

        if (!character) {
            return res.status(404).json({ success: false, error: "Character not found." })
        }

        // Re-price every cart line against the DB-stored shop inventory
        // instead of trusting any client-supplied cost — never trust a
        // client-computed total.
        const shop = await Shop.findOne({ campaignId: campaignId })
        if (!shop || !shop.isOpen) {
            return res.status(400).json({ success: false, error: "The shop is not open." })
        }

        const purchasedItems = []
        let totalCostCP = 0

        for (const cartItem of cart) {
            const quantity = Math.floor(Number(cartItem?.quantity))
            const shopItem = shop.items.find(i => i.id === cartItem?.item?.id)

            if (!shopItem || !Number.isInteger(quantity) || quantity <= 0) {
                return res.status(400).json({ success: false, error: "Invalid item in cart." })
            }

            totalCostCP += parseCostToCP(shopItem.cost) * quantity
            purchasedItems.push({ name: shopItem.name, quantity })
        }

        const currentGold = character.currency.gold || 0
        const currentSilver = character.currency.silver || 0
        const currentCopper = character.currency.copper || 0
        
        const playerTotalCP = (currentGold * 100) + (currentSilver * 10) + currentCopper

        if (playerTotalCP < totalCostCP) {
            return res.status(400).json({ success: false, error: "Not enough gold!" })
        }

        const remainingCP = playerTotalCP - totalCostCP
        
        character.currency.gold = Math.floor(remainingCP / 100)
        character.currency.silver = Math.floor((remainingCP % 100) / 10)
        character.currency.copper = remainingCP % 10

        // Schema requires Strings, so multi-quantity purchases get folded into one formatted entry
        purchasedItems.forEach(purchased => {
            if (purchased.quantity > 1) {
                character.equipment.push(`${purchased.name} (x${purchased.quantity})`)
            } else {
                character.equipment.push(purchased.name)
            }
        })

        await character.save()

        return res.json({ success: true, message: "Checkout complete." })

    } catch (err) {
        console.error("Checkout transaction failed:", err)
        return res.status(500).json({ success: false, error: "Database error during checkout." })
    }
}

module.exports = {
    processCheckout
}