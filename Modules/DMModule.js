const { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const crypto = require('crypto');
const sharp = require('sharp');
const helper = require('./helperFunctionsModule');

async function uploadAssets(req, res, connection, client) {
    if (!req.file) {
        return res.status(400).json({ success: false, error: "No file uploaded." })
    }

    const campaignId = req.body.campaignID
    const uploaderId = req.body.uploaderID
    const assetType = req.body.assetType || 'map'

    if (!campaignId || !uploaderId) {
        return res.status(400).json({ success: false, error: "Missing campaign or user IDs." });
    }

    const buffer = await sharp(req.file.buffer).resize({ height: 3000, width: 3000, fit: "contain" }).toBuffer() //might need to change values
    const imageName = helper.randomImageName()

    const params = {
        Bucket: process.env.BUCKET_NAME,
        Key: imageName,
        Body: buffer,
        ContentType: req.file.mimetype
    }

    try {
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

            const temporaryUrl = await getSignedUrl(client, command, { expiresIn: 3600*4 }) // 3600 seconds = hour. *4 because I want 4 hours. can be changed later

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
        
        if (!rows.length === 0) {
            res.status(404).send("Asset not found")
            return
        }
        const asset = rows[0]

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

module.exports = {
    uploadAssets,
    getAssets,
    deleteAssets
}