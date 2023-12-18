'use strict';

async function getDataAsync(url) {
    const response = await fetch(url, {
        method: 'GET',
        headers: {
            'Content-Type': 'application/json',
        },
        redirect: 'follow',
    });
    if (response.ok) {
        return response.json();
    }
    const error = {
        status: response.status,
        customError: 'wtfAsync',
    };
    throw error;
}
function getDataPromise(url) {
    return fetch(url, {
        method: 'GET',
        headers: {
            'Content-Type': 'application/json',
        },
        redirect: 'follow',
    }).then(
        (response) => {
            if (response.ok) {
                return response.json();
            }
            return Promise.reject({
                status: response.status,
                customError: 'wtfPromise',
            });
        },
        (error) => {
            return Promise.reject(error);
        }
    );
}
const getData = getDataAsync || getDataPromise;
async function loadCountriesData() {
    let countries = [];
    try {
        countries = await getData('https://restcountries.com/v3.1/all?fields=name&fields=cca3&fields=area');
    } catch (error) {
        throw error;
    }
    return countries.reduce((result, country) => {
        result[country.cca3] = country;
        return result;
    }, {});
}
const form = document.getElementById('form');
const fromCountry = document.getElementById('fromCountry');
const toCountry = document.getElementById('toCountry');
const countriesList = document.getElementById('countriesList');
const submit = document.getElementById('submit');
const output = document.getElementById('output');
(async () => {
    if (!form || !fromCountry || !toCountry || !countriesList || !submit || !output) {
        throw new Error('Required element is missing from the page');
    }
    fromCountry.disabled = true;
    toCountry.disabled = true;
    submit.disabled = true;
    output.textContent = 'Loading…';
    let countriesData = {};
    try {
        countriesData = await loadCountriesData();
    } catch (error) {
        output.textContent = 'Something went wrong. Try to reset your compluter.';
        return;
    }
    output.textContent = '';
    Object.keys(countriesData)
        .sort((a, b) => (countriesData[b]?.area || 0) - (countriesData[a]?.area || 0))
        .forEach((code) => {
            const option = document.createElement('option');
            option.value = countriesData[code]?.name.common || '';
            countriesList.appendChild(option);
        });
    fromCountry.disabled = false;
    toCountry.disabled = false;
    submit.disabled = false;
    form.addEventListener('submit', (event) => {
        event.preventDefault();
    });
})();
// # sourceMappingURL=index.js.map
