const mongoose = require('mongoose')

const characterSchema = new mongoose.Schema({
    userId: { type: Number, required: true },
    campaignId: { type: Number, required: true },
    characterName: { type: String, required: true },
    className: String,
    race: String,
    classDisplayName: String,
    raceDisplayName: String,
    level: { type: Number, default: 1 },
    xp: { type: Number, default: 0 },
    stats: {
        str: Number, dex: Number, con: Number,
        int: Number, wis: Number, cha: Number
    },
    modifiers: {
        str: Number, dex: Number, con: Number,
        int: Number, wis: Number, cha: Number
    },
    proficiencyBonus: { type: Number, default: 2 },
    combat: {
        armorClass: Number,
        initiative: Number,
        speed: Number
    },
    health: {
        current: Number,
        max: Number,
        temp: { type: Number, default: 0 }
    },
    savingThrows: [{
        id: String, name: String, modifier: Number, proficient: Boolean
    }],
    currency: {
        gold: { type: Number, default: 0 },
        silver: { type: Number, default: 0 },
        copper: { type: Number, default: 0 }
    },
    equipment: [String],

    skills: [{
        id: String, name: String, attribute: String, modifier: Number, proficient: Boolean
    }],
    languages: [String],
    tools: [String],

    createdAt: { type: Date, default: Date.now }
})

const Character = mongoose.model('Character', characterSchema)

async function getCampaignsListByID(req, res, connection) {
    const userID = req.user.userId

    if (!userID) {
        return res.status(400).json({ success: false, error: "User ID is required" })
    }

    try {
        const [results] = await connection.promise().query(
            `SELECT 
            c.id AS campaign_id,
            c.name AS campaign_name,
            cp.users_role,
            cp.charachers_name AS character_name,
            (SELECT COUNT(*) FROM capmaign_participants AS p2 WHERE p2.campaign_id = c.id AND p2.users_role != 'DM') AS amount_of_players
            FROM campaigns c
            INNER JOIN capmaign_participants AS cp ON c.id = cp.campaign_id
            WHERE cp.user_id = ?`, [userID]
        )

        return res.json({ success: true, campaigns: results })
    }
    catch (err) {
        console.error("Database error during campaigns fetch: ", err)

        const clientMessage = process.env.NODE_ENV === 'development'
            ? err.message
            : "An internal server error occurred."

        return res.status(500).json({ success: false, error: clientMessage })
    }
}

async function getCampaignsListByCode(req, res, connection) {
    const joinCode = req.query.code

    if (!joinCode) {
        return res.status(400).json({ success: false, error: "Join code is required" })
    }

    try {
        const [result] = await connection.promise().query(
            `SELECT cp.campaign_id, cp.user_id FROM campaigns AS c
            INNER JOIN
                capmaign_participants AS cp ON cp.campaign_id = c.id
            WHERE c.join_code = ?`, [joinCode]
        )
        return res.json({ success: true, campaign: result })
    }
    catch (err) {
        console.error("Database error during campaign fetch: ", err)

        const clientMessage = process.env.NODE_ENV === 'development'
            ? err.message
            : "An internal server error occurred."

        return res.status(500).json({ success: false, error: clientMessage })
    }
}

async function getCampaignsList(req, res, connection) {
    try {
        const [result] = await connection.promise().query(
            `SELECT * FROM campaigns AS c
            INNER JOIN
                capmaign_participants AS cp ON cp.campaign_id = c.id`
        )
        return res.json({ success: true, campaign: result })
    }
    catch (err) {
        console.error("Database error during campaign fetch: ", err)

        const clientMessage = process.env.NODE_ENV === 'development'
            ? err.message
            : "An internal server error occurred."

        return res.status(500).json({ success: false, error: clientMessage })
    }
}

async function createNewCampaign(req, res, connection) {
    const { joinCode, campaignName } = req.body
    const hostID = req.user.userId
    try {
        await connection.promise().query(
            "INSERT INTO campaigns (name, join_code) values (?,?)", [campaignName, joinCode]
        )
    }
    catch (err) {
        console.error("Database error during campaign creation: ", err)

        const clientMessage = process.env.NODE_ENV === 'development'
            ? err.message
            : "An internal server error occurred."

        return res.status(500).json({ success: false, error: clientMessage })
    }
    let campaignID
    try {
        const [result] = await connection.promise().query(
            "SELECT id FROM campaigns WHERE join_code = ?", [joinCode]
        )

        const campaign = result[0]
        campaignID = campaign.id
    }
    catch (err) {
        console.error("Database error during campaign creation: ", err)

        const clientMessage = process.env.NODE_ENV === 'development'
            ? err.message
            : "An internal server error occurred."

        return res.status(500).json({ success: false, error: clientMessage })
    }
    try {
        await connection.promise().query(
            "INSERT INTO capmaign_participants (user_id, campaign_id, users_role) VALUES (?,?,?)", [hostID, campaignID, "DM"]
        )
    }
    catch (err) {
        console.error("Database error during campaign creation: ", err)

        const clientMessage = process.env.NODE_ENV === 'development'
            ? err.message
            : "An internal server error occurred."

        return res.status(500).json({ success: false, error: clientMessage })
    }
    return res.json({ success: true, campaignID: campaignID })
}

async function joinNewCampaign(req, res, connection) {
    const {
        campaignCode, characterName, className, race,
        classDisplayName, raceDisplayName, level, xp,
        stats, modifiers, proficiencyBonus, combat, health, savingThrows,
        currency, equipment, skills, languages, tools
    } = req.body
    const userId = req.user.userId

    try {
        const [campaignRes] = await connection.promise().query(
            "SELECT id, name FROM campaigns WHERE join_code = ?",
            [campaignCode]
        )

        if (campaignRes.length === 0) {
            return res.status(400).json({ success: false, error: "Invalid Campaign Code." })
        }

        const campaignId = campaignRes[0].id
        const campaignName = campaignRes[0].name

        const [existingPlayer] = await connection.promise().query(
            "SELECT * FROM capmaign_participants WHERE user_id = ? AND campaign_id = ?",
            [userId, campaignId]
        )

        if (existingPlayer.length > 0) {
            return res.status(400).json({ success: false, error: "You are already a member of this campaign." })
        }

        const newCharacter = new Character({
            userId: userId,
            campaignId: campaignId,
            characterName: characterName,
            className: className,
            race: race,
            classDisplayName: classDisplayName,
            raceDisplayName: raceDisplayName,
            level: level,
            xp: xp,
            stats: stats,
            modifiers: modifiers,
            proficiencyBonus: proficiencyBonus,
            combat: combat,
            health: health,
            savingThrows: savingThrows,
            currency: currency,
            equipment: equipment,
            skills: skills,
            languages: languages,
            tools: tools
        })

        await newCharacter.save()

        await connection.promise().query(
            "INSERT INTO capmaign_participants (user_id, campaign_id, users_role, charachers_name) VALUES (?, ?, ?, ?)",
            [userId, campaignId, "player", characterName]
        )

        return res.json({ success: true, campaignName: campaignName, campaignId: campaignId })

    } catch (err) {
        console.error("Database error during campaign join: ", err)
        return res.status(500).json({ success: false, error: "An internal server error occurred." })
    }
}

async function getCharacter(req, res) {
    const campaignId = Number(req.query.campaignId)
    const userId = req.user.userId

    if (!campaignId || !userId) {
        return res.status(400).json({ success: false, error: "campaignId and userId are required" })
    }

    try {
        const character = await Character.findOne({ campaignId, userId })

        if (!character) {
            return res.status(404).json({ success: false, error: "Character not found." })
        }

        const responseData = {
            name: character.characterName,
            race: character.raceDisplayName,
            class: character.classDisplayName,
            level: character.level,
            xp: character.xp,
            attributes: {
                strength: { score: character.stats.str, modifier: character.modifiers.str },
                dexterity: { score: character.stats.dex, modifier: character.modifiers.dex },
                constitution: { score: character.stats.con, modifier: character.modifiers.con },
                intelligence: { score: character.stats.int, modifier: character.modifiers.int },
                wisdom: { score: character.stats.wis, modifier: character.modifiers.wis },
                charisma: { score: character.stats.cha, modifier: character.modifiers.cha }
            },
            combat: character.combat,
            health: character.health,
            proficiencyBonus: character.proficiencyBonus,
            savingThrows: character.savingThrows,
            skills: character.skills,
            currency: character.currency,
            equipment: character.equipment.map(name => ({ name, modifier: '' }))
        }

        return res.json({ success: true, character: responseData })
    }
    catch (err) {
        console.error("Database error during character fetch: ", err)
        return res.status(500).json({ success: false, error: "An internal server error occurred." })
    }
}

async function updateSkillProficiency(req, res) {
    const { campaignId, skillId, proficient } = req.body
    const userId = req.user.userId

    if (!campaignId || !skillId) {
        return res.status(400).json({ success: false, error: "campaignId and skillId are required" })
    }

    try {
        const character = await Character.findOne({ campaignId, userId })

        if (!character) {
            return res.status(404).json({ success: false, error: "Character not found." })
        }

        const skill = character.skills.find(s => s.id === skillId)

        if (!skill) {
            return res.status(404).json({ success: false, error: "Skill not found." })
        }

        skill.proficient = proficient
        skill.modifier = character.modifiers[skill.attribute] + (proficient ? character.proficiencyBonus : 0)

        await character.save()

        return res.json({ success: true, skill: skill })
    }
    catch (err) {
        console.error("Database error during skill update: ", err)
        return res.status(500).json({ success: false, error: "An internal server error occurred." })
    }
}

async function updateSavingThrowProficiency(req, res) {
    const { campaignId, savingThrowId, proficient } = req.body
    const userId = req.user.userId

    if (!campaignId || !savingThrowId) {
        return res.status(400).json({ success: false, error: "campaignId and savingThrowId are required" })
    }

    try {
        const character = await Character.findOne({ campaignId, userId })

        if (!character) {
            return res.status(404).json({ success: false, error: "Character not found." })
        }

        const savingThrow = character.savingThrows.find(s => s.id === savingThrowId)

        if (!savingThrow) {
            return res.status(404).json({ success: false, error: "Saving Throw not found." })
        }

        savingThrow.proficient = proficient
        savingThrow.modifier = character.modifiers[savingThrow.id] + (proficient ? character.proficiencyBonus : 0)

        await character.save()

        return res.json({ success: true, savingThrow: savingThrow })
    }
    catch (err) {
        console.error("Database error during saving throw update: ", err)
        return res.status(500).json({ success: false, error: "An internal server error occurred." })
    }
}

async function getSessionPlayersExceptDM(req, res, connection) {
    const campaignID = req.query.id
    const userID = req.user.userId

    try {
        const [campaign] = await connection.promise().query(
            `SELECT * FROM capmaign_participants AS cp
             INNER JOIN
             users_info AS u ON u.id = cp.user_id
             WHERE campaign_id = ? AND user_id != ?`, [campaignID, userID]
        )
        return res.json({ success: true, campaign: campaign })
    }
    catch (err) {
        console.error("Database error during campaign join: ", err)
        return res.status(500).json({ success: false, error: "An internal server error occurred." })
    }
}

async function leaveSession(req, res, connection) {
    const userID = req.user.userId
    const campaignID = req.query.campaignID

    try {
        const response = await connection.promise().query(
            `DELETE FROM capmaign_participants WHERE user_id = ? AND campaign_id = ?`, [userID, campaignID]
        )
    }
    catch (err) {
        console.error("Database error during delete: ", err)
    }
    return res.json({ success: true })
}

async function setUpNewDM(req, res, connection) {
    const { newDMid, campaignID } = req.query
    const leavingUserID = req.user.userId

    if (req.user.campaignRole !== 'DM') {
        return res.status(403).json({ success: false, error: "Only the current DM can transfer the DM role." })
    }

    try {
        await connection.promise().query(
            `UPDATE capmaign_participants 
            SET users_role = "DM", charachers_name = null
            WHERE user_id = ? AND campaign_id = ?`, [newDMid, campaignID]
        )
        await connection.promise().query(
            `DELETE FROM capmaign_participants WHERE user_id = ? AND campaign_id = ?`, [leavingUserID, campaignID]
        )
        return res.json({ success: true })
    }
    catch (err) {
        console.error("Database error during DM transfer: ", err)
        return res.status(500).json({ success: false, error: "An internal server error occurred." })
    }
}

async function deleteEntireCampaign(req, res, connection) {
    const campaignID = req.query.campaignID

    if (req.user.campaignRole !== 'DM') {
        return res.status(403).json({ success: false, error: "Only the DM can delete this campaign." })
    }

    try {
        await connection.promise().query(
            "DELETE FROM capmaign_participants WHERE campaign_id = ?",
            [campaignID]
        )

        await connection.promise().query(
            "DELETE FROM campaigns WHERE id = ?",
            [campaignID]
        )

        await Character.deleteMany({ campaignId: campaignID })

        return res.json({ success: true })

    } catch (err) {
        console.error("Database error during campaign destruction: ", err)
        return res.status(500).json({ success: false, error: "An internal server error occurred." })
    }
}

module.exports = {
    getCampaignsListByID,
    getCampaignsListByCode,
    getCampaignsList,
    joinNewCampaign,
    getCharacter,
    updateSkillProficiency,
    updateSavingThrowProficiency,
    getSessionPlayersExceptDM,
    leaveSession,
    setUpNewDM,
    deleteEntireCampaign,
    createNewCampaign
}