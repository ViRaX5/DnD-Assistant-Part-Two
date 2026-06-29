const mongoose = require('mongoose');

async function processCheckout(req, res) {
    const userId = req.user.userId;
    const { campaignId, cart, totalCostCP } = req.body;

    if (!campaignId || !cart || cart.length === 0) {
        return res.status(400).json({ success: false, error: "Invalid cart data." });
    }

    try {
        // Grab the Character model that was already registered in campaignListModule.js
        const Character = mongoose.models.Character;

        if (!Character) {
            return res.status(500).json({ success: false, error: "Character model not initialized." });
        }

        // 1. Fetch the player's specific character document
        const character = await Character.findOne({ userId: userId, campaignId: campaignId });

        if (!character) {
            return res.status(404).json({ success: false, error: "Character not found." });
        }

        // 2. Calculate current player wealth in CP based on your schema names
        const currentGold = character.currency.gold || 0;
        const currentSilver = character.currency.silver || 0;
        const currentCopper = character.currency.copper || 0;
        
        const playerTotalCP = (currentGold * 100) + (currentSilver * 10) + currentCopper;

        // 3. Verify funds
        if (playerTotalCP < totalCostCP) {
            return res.status(400).json({ success: false, error: "Not enough gold!" });
        }

        // 4. Deduct funds and convert back to standard coinage
        const remainingCP = playerTotalCP - totalCostCP;
        
        character.currency.gold = Math.floor(remainingCP / 100);
        character.currency.silver = Math.floor((remainingCP % 100) / 10);
        character.currency.copper = remainingCP % 10;

        // 5. Add items to equipment array (Schema requires Strings)
        cart.forEach(cartItem => {
            if (cartItem.quantity > 1) {
                character.equipment.push(`${cartItem.item.name} (x${cartItem.quantity})`);
            } else {
                character.equipment.push(cartItem.item.name);
            }
        });

        // 6. Save the updated document back to MongoDB
        await character.save();

        return res.json({ success: true, message: "Checkout complete." });

    } catch (err) {
        console.error("Checkout transaction failed:", err);
        return res.status(500).json({ success: false, error: "Database error during checkout." });
    }
}

module.exports = {
    processCheckout
};