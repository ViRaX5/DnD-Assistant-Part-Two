const crypto = require('crypto');
const { access } = require('fs');
const jwt = require('jsonwebtoken');

function capitalizeComplexName(name) {
    if (!name) return name;
    return name.toLowerCase().replace(/\b\w/g, (char) => char.toUpperCase())
}

function generateRandomString(length) {
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = '';
    for (let i = 0; i < length; i++) {
        const randomIndex = Math.floor(Math.random() * characters.length);
        result += characters.charAt(randomIndex);
    }
    return result;
}

async function getUniqueJoinCode(req, res, connection) {
    let isUnique = false;
    let newCode = '';

    while (!isUnique) {
        newCode = generateRandomString(6);

        try {
            const [existing] = await connection.promise().query(
                'SELECT id FROM campaigns WHERE join_code = ?',
                [newCode]
            );

            if (existing.length === 0) {
                isUnique = true;
            }
        }
        catch (err) {
            console.error("Code generation failed:", err)
            return res.status(500).json({ success: false, error: "Server error" })
        }
    }
    return res.json({ success: true, join_code: newCode })
}

const randomImageName = (bytes = 32) => crypto.randomBytes(bytes).toString('hex')

async function refreshToken(req, res, connection) {
    const refreshToken = req.cookies.refreshToken

    if (!refreshToken) {
        return res.status(401).json({ success: false, error: "No refresh token provided." })
    }


    try {
        const [results] = await connection.promise().query(
            'SELECT user_id FROM user_sessions WHERE refresh_token = ?', [refreshToken]
        )

        if (results.length === 0) {
            return res.status(403).json({ success: false, error: "Invalid refresh token." })
        }

        const userId = results[0].user_id

        jwt.verify(refreshToken, process.env.REFRESH_TOKEN_SECRET, async (err, decoded) => {
            if (err) {
                // Token is dead or tampered with. Clean it up from the DB.
                await connection.promise().query('DELETE FROM user_sessions WHERE refresh_token = ?', [refreshToken]);
                return res.status(403).json({ success: false, error: "Expired refresh token." });
            }

            await connection.promise().query('DELETE FROM user_sessions WHERE refresh_token = ?', [refreshToken])
            const newAccessToken = jwt.sign({ userId: userId }, process.env.JWT_SECRET, { expiresIn: '15m' })
            const newRefreshToken = jwt.sign({ userId: userId }, process.env.REFRESH_TOKEN_SECRET, { expiresIn: '7d' })

            const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
            await connection.promise().query(
                'INSERT INTO user_sessions (user_id, refresh_token, expires_at) VALUES (?, ?, ?)',
                [userId, newRefreshToken, expiresAt]
            )

            res.cookie('refreshToken', newRefreshToken, {
                httpOnly: true,
                secure: process.env.NODE_ENV === 'production',
                sameSite: 'Strict',
                maxAge: 7 * 24 * 60 * 60 * 1000
            })

            return res.json({ success: true, accessToken: newAccessToken })
        })
    }
    catch (err) {
        console.error("Refresh token error: ", err)
        return res.status(500).json({ success: false, error: "Database error." })
    }
}

async function reduceTokens(connection, id) {
    try {
        await connection.promise().query(
            'DELETE FROM user_sessions WHERE expires_at < NOW()'
        )

        const [activeSessions] = await connection.promise().query(
            'SELECT id FROM user_sessions WHERE user_id = ? ORDER BY created_at ASC', [id]
        )
        if (activeSessions.length >= 5) {
            const oldestSessionId = activeSessions[0].id
            await connection.promise().query(
                'DELETE FROM user_sessions WHERE id = ?',
                [oldestSessionId]
            )
            console.log(`Deleted oldest session for user ${id} to enforce 5-device limit.`)
        }
    }
    catch (err) {
        console.error("Database error: ", err)
    }
}

function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization']
    const token = authHeader && authHeader.split(' ')[1]

    if (!token) {
        return res.status(401).json({ success: false, error: "Access denied. No token provided." });
    }

    jwt.verify(token, process.env.JWT_SECRET, (err, decodedPayload) => {
        if (err) {
            return res.status(403).json({ success: false, error: "Invalid or expired access token." })
        }
        req.user = decodedPayload
        next()
    })
}

function checkCampaignAccess(connection) {
    return async (req, res, next) => {
        const userId = req.user.userId

        const campaignId = req.query.campaignId || req.query.campaignID || req.body.campaignID || req.body.campaignId

        if (!campaignId) return next()

        try {
            const [participants] = await connection.promise().query(
                'SELECT users_role FROM capmaign_participants WHERE user_id = ? AND campaign_id = ?',
                [userId, campaignId]
            )

            if (participants.length === 0) {
                return res.status(403).json({ success: false, error: "Access denied: You are not a member of this campaign." })
            }

            req.user.campaignRole = participants[0].users_role

            next()
        } catch (err) {
            console.error("Authorization DB Check Failed:", err)
            return res.status(500).json({ success: false, error: "Internal server error during access check." })
        }
    }
}

module.exports = {
    capitalizeComplexName,
    getUniqueJoinCode,
    randomImageName,
    refreshToken,
    reduceTokens,
    authenticateToken,
    checkCampaignAccess
}