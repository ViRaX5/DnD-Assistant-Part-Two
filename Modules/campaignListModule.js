async function getCampaignsList(req, res, connection) {
    const userID = req.query.id

    if(!userID) {
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
    catch(err) {
        console.error("Database error during campaigns fetch: ", err)

            const clientMessage = process.env.NODE_ENV === 'development'
                ? err.message
                : "An internal server error occurred."

            return res.status(500).json({ success: false, error: clientMessage })
    }
}

async function createNewCampaign(req, res, connection) {
    const { joinCode, campaignName, hostID} = req.body
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
    let campaignID;
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
    return res.json({ success: true, redirect: './campaignList.html'})
}

module.exports = {
    getCampaignsList,
    createNewCampaign
}