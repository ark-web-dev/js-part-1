// eslint-disable-next-line no-restricted-imports
import Maps from './maps.js';

//API
const APP_API_URL = 'https://restcountries.com/v3.1';

//Types
type ICountry = {
    area: number;
    cca3: string;
    borders: string[];
    name: {
        common: string;
        official: string;
        nativeName: {
            [lng: string]: {
                common: string;
                official: string;
            };
        };
    };
};

type LoadCountriesResult = { [key: string]: ICountry };

// Загрузка данных через await
async function getDataAsync(url: string) {
    // https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API/Using_Fetch
    const response = await fetch(url, {
        method: 'GET',
        headers: {
            'Content-Type': 'application/json',
        },
        redirect: 'follow',
    });

    // При сетевой ошибке (мы оффлайн) из `fetch` вылетит эксцепшн.
    // Тут мы даём ему просто вылететь из функции дальше наверх.
    // Если же его нужно обработать, придётся обернуть в `try` и сам `fetch`:
    //
    // try {
    //     response = await fetch(url, {...});
    // } catch (error) {
    //     // Что-то делаем
    //     throw error;
    // }

    // Если мы тут, значит, запрос выполнился.
    // Но там может быть 404, 500, и т.д., поэтому проверяем ответ.
    if (response.ok) {
        return response.json();
    }

    // Пример кастомной ошибки (если нужно проставить какие-то поля
    // для внешнего кода). Можно выкинуть и сам `response`, смотря
    // какой у вас контракт. Главное перевести код в ветку `catch`.
    const error = {
        status: response.status,
        customError: 'wtfAsync',
    };
    throw error;
}

// Загрузка данных через промисы (то же самое что `getDataAsync`)
function getDataPromise(url: string) {
    // https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API/Using_Fetch
    return fetch(url, {
        method: 'GET',
        headers: {
            'Content-Type': 'application/json',
        },
        redirect: 'follow',
    }).then(
        (response) => {
            // Если мы тут, значит, запрос выполнился.
            // Но там может быть 404, 500, и т.д., поэтому проверяем ответ.
            if (response.ok) {
                return response.json();
            }
            // Пример кастомной ошибки (если нужно проставить какие-то поля
            // для внешнего кода). Можно зареджектить и сам `response`, смотря
            // какой у вас контракт. Главное перевести код в ветку `catch`.
            return Promise.reject({
                status: response.status,
                customError: 'wtfPromise',
            });
        },

        // При сетевой ошибке (мы оффлайн) из fetch вылетит эксцепшн,
        // и мы попадём в `onRejected` или в `.catch()` на промисе.
        // Если не добавить `onRejected` или `catch`, при ошибке будет
        // эксцепшн `Uncaught (in promise)`.
        (error) => {
            // Если не вернуть `Promise.reject()`, для внешнего кода
            // промис будет зарезолвлен с `undefined`, и мы не попадём
            // в ветку `catch` для обработки ошибок, а скорее всего
            // получим другой эксцепшн, потому что у нас `undefined`
            // вместо данных, с которыми мы работаем.
            return Promise.reject(error);
        }
    );
}

// Две функции просто для примера, выберите с await или promise, какая нравится
const getData = getDataAsync || getDataPromise;

async function loadCountriesData(): Promise<LoadCountriesResult> {
    let countries = [];
    try {
        // ПРОВЕРКА ОШИБКИ №1: ломаем этот урл, заменяя all на allolo,
        // получаем кастомную ошибку.
        countries = await getData(APP_API_URL + '/all?fields=name&fields=cca3&fields=area&fields=borders');
    } catch (error) {
        // console.log('catch for getData');
        // console.error(error);
        throw error;
    }
    return countries.reduce((result: LoadCountriesResult, country: ICountry) => {
        result[country.cca3] = country;
        return result;
    }, {});
}

//Получение границ для одной страны
async function loadCountryBorders(code: string, countriesData: LoadCountriesResult): Promise<string[]> {
    const country = countriesData[code];

    if (country) {
        return Promise.resolve(country.borders);
    }

    return Promise.reject({
        status: '',
        customError: 'No such country',
    });
}

//Получение маршрутов
async function getRoutesInfo(
    codeFrom: string,
    codeTarget: string,
    countriesData: LoadCountriesResult,
    maxSteps: number = 11
) {
    type Route = string[];
    type RoutesResultType = {
        routes: Route[];
        requestsCnt: 0;
    };

    const routesQueue: Route[] = [[codeFrom]];
    const routesMinLengthCache: { [key: string]: number } = {};
    const bordersCache: { [key: string]: string[] } = {};
    const routesResult: RoutesResultType = {
        routes: [],
        requestsCnt: 0,
    };

    Maps.setEndPoints(codeFrom, codeTarget);

    //Поиск маршрутов (BFS)
    while (routesQueue.length) {
        const currentRoute = routesQueue.shift() || [];
        const currentCode = currentRoute[currentRoute.length - 1] || '';

        Maps.markAsVisited([currentCode]);

        //Если нет в bordersCache, загружаем границы текущей страны
        if (currentCode && bordersCache[currentCode] === undefined) {
            try {
                /* eslint-disable no-await-in-loop */
                bordersCache[currentCode] = await loadCountryBorders(currentCode, countriesData);
                routesResult.requestsCnt += 1;
            } catch (error) {
                throw new Error(error.customError);
            }
        }

        //Получаем границы из кэша и обрабатываем их
        const borders = bordersCache[currentCode] || [];

        for (const borderCode of borders) {
            const newRoute = currentRoute.concat(borderCode);
            const borderMinRouteLength = routesMinLengthCache[borderCode];

            //Если таргет, кладем в результат
            if (borderCode === codeTarget) {
                routesResult.routes.push(newRoute);
                maxSteps = newRoute.length;
            }

            //Обновляем минимальную длину маршрута до текущего бордера и кладем маршрут в очередь
            if (
                newRoute.length < maxSteps &&
                (borderMinRouteLength === undefined || borderMinRouteLength >= newRoute.length)
            ) {
                routesMinLengthCache[borderCode] = newRoute.length;
                routesQueue.push(newRoute);
            }
        }
    }

    return routesResult;
}

//Получение кода cca3 по имени страны
const getCountryCodeByName = (name: string, countriesData: LoadCountriesResult) => {
    return Object.keys(countriesData).find((key) => countriesData[key]?.name.common === name);
};

//Вывод ошибки на страницу
const showError = (outputElement: HTMLElement, errorText: string, isSingleError: boolean = false) => {
    if (isSingleError) outputElement.innerHTML = '';

    const element = document.createElement('div');

    element.style.color = '#f00';
    element.textContent = errorText;

    outputElement.appendChild(element);
};

//Переводым элементы в disbled состояние
const disableElements = (...elements: Array<HTMLInputElement | HTMLButtonElement>) => {
    elements.forEach((el) => (el.disabled = true));
};

//Переводым элементы в enabled состояние
const enableElements = (...elements: Array<HTMLInputElement | HTMLButtonElement>) => {
    elements.forEach((el) => (el.disabled = false));
};

const form = document.getElementById('form');
const fromCountry = document.getElementById('fromCountry') as HTMLInputElement | null;
const toCountry = document.getElementById('toCountry') as HTMLInputElement | null;
const countriesList = document.getElementById('countriesList');
const submit = document.getElementById('submit') as HTMLButtonElement | null;
const output = document.getElementById('output') as HTMLElement | null;

(async () => {
    if (!form || !fromCountry || !toCountry || !countriesList || !submit || !output) {
        throw new Error('Required element is missing from the page');
    }

    disableElements(fromCountry, toCountry, submit);

    output.textContent = 'Loading…';
    let countriesData: LoadCountriesResult = {};
    try {
        // ПРОВЕРКА ОШИБКИ №2: Ставим тут брейкпоинт и, когда дойдёт
        // до него, переходим в оффлайн-режим. Получаем эксцепшн из `fetch`.
        countriesData = await loadCountriesData();
    } catch (error) {
        // console.log('catch for loadCountriesData');
        // console.error(error);
        output.textContent = 'Something went wrong. Try to reload your page.';
        return;
    }
    output.textContent = '';

    // Заполняем список стран для подсказки в инпутах
    Object.keys(countriesData)
        .sort((a, b) => (countriesData[b]?.area || 0) - (countriesData[a]?.area || 0))
        .forEach((code) => {
            const option = document.createElement('option');
            option.value = countriesData[code]?.name.common || '';
            countriesList.appendChild(option);
        });

    enableElements(fromCountry, toCountry, submit);

    form.addEventListener('submit', async (event) => {
        event.preventDefault();

        output.innerHTML = '';

        //Если поля не заполнены
        if (!fromCountry.value) showError(output, '"From" field cannot be empty!');
        if (!toCountry.value) showError(output, '"To" field cannot be empty!');
        if (!fromCountry.value || !toCountry.value) return;

        //Получаем коды cca3, по именам стран
        const codeFrom = getCountryCodeByName(fromCountry.value, countriesData);
        const codeTo = getCountryCodeByName(toCountry.value, countriesData);

        //Если страна не существует, или введено не корректное значение
        if (!codeFrom) showError(output, 'Country "From" does not exist, or the entered value is incorrect!');
        if (!codeTo) showError(output, 'Country "To" does not exist, or the entered value is incorrect!');
        if (!codeFrom || !codeTo) return;

        //Если введены одинаковые страны
        if (codeFrom === codeTo) {
            showError(output, 'The values of the "From" and "To" fields must be different!');
            return;
        }

        // TODO: Вывести, откуда и куда едем, и что идёт расчёт.
        output.innerHTML = `The route from <b>${fromCountry.value}</b> to <b>${toCountry.value}</b> is being calculated....`;

        disableElements(fromCountry, toCountry, submit);

        // TODO: Рассчитать маршрут из одной страны в другую за минимум запросов.
        let routesData;
        try {
            routesData = await getRoutesInfo(codeFrom, codeTo, countriesData);
        } catch (error) {
            showError(output, 'Something went wrong. Try to reload your page.', true);
            return;
        }

        enableElements(fromCountry, toCountry, submit);

        // TODO: Вывести маршрут и общее количество запросов.
        if (routesData?.routes.length) {
            const routesHtml = routesData?.routes
                .map((route) => route.map((item) => countriesData[item]?.name.common).join(' → '))
                .join('<br/>');

            output.innerHTML = `<b>Your results: </b><p style="color: green;">${routesHtml}</p><b>Number of requests: </b>${routesData.requestsCnt}`;
        } else {
            showError(output, 'The route is too long or missing! Please choose another destination.', true);
        }
    });
})();
