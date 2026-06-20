const argon2 = require('argon2');
const helper = require('./helperFunctionsModule')

function validateSignUp(firstname, lastname, email, password, repeatPassword) {
    let errors = [];

    if (!firstname) { errors.push({ field: 'firstname', msg: 'First name is required' }) }
    else if (firstname.length > 40) { errors.push({ field: 'firstname', msg: "First name can't be longer than 40 characters" }) }
    if (!lastname) { errors.push({ field: 'lastname', msg: 'Last name is required' }) }
    else if (lastname.length > 40) { errors.push({ field: 'lastname', msg: "Last name can't be longer than 40 characters" }) }
    if (!email) { errors.push({ field: 'email', msg: 'Email is required' }) }
    else if (email.length > 254) { errors.push({ field: 'email', msg: "Email can't be longer than 254 characters" }) }
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

    if (!email) errors.push({ field: 'emailLogin', msg: 'Email is required' });

    if (!password) {
        errors.push({ field: 'passwordLogin', msg: 'Password is required' });
    }

    return errors;
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
        catch (dbErr) {
            console.error("Database error during email check: ", dbErr)

            const clientMessage = process.env.NODE_ENV === 'development'
                ? dbErr.message
                : "An internal server error occurred."

            return res.status(500).json({ success: false, error: clientMessage })

        }
    }

    if (errors.length > 0) {
        return res.status(400).json({ success: false, errors })
    }

    try {
        const hashedPassord = await argon2.hash(password);

        await connection.promise().query('insert into users_info values (?,?,?,?)', [firstname, lastname, email, hashedPassord])

        return res.json({ success: true, redirect: './campaignList.html' })
        // look into json web tokens to keep track of which account it is that is logged in
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
            'SELECT email, hashed_password FROM users_info WHERE email = ?', [email]
        )

        if (results.length === 0) {
            return res.status(401).json({ success: false, error: 'Invalid email or password' })
        }

        const user = results[0]

        const isMatch = await argon2.verify(user.hashed_password, password)

        if (!isMatch) {
            return res.status(401).json({ success: false, error: 'Invalid email or password' })
        }

        return res.json({ success: true, redirect: './campaignList.html' })
    }
    catch (err) {
        console.error("Login processing error: ", err)

        const clientMessage = process.env.NODE_ENV === 'development'
            ? dbErr.message
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