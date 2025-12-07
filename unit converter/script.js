
// Length

function metersToFeet(m) { 
    return m * 3.28084 
}

function feetToMeters(f) { 
    return f / 3.28084 
}

// Volume

function litersToGallons(l) { 
    return l * 0.264172 
}

function gallonsToLiters(g) { 
    return g / 0.264172 
}

// Mass

function kilosToPounds(kg) { 
    return kg * 2.20462 
}

function poundsToKilos(lb) { 
    return lb / 2.20462 

}

function formatNumber (value) {
    return parseFloat(value).toFixed(3)
}

// console.log(formatNumber(2.3456789))  // "2.346"

const convertBtnEl = document.getElementById('convertBtn')

function unitConvert (value) {
    // Length
    const feet = formatNumber(metersToFeet(value))
    const meters = formatNumber(feetToMeters(value))

    document.getElementById('lengthResult').textContent = `${value} meters = ${feet} feet | ${value} feet = ${meters} meters`;

    // Volume
    const gallons = formatNumber(litersToGallons(value))
    const liters = formatNumber(gallonsToLiters(value))

    document.getElementById('volumeResult').textContent = `${value} liters = ${gallons} gallons | ${value} gallons = ${liters} liters`;

    // Mass
    const pounds = formatNumber(kilosToPounds(value))
    const kilos = formatNumber(poundsToKilos(value))

    document.getElementById('massResult').textContent = `${value} kilos = ${pounds} pounds | ${value} pounds = ${kilos} kilos`;

}

convertBtnEl.addEventListener('click', function () {
    const inputValue = document.getElementById('valueInput').value;
    unitConvert(inputValue);
});


// initialize
unitConvert(Number(document.getElementById('valueInput').value || 20));
