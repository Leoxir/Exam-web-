/**
 * catalog.js — скрипт для главной страницы каталога.
 *
 * Реализует:
 *  - загрузку товаров с сервера с пагинацией (Вариант 2)
 *  - отображение карточек товаров
 *  - сортировку по рейтингу и цене
 *  - фильтрацию по категориям, цене и скидкам
 *  - навигацию по страницам (пагинация)
 *  - добавление товаров в корзину (localStorage)
 */

// ===== ГЛОБАЛЬНЫЕ ПЕРЕМЕННЫЕ =====

// Текущая страница пагинации
var currentPage = 1;

// Количество товаров на одной странице
var perPage = 10;

// Текущий порядок сортировки
var currentSort = 'rating_desc';

// Массив всех загруженных товаров (для фильтрации на клиенте)
var allGoods = [];

// Массив всех уникальных категорий
var allCategories = [];

// ===== ИНИЦИАЛИЗАЦИЯ =====

// Запускаем инициализацию после загрузки DOM
document.addEventListener('DOMContentLoaded', function() {
    // Обновляем счётчик корзины в шапке
    updateCartCount();

    // Загружаем все товары для извлечения категорий
    loadAllGoods();

    // Загружаем первую страницу товаров
    loadGoods();

    // Обработчик выбора сортировки
    document.getElementById('sort-select').addEventListener('change', function() {
        currentSort = this.value;
        currentPage = 1; // При смене сортировки переходим на 1 страницу
        loadGoods();
    });

    // Обработчик кнопки «Применить» (фильтры)
    document.getElementById('apply-filters').addEventListener('click', function() {
        currentPage = 1;
        loadGoods();
    });

    // Обработчик поиска
    document.getElementById('search-btn').addEventListener('click', function() {
        currentPage = 1;
        loadGoods();
    });

    // Поиск по нажатию Enter
    document.getElementById('search-input').addEventListener('keydown', function(event) {
        if (event.key === 'Enter') {
            currentPage = 1;
            loadGoods();
        }
    });
});

// ===== ЗАГРУЗКА ТОВАРОВ =====

/**
 * Загружает все товары с сервера для получения списка категорий.
 * Делаем один запрос с большим per_page, чтобы получить все товары.
 */
function loadAllGoods() {
    apiGet('/goods', { page: 1, per_page: 200 })
        .then(function(data) {
            allGoods = data.goods || [];
            // Извлекаем уникальные категории из всех товаров
            extractCategories(allGoods);
        })
        .catch(function(error) {
            console.error('Ошибка загрузки категорий:', error);
        });
}

/**
 * Извлекает уникальные категории и выводит их как чекбоксы.
 * @param {Array} goods — массив всех товаров
 */
function extractCategories(goods) {
    var categoriesSet = {};

    // Проходимся по товарам и собираем уникальные категории
    goods.forEach(function(item) {
        if (item.main_category) {
            categoriesSet[item.main_category] = true;
        }
    });

    // Преобразуем объект в отсортированный массив
    allCategories = Object.keys(categoriesSet).sort();

    // Отображаем чекбоксы в сайдбаре
    var container = document.getElementById('categories-list');
    container.innerHTML = '';

    allCategories.forEach(function(category) {
        var label = document.createElement('label');
        label.className = 'sidebar__checkbox-label';

        var checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.value = category;
        checkbox.className = 'category-checkbox';

        label.appendChild(checkbox);
        // Добавляем текстовое название категории
        label.appendChild(document.createTextNode(' ' + category));
        container.appendChild(label);
    });
}

/**
 * Загружает товары с сервера с учётом текущих параметров
 * (страница, сортировка) и применяет фильтры на клиенте.
 */
function loadGoods() {
    var grid = document.getElementById('products-grid');
    grid.innerHTML = '<p class="catalog__loading">Загрузка товаров...</p>';

    // Формируем параметры запроса к серверу
    var params = {
        page: currentPage,
        per_page: perPage,
        sort_order: currentSort
    };

    apiGet('/goods', params)
        .then(function(data) {
            var goods = data.goods || [];
            var pagination = data._pagination || {};

            // Применяем клиентские фильтры
            var filtered = applyFilters(goods);

            // Отображаем карточки товаров
            renderProducts(filtered);

            // Рисуем навигацию по страницам
            renderPagination(pagination);
        })
        .catch(function(error) {
            console.error('Ошибка загрузки товаров:', error);
            grid.innerHTML = '<p class="catalog__loading">Не удалось загрузить товары.</p>';
            showNotification('Ошибка загрузки каталога', 'error');
        });
}

/**
 * Применяет фильтры (категории, цена, скидки, поиск) к массиву товаров.
 * Фильтрация выполняется на стороне клиента.
 * @param {Array} goods — массив товаров с сервера
 * @returns {Array} — отфильтрованный массив
 */
function applyFilters(goods) {
    // Получаем выбранные категории
    var checkboxes = document.querySelectorAll('.category-checkbox:checked');
    var selectedCategories = [];
    checkboxes.forEach(function(cb) {
        selectedCategories.push(cb.value);
    });

    // Получаем диапазон цен
    var priceFrom = parseFloat(document.getElementById('price-from').value) || 0;
    var priceTo = parseFloat(document.getElementById('price-to').value) || Infinity;

    // Проверяем чекбокс «Только товары со скидками»
    var discountOnly = document.getElementById('discount-only').checked;

    // Получаем поисковый запрос
    var searchQuery = document.getElementById('search-input')
        ? document.getElementById('search-input').value.trim().toLowerCase()
        : '';

    // Фильтруем товары
    return goods.filter(function(item) {
        // Определяем актуальную цену товара
        var price = item.discount_price || item.actual_price;

        // Фильтр по категориям (если ничего не выбрано — показываем все)
        if (selectedCategories.length > 0) {
            if (selectedCategories.indexOf(item.main_category) === -1) {
                return false;
            }
        }

        // Фильтр по диапазону цен
        if (price < priceFrom || price > priceTo) {
            return false;
        }

        // Фильтр: только товары со скидкой
        if (discountOnly && !item.discount_price) {
            return false;
        }

        // Фильтр по поисковому запросу (ищем в названии товара)
        if (searchQuery) {
            if (item.name.toLowerCase().indexOf(searchQuery) === -1) {
                return false;
            }
        }

        return true;
    });
}

// ===== ОТОБРАЖЕНИЕ ТОВАРОВ =====

/**
 * Рендерит карточки товаров в сетку каталога.
 * @param {Array} goods — массив товаров для отображения
 */
function renderProducts(goods) {
    var grid = document.getElementById('products-grid');
    grid.innerHTML = '';

    // Если нет товаров — выводим сообщение
    if (goods.length === 0) {
        grid.innerHTML = '<p class="catalog__loading">Товары не найдены.</p>';
        return;
    }

    // Получаем текущее содержимое корзины для проверки
    var cart = getCart();

    // Создаём карточку для каждого товара
    goods.forEach(function(item) {
        var card = createProductCard(item, cart);
        grid.appendChild(card);
    });
}

/**
 * Создаёт DOM-элемент карточки товара.
 * @param {Object} item — объект товара из API
 * @param {Array} cart — массив ID товаров в корзине
 * @returns {HTMLElement} — элемент карточки
 */
function createProductCard(item, cart) {
    var card = document.createElement('div');
    card.className = 'product-card';

    // Определяем, есть ли товар в корзине
    var isInCart = cart.indexOf(item.id) !== -1;

    // Формируем строку рейтинга (звёздочки)
    var starsHtml = generateStars(item.rating);

    // Формируем блок цен
    var priceHtml = '';
    if (item.discount_price) {
        // Если есть скидка — показываем обе цены и процент скидки
        var discountPercent = Math.round(
            (1 - item.discount_price / item.actual_price) * 100
        );
        priceHtml = '<span class="product-card__price">' + item.discount_price + ' ₽</span>' +
            '<span class="product-card__old-price">' + item.actual_price + ' ₽</span>' +
            '<span class="product-card__discount">-' + discountPercent + '%</span>';
    } else {
        priceHtml = '<span class="product-card__price">' + item.actual_price + ' ₽</span>';
    }

    // Собираем HTML карточки
    card.innerHTML =
        '<div class="product-card__image-wrapper">' +
            '<img class="product-card__image" src="' + item.image_url + '" ' +
                'alt="' + escapeHtml(item.name) + '" loading="lazy">' +
        '</div>' +
        '<div class="product-card__info">' +
            '<p class="product-card__name" title="' + escapeHtml(item.name) + '">' +
                escapeHtml(item.name) +
            '</p>' +
            '<div class="product-card__rating">' +
                '<span class="product-card__stars">' + starsHtml + '</span>' +
                '<span>' + item.rating + '</span>' +
            '</div>' +
            '<div class="product-card__prices">' + priceHtml + '</div>' +
        '</div>' +
        '<button class="product-card__add-btn' +
            (isInCart ? ' product-card__add-btn--in-cart' : '') +
            '" data-id="' + item.id + '">' +
            (isInCart ? 'В корзине' : 'Добавить') +
        '</button>';

    // Обработчик клика по кнопке «Добавить»
    var addBtn = card.querySelector('.product-card__add-btn');
    addBtn.addEventListener('click', function() {
        addToCart(item.id);
        // Обновляем внешний вид кнопки
        this.textContent = 'В корзине';
        this.classList.add('product-card__add-btn--in-cart');
        showNotification('Товар добавлен в корзину', 'info');
    });

    return card;
}

/**
 * Генерирует строку из звёздочек для рейтинга.
 * @param {number} rating — рейтинг товара (от 0 до 5)
 * @returns {string} — строка звёздочек
 */
function generateStars(rating) {
    var full = Math.floor(rating);        // Полные звёзды
    var half = rating % 1 >= 0.5 ? 1 : 0; // Половинная звезда
    var empty = 5 - full - half;           // Пустые звёзды

    var stars = '';
    for (var i = 0; i < full; i++) stars += '★';
    for (var i = 0; i < half; i++) stars += '★';
    for (var i = 0; i < empty; i++) stars += '☆';
    return stars;
}

/**
 * Экранирует спецсимволы HTML для безопасной вставки.
 * @param {string} text — исходная строка
 * @returns {string} — экранированная строка
 */
function escapeHtml(text) {
    var div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}


// ===== ПАГИНАЦИЯ (Вариант 2) =====

/**
 * Рисует панель навигации по страницам.
 * Кнопка текущей страницы выделена цветом.
 * @param {Object} pagination — объект с информацией о пагинации
 */
function renderPagination(pagination) {
    var container = document.getElementById('pagination');
    container.innerHTML = '';

    // Рассчитываем общее количество страниц
    var totalPages = Math.ceil(pagination.total_count / pagination.per_page);

    // Если страница всего одна — пагинацию не показываем
    if (totalPages <= 1) return;

    // Кнопка «Назад»
    if (currentPage > 1) {
        var prevBtn = document.createElement('button');
        prevBtn.className = 'pagination__btn';
        prevBtn.textContent = '←';
        prevBtn.addEventListener('click', function() {
            currentPage--;
            loadGoods();
            // Прокручиваем страницу наверх
            window.scrollTo({ top: 0, behavior: 'smooth' });
        });
        container.appendChild(prevBtn);
    }

    // Кнопки с номерами страниц
    // Показываем не все страницы, а диапазон вокруг текущей
    var startPage = Math.max(1, currentPage - 2);
    var endPage = Math.min(totalPages, currentPage + 2);

    // Если начало не с первой страницы — добавляем первую и многоточие
    if (startPage > 1) {
        container.appendChild(createPageBtn(1));
        if (startPage > 2) {
            var dots = document.createElement('span');
            dots.textContent = '...';
            dots.style.padding = '0 6px';
            container.appendChild(dots);
        }
    }

    for (var i = startPage; i <= endPage; i++) {
        container.appendChild(createPageBtn(i));
    }

    // Если конец не последняя страница — добавляем многоточие и последнюю
    if (endPage < totalPages) {
        if (endPage < totalPages - 1) {
            var dots = document.createElement('span');
            dots.textContent = '...';
            dots.style.padding = '0 6px';
            container.appendChild(dots);
        }
        container.appendChild(createPageBtn(totalPages));
    }

    // Кнопка «Вперёд»
    if (currentPage < totalPages) {
        var nextBtn = document.createElement('button');
        nextBtn.className = 'pagination__btn';
        nextBtn.textContent = '→';
        nextBtn.addEventListener('click', function() {
            currentPage++;
            loadGoods();
            window.scrollTo({ top: 0, behavior: 'smooth' });
        });
        container.appendChild(nextBtn);
    }
}

/**
 * Создаёт кнопку с номером страницы для пагинации.
 * @param {number} page — номер страницы
 * @returns {HTMLElement} — кнопка
 */
function createPageBtn(page) {
    var btn = document.createElement('button');
    btn.className = 'pagination__btn';
    btn.textContent = page;

    // Выделяем текущую страницу
    if (page === currentPage) {
        btn.classList.add('pagination__btn--active');
    }

    btn.addEventListener('click', function() {
        currentPage = page;
        loadGoods();
        window.scrollTo({ top: 0, behavior: 'smooth' });
    });

    return btn;
}


// ===== РАБОТА С КОРЗИНОЙ (localStorage) =====

/**
 * Возвращает массив ID товаров, добавленных в корзину.
 * @returns {Array} — массив ID товаров
 */
function getCart() {
    try {
        var cart = JSON.parse(localStorage.getItem('cart'));
        return Array.isArray(cart) ? cart : [];
    } catch (e) {
        return [];
    }
}

/**
 * Сохраняет массив ID товаров в localStorage.
 * @param {Array} cart — массив ID товаров
 */
function saveCart(cart) {
    localStorage.setItem('cart', JSON.stringify(cart));
}

/**
 * Добавляет товар в корзину по его ID.
 * Если товар уже есть — дублирование не происходит.
 * @param {number} id — ID товара
 */
function addToCart(id) {
    var cart = getCart();
    // Проверяем, что товар ещё не в корзине
    if (cart.indexOf(id) === -1) {
        cart.push(id);
        saveCart(cart);
    }
    // Обновляем счётчик в шапке
    updateCartCount();
}

/**
 * Обновляет отображение счётчика товаров в шапке.
 */
function updateCartCount() {
    var countEl = document.getElementById('cart-count');
    if (countEl) {
        var cart = getCart();
        countEl.textContent = cart.length;
    }
}
