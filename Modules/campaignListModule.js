async function getCampaignsList(req, res, connection) {
    const userID = req.query.id

    if(!userID) {
        return res.status(400).json({ success: false, error: "User ID is required" })
    }
    
    try {
        const [results] = await connection.promise().query(
            'SELECT * FROM campaigns where id = ?', [userID]
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

module.exports = {
    getCampaignsList
}