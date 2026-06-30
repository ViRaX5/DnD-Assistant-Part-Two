const { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const crypto = require('crypto');
const sharp = require('sharp');
const helper = require('./helperFunctionsModule');

async function uploadAssets(req, res, connection, client) {
    if (!req.file) {
        return res.status(400).json({ success: false, error: "No file uploaded." })
    }

    if (!req.file.mimetype.startsWith('image/') && !req.file.mimetype.startsWith('audio/')) {
        return res.status(400).json({ success: false, error: "Invalid file type. Please upload an image or audio." });
    }

    const campaignId = req.body.campaignID
    const uploaderId = req.user.userId
    const assetType = req.body.assetType || 'map'

    if (!campaignId || !uploaderId) {
        return res.status(400).json({ success: false, error: "Missing campaign or user IDs." });
    }

    let buffer
    const finalMimeType = assetType === 'token' ? 'image/png' : req.file.mimetype;
    const imageName = helper.randomImageName()

    try {
        if (req.file.mimetype.startsWith('image/')) {

            if (assetType === 'token') {
                const size = 256
                const circleSvg = Buffer.from(
                    `<svg width="${size}" height="${size}">
                    <circle cx="${size / 2}" cy="${size / 2}" r="${size / 2}" />
                    </svg>`
                )

                buffer = await sharp(req.file.buffer)
                    .resize(size, size, { fit: 'cover' })
                    .composite([{ input: circleSvg, blend: 'dest-in' }])
                    .png()
                    .toBuffer()
            }
            else if (assetType === 'map') {
                buffer = await sharp(req.file.buffer)
                    .resize({ height: 3000, width: 3000, fit: "inside" }) // might need to chage the values
                    .toBuffer()
            }
        }
        else if (req.file.mimetype.startsWith('audio/')) {
            buffer = req.file.buffer
            if (buffer.length > 10 * 1024 * 1024) throw new Error("Audio too large!")
        }
        else {
            return res.status(400).json({ success: false, error: "Unsupported file type. Please upload an image or audio file." })
        }

        const params = {
            Bucket: process.env.BUCKET_NAME,
            Key: imageName,
            Body: buffer,
            ContentType: finalMimeType
        }

        const command = new PutObjectCommand(params)
        await client.send(command)

        const [dbResult] = await connection.promise().query(`
            INSERT INTO campaign_assets 
            (campaign_id, uploader_id, s3_key, original_name, asset_type) 
            VALUES (?, ?, ?, ?, ?)`, [campaignId, uploaderId, imageName, req.file.originalname, assetType])

        return res.json({
            success: true,
            message: "Asset uploaded and saved to database!",
            assetId: dbResult.insertId,
            imageName: imageName
        })
    }
    catch (err) {
        console.error("Upload process failed:", err)
        return res.status(500).json({ success: false, error: "An error occurred during the upload process." })
    }
}

async function getAssets(req, res, connection, client) {
    const campaignId = req.query.campaignID

    if (!campaignId) {
        return res.status(400).json({ success: false, error: "Campaign ID is required." })
    }

    try {

        const [assets] = await connection.promise().query(`
            SELECT * FROM campaign_assets WHERE campaign_id = ? ORDER BY uploaded_at DESC`, [campaignId])

        const urlPromises = assets.map(async (asset) => {
            const getObjectParams = {
                Bucket: process.env.BUCKET_NAME,
                Key: asset.s3_key
            }
            const command = new GetObjectCommand(getObjectParams)

            const temporaryUrl = await getSignedUrl(client, command, { expiresIn: 3600 * 4 }) // 3600 seconds = hour. *4 because I want 4 hours. can be changed later

            asset.imageUrl = temporaryUrl

            return asset
        })

        await Promise.all(urlPromises)

        return res.json({ success: true, assets: assets })
    }
    catch (err) {
        console.error("Failed to fetch assets:", err)
        return res.status(500).json({ success: false, error: "Database or S3 error." })
    }
}

async function deleteAssets(req, res, connection, client) {
    const imageId = req.query.imageID

    if (!imageId) {
        return res.status(400).json({ success: false, error: "Image ID is required." })
    }

    try {
        const [rows] = await connection.promise().query(`
            SELECT * FROM campaign_assets WHERE id = ?`, [imageId])

        if (rows.length === 0) {
            res.status(404).send("Asset not found")
            return
        }
        const asset = rows[0]

        const [participants] = await connection.promise().query(
            'SELECT users_role FROM capmaign_participants WHERE user_id = ? AND campaign_id = ?',
            [req.user.userId, asset.campaign_id]
        )

        if (participants.length === 0 || participants[0].users_role !== 'DM') {
            return res.status(403).json({ success: false, error: "Only the DM of this campaign can delete this asset." })
        }

        const params = {
            Bucket: process.env.BUCKET_NAME,
            Key: asset.s3_key
        }

        const commad = new DeleteObjectCommand(params)
        await client.send(commad)

        await connection.promise().query(`
            DELETE FROM campaign_assets WHERE id = ?`, [imageId])

        return res.json({ success: true, message: "Asset deleted successfully", deletedId: imageId })
    }
    catch (err) {
        console.error("Failed to delete asset:", err)
        return res.status(500).json({ success: false, error: "Database or S3 error." })
    }
}

async function saveMonster(req, res, connection) {
    const { campaignID, monsterData } = req.body;

    if (!campaignID || !monsterData) {
        return res.status(400).json({ success: false, error: "Missing campaign ID or monster data." });
    }

    try {
        const monsterIndex = monsterData.index;

        const [existing] = await connection.promise().query(`
            SELECT id FROM campaign_monsters 
            WHERE campaign_id = ? 
            AND JSON_UNQUOTE(JSON_EXTRACT(monster_data, '$.index')) = ?`,
            [campaignID, monsterIndex]
        );

        if (existing.length > 0) {
            return res.json({ 
                success: true, 
                message: "Monster is already saved to this campaign.",
                insertId: existing[0].id
            });
        }

        const monsterDataStr = JSON.stringify(monsterData);

        const [dbResult] = await connection.promise().query(`
            INSERT INTO campaign_monsters (campaign_id, monster_data) 
            VALUES (?, ?)`, 
            [campaignID, monsterDataStr]
        );

        return res.json({ 
            success: true, 
            message: "Monster saved successfully!", 
            insertId: dbResult.insertId 
        });
    } catch (err) {
        console.error("Failed to save monster:", err);
        return res.status(500).json({ success: false, error: "Database error while saving monster." });
    }
}

async function getSavedMonsters(req, res, connection) {
    const campaignId = req.query.campaignID;

    if (!campaignId) {
        return res.status(400).json({ success: false, error: "Campaign ID is required." });
    }

    try {
        const [monsters] = await connection.promise().query(`
            SELECT * FROM campaign_monsters 
            WHERE campaign_id = ? 
            ORDER BY id DESC`, // Shows newest additions first
            [campaignId]
        );

        return res.json({ success: true, monsters: monsters });
    } catch (err) {
        console.error("Failed to fetch saved monsters:", err);
        return res.status(500).json({ success: false, error: "Database error fetching monsters." });
    }
}

module.exports = {
    uploadAssets,
    getAssets,
    deleteAssets,
    saveMonster,
    getSavedMonsters
}