/**
 * api.js — модуль для взаимодействия с сервером по API.
 * Содержит базовый URL, API-ключ и вспомогательные функции
 * для выполнения HTTP-запросов (GET, POST, PUT, DELETE).
 */

// Базовый URL API-сервера
var API_BASE = 'https://edu.std-900.ist.mospolytech.ru/exam-2024-1/api';

// Мой персональный ключ для доступа к API
var API_KEY = '79ab9b77-0ae9-4af6-ae74-a226fcb15d55';

/**
 * Формирует полный URL с параметрами для запроса к API.
 * @param {string} endpoint — путь запроса, например '/goods'
 * @param {Object} params — дополнительные GET-параметры
 * @returns {string} — полный URL с параметрами
 */
function buildUrl(endpoint, params) {
    // Создаём объект URL на основе базового адреса
    var url = new URL(API_BASE + endpoint);

    // Всегда добавляем ключ API
    url.searchParams.set('api_key', API_KEY);

    // Если переданы дополнительные параметры, добавляем их
    if (params) {
        for (var key in params) {
            // Проверяем, что параметр определён и не пустой
            if (params[key] !== undefined && params[key] !== null && params[key] !== '') {
                url.searchParams.set(key, params[key]);
            }
        }
    }

    return url.toString();
}

/**
 * Выполняет GET-запрос к API.
 * @param {string} endpoint — путь запроса
 * @param {Object} params — параметры запроса
 * @returns {Promise<Object>} — данные ответа в формате JSON
 */
function apiGet(endpoint, params) {
    var url = buildUrl(endpoint, params);

    return fetch(url)
        .then(function(response) {
            // Проверяем, успешен ли ответ сервера
            if (!response.ok) {
                throw new Error('Ошибка сервера: ' + response.status);
            }
            return response.json();
        });
}

/**
 * Выполняет POST-запрос к API (для создания записей).
 * @param {string} endpoint — путь запроса
 * @param {Object} body — данные, отправляемые на сервер
 * @returns {Promise<Object>} — ответ сервера в формате JSON
 */
function apiPost(endpoint, body) {
    var url = buildUrl(endpoint);

    return fetch(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(body)
    })
    .then(function(response) {
        if (!response.ok) {
            // Пытаемся получить тело ошибки
            return response.json().then(function(errData) {
                throw errData;
            });
        }
        return response.json();
    });
}

/**
 * Выполняет PUT-запрос к API (для обновления записей).
 * @param {string} endpoint — путь запроса (например '/orders/5')
 * @param {Object} body — обновлённые данные
 * @returns {Promise<Object>} — ответ сервера
 */
function apiPut(endpoint, body) {
    var url = buildUrl(endpoint);

    return fetch(url, {
        method: 'PUT',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(body)
    })
    .then(function(response) {
        if (!response.ok) {
            return response.json().then(function(errData) {
                throw errData;
            });
        }
        return response.json();
    });
}

/**
 * Выполняет DELETE-запрос к API (для удаления записей).
 * @param {string} endpoint — путь запроса (например '/orders/5')
 * @returns {Promise<Object>} — ответ сервера
 */
function apiDelete(endpoint) {
    var url = buildUrl(endpoint);

    return fetch(url, {
        method: 'DELETE'
    })
    .then(function(response) {
        if (!response.ok) {
            return response.json().then(function(errData) {
                throw errData;
            });
        }
        return response.json();
    });
}
