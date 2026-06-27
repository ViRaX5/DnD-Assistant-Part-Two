const BASE = 'https://www.dnd5eapi.co/api/2014';

const ABILITY_LIST = [
    { id: 'str', name: 'STR' },
    { id: 'dex', name: 'DEX' },
    { id: 'con', name: 'CON' },
    { id: 'int', name: 'INT' },
    { id: 'wis', name: 'WIS' },
    { id: 'cha', name: 'CHA' }
]

const SKILL_ABILITY_MAP = {
    'Acrobatics': 'dex',
    'Animal Handling': 'wis',
    'Arcana': 'int',
    'Athletics': 'str',
    'Deception': 'cha',
    'History': 'int',
    'Insight': 'wis',
    'Intimidation': 'cha',
    'Investigation': 'int',
    'Medicine': 'wis',
    'Nature': 'int',
    'Perception': 'wis',
    'Performance': 'cha',
    'Persuasion': 'cha',
    'Religion': 'int',
    'Sleight of Hand': 'dex',
    'Stealth': 'dex',
    'Survival': 'wis'
}

async function fetchClasses() {
    const response = await fetch(`${BASE}/classes`)
    return response.json()
}

async function fetchRaces() {
    const response = await fetch(`${BASE}/races`)
    return response.json()
}

async function fetchClassDetails(classIndex) {
    const [classRes, equipRes] = await Promise.all([
        fetch(`${BASE}/classes/${classIndex}`),
        fetch(`${BASE}/classes/${classIndex}/starting-equipment`)
    ])

    const classData = await classRes.json()
    const equipmentData = await equipRes.json()

    return { classData, equipmentData }
}

async function fetchRaceDetails(raceIndex) {
    const response = await fetch(`${BASE}/races/${raceIndex}`)
    return response.json()
}

async function fetchEquipmentCategory(categoryIndex) {
    const response = await fetch(`${BASE}/equipment-categories/${categoryIndex}`)
    return response.json()
}

async function computeCharacterSheet(className, race, stats, skills) {
    const [{ classData }, raceData] = await Promise.all([
        fetchClassDetails(className),
        fetchRaceDetails(race)
    ])

    const modifiers = {}
    ABILITY_LIST.forEach(({ id }) => {
        modifiers[id] = Math.floor((stats[id] - 10) / 2)
    })

    const proficiencyBonus = 2 // level 1 is always +2 in 5e

    const hitPointsMax = classData.hit_die + modifiers.con

    const proficientSaves = classData.saving_throws.map(s => s.index)

    const savingThrows = ABILITY_LIST.map(({ id, name }) => {
        const proficient = proficientSaves.includes(id)
        return {
            id,
            name,
            proficient,
            modifier: modifiers[id] + (proficient ? proficiencyBonus : 0)
        }
    })

    const chosenSkills = skills || []
    const structuredSkills = Object.entries(SKILL_ABILITY_MAP).map(([skillName, attribute]) => {
        const proficient = chosenSkills.includes(skillName)
        return {
            id: skillName.toLowerCase().replace(/\s+/g, '-'),
            name: skillName,
            attribute,
            proficient,
            modifier: modifiers[attribute] + (proficient ? proficiencyBonus : 0)
        }
    })

    const armorClass = 10 + modifiers.dex

    return {
        level: 1,
        xp: 0,
        modifiers,
        proficiencyBonus,
        combat: {
            armorClass,
            initiative: modifiers.dex,
            speed: raceData.speed
        },
        health: {
            current: hitPointsMax,
            max: hitPointsMax,
            temp: 0
        },
        savingThrows,
        skills: structuredSkills,
        classDisplayName: classData.name,
        raceDisplayName: raceData.name
    }
}

module.exports = {
    fetchClasses,
    fetchRaces,
    fetchClassDetails,
    fetchRaceDetails,
    fetchEquipmentCategory,
    computeCharacterSheet
}
