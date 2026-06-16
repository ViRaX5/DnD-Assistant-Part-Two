const tempDB = { "firstname": "Amit", "lastname": "Lachmann", "email": "amit505r@gmail.com", "password": "HelloWorld" };

function validateSignUp(firstname, lastname, email, password, repeatPassword) {
    let errors = [];

    if (!firstname) { errors.push({ field: 'firstname', msg: 'First name is required' }) }
    if (!lastname) {errors.push({field: 'lastname', msg: 'Last name is required'})}
    if (!email) {errors.push({field: 'email', msg: 'Email is required'})}
    if (email === tempDB.email) {errors.push({field: 'email', msg: 'This email already has an account'})}
    if (!password) {errors.push({field: 'password', msg: 'Password is required'})}
    else if (password.length < 8) {errors.push({field: 'password', msg: 'Password must contain at least 8 characters'})}
    if (password !== repeatPassword)
    {
        errors.push({field: 'repeatPassword', msg: 'Password and repeat password do not match'})
        errors.push({field: 'password', msg: 'Password and repeat password do not match'})
    }
    
    return errors
}

function validateLogin(email, password) {
    let errors = []

    if (!email) errors.push({ field: 'emailLogin', msg: 'Email is required' });
    if (email !== tempDB.email && email !== '') {
        errors.push({ field: 'emailLogin', msg: 'Wrong email' });
    } 
    
    if (!password) {
        errors.push({ field: 'passwordLogin', msg: 'Password is required' });
    } else if (password !== tempDB.password && password !== '') {
        errors.push({ field: 'passwordLogin', msg: 'Wrong password' });
    }

    return errors;
}

module.exports = {
    validateSignUp,
    validateLogin
}