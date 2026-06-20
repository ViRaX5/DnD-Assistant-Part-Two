function capitalizeComplexName(name) {
    if (!name) return name;
    return name.toLowerCase().replace(/\b\w/g, (char) => char.toUpperCase())
}


module.exports = {
    capitalizeComplexName
}