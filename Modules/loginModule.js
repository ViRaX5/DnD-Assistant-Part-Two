const argon2 = require('argon2')
const helper = require('./helperFunctionsModule')
const jwt = require('jsonwebtoken')

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function validateSignUp(firstname, lastname, email, password, repeatPassword) {
    let errors = []

    if (!firstname) { errors.push({ field: 'firstname', msg: 'First name is required' }) }
    else if (firstname.length > 40) { errors.push({ field: 'firstname', msg: "First name can't be longer than 40 characters" }) }
    if (!lastname) { errors.push({ field: 'lastname', msg: 'Last name is required' }) }
    else if (lastname.length > 40) { errors.push({ field: 'lastname', msg: "Last name can't be longer than 40 characters" }) }
    if (!email) { errors.push({ field: 'email', msg: 'Email is required' }) }
    else if (email.length > 254) { errors.push({ field: 'email', msg: "Email can't be longer than 254 characters" }) }
    else if (!emailRegex.test(email)) { errors.push({ field: 'email', msg: 'Please enter a valid email address' }) }
    if (!password) { errors.push({ field: 'password', msg: 'Password is required' }) }
    else if (password.length < 8) { errors.push({ field: 'password', msg: 'Password must contain at least 8 characters' }) }
    else if (password.length > 128) { errors.push({ field: 'password', msg: "Password can't be longer than 128 characters" }) }
    if (password !== repeatPassword) {
        errors.push({ field: 'repeatPassword', msg: 'Password and repeat password do not match' })
        errors.push({ field: 'password', msg: 'Password and repeat password do not match' })
    }

    return errors
}

function validateLogin(email, password) {
    let errors = []

    if (!email) errors.push({ field: 'emailLogin', msg: 'Email is required' })
    else if (!emailRegex.test(email)) { errors.push({ field: 'emailLogin', msg: 'Please enter a valid email address' }) }
    if (!password) {
        errors.push({ field: 'passwordLogin', msg: 'Password is required' })
    }

    return errors
}

async function signUp(req, res, connection) {
    let { firstname, lastname, email, password, repeatPassword } = req.body

    firstname = helper.capitalizeComplexName(firstname)
    lastname = helper.capitalizeComplexName(lastname)

    const errors = validateSignUp(firstname, lastname, email, password, repeatPassword)

    if (email) {
        try {
            const [results] = await connection.promise().query(
                'SELECT email FROM users_info WHERE email = ?', [email]
            )
            if (results.length > 0) {
                errors.push({ field: "email", msg: 'This email already has an account' })
            }
        }
        catch (err) {
            console.error("Database error during email check: ", err)

            const clientMessage = process.env.NODE_ENV === 'development'
                ? err.message
                : "An internal server error occurred."

            return res.status(500).json({ success: false, error: clientMessage })

        }
    }

    if (errors.length > 0) {
        return res.status(400).json({ success: false, errors })
    }

    try {
        const hashedPassord = await argon2.hash(password)

        await connection.promise().query('INSERT INTO users_info (first_name, last_name, email, hashed_password) values (?,?,?,?)', [firstname, lastname, email, hashedPassord])

        const [result] = await connection.promise().query(
            'SELECT id FROM users_info WHERE email = ?', [email]
        )
        if (result.length === 0) {
            return res.status(500).json({ success: false, error: 'Error retreiving new account' })
        }

        const user = result[0]

        helper.reduceTokens(connection, user.id)

        const accessToken = jwt.sign({ userId: user.id }, process.env.JWT_SECRET, { expiresIn: '15m' })
        const refreshToken = jwt.sign({ userId: user.id }, process.env.REFRESH_TOKEN_SECRET, { expiresIn: '7d' })

        const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
        await connection.promise().query(
            'INSERT INTO user_sessions (user_id, refresh_token, expires_at) VALUES (?, ?, ?)',
            [user.id, refreshToken, expiresAt]
        )

        res.cookie('refreshToken', refreshToken, {
            httpOnly: true, // Hides it from hackers' JavaScript
            secure: process.env.NODE_ENV === 'production',
            sameSite: process.env.NODE_ENV === 'production' ? 'None' : 'Lax',
            maxAge: 7 * 24 * 60 * 60 * 1000
        })

        return res.json({ success: true, token: accessToken, redirect: './campaignList.html' })
    }
    catch (err) {
        console.error("Database/Hashing error: ", err)

        const clientMessage = process.env.NODE_ENV === 'development'
            ? err.message
            : "An internal server error occurred."

        return res.status(500).json({ success: false, clientMessage })
    }
}

async function logIn(req, res, connection) {
    const { email, password } = req.body

    const errors = validateLogin(email, password)

    if (errors.length > 0) {
        return res.status(400).json({ success: false, errors })
    }

    try {
        const [results] = await connection.promise().query(
            'SELECT id, email, hashed_password FROM users_info WHERE email = ?', [email]
        )

        if (results.length === 0) {
            return res.status(401).json({ success: false, error: 'Invalid email or password' })
        }

        const user = results[0]

        const isMatch = await argon2.verify(user.hashed_password, password)

        if (!isMatch) {
            return res.status(401).json({ success: false, error: 'Invalid email or password' })
        }

        helper.reduceTokens(connection, user.id)

        const accessToken = jwt.sign({ userId: user.id }, process.env.JWT_SECRET, { expiresIn: '15m' })
        const refreshToken = jwt.sign({ userId: user.id }, process.env.REFRESH_TOKEN_SECRET, { expiresIn: '7d' })

        const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
        await connection.promise().query(
            'INSERT INTO user_sessions (user_id, refresh_token, expires_at) VALUES (?, ?, ?)',
            [user.id, refreshToken, expiresAt]
        )

        res.cookie('refreshToken', refreshToken, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: process.env.NODE_ENV === 'production' ? 'None' : 'Lax',
            maxAge: 7 * 24 * 60 * 60 * 1000
        })

        return res.json({ success: true, token: accessToken, redirect: './campaignList.html' })
    }
    catch (err) {
        console.error("Login processing error: ", err)

        const clientMessage = process.env.NODE_ENV === 'development'
            ? err.message
            : "An internal server error occurred."

        return res.status(500).json({ success: false, error: clientMessage })
    }
}



module.exports = {
    signUp,
    logIn,
    validateSignUp,
    validateLogin
}