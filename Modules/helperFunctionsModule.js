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
    return res.json({success: true, join_code: newCode})
}

module.exports = {
    capitalizeComplexName,
    getUniqueJoinCode
}