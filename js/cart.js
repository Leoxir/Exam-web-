/**
 * cart.js — скрипт для страницы корзины.
 *
 * Реализует:
 *  - отображение товаров из корзины (данные из localStorage)
 *  - удаление товаров из корзины
 *  - подсчёт стоимости заказа с учётом доставки
 *  - валидацию и отправку формы оформления заказа
 */

// ===== ИНИЦИАЛИЗАЦИЯ =====

document.addEventListener('DOMContentLoaded', function() {
    // Загружаем товары из корзины
    loadCartItems();

    // Обработчик кнопки «Сбросить»
    document.getElementById('order-reset').addEventListener('click', resetOrderForm);

    // Обработчик кнопки «Оформить»
    document.getElementById('order-submit').addEventListener('click', submitOrder);

    // Обработчики для пересчёта стоимости доставки
    document.getElementById('order-date').addEventListener('change', recalcTotal);
    document.getElementById('order-time').addEventListener('change', recalcTotal);
});


// ===== ЗАГРУЗКА ТОВАРОВ ИЗ КОРЗИНЫ =====

/**
 * Загружает товары из localStorage и отображает их на странице.
 * Идентификаторы хранятся в localStorage, а подробные данные
 * запрашиваются у сервера по каждому ID.
 */
function loadCartItems() {
    var cart = getCart();

    // Если корзина пуста — показываем сообщение
    if (cart.length === 0) {
        document.getElementById('cart-empty').style.display = 'block';
        document.getElementById('order-form-wrapper').style.display = 'none';
        return;
    }

    // Скрываем сообщение о пустой корзине
    document.getElementById('cart-empty').style.display = 'none';

    // Загружаем все товары, чтобы найти нужные
    apiGet('/goods', { page: 1, per_page: 200 })
        .then(function(data) {
            var goods = data.goods || [];

            // Фильтруем — оставляем только те, что в корзине
            var cartItems = goods.filter(function(item) {
                return cart.indexOf(item.id) !== -1;
            });

            // Отображаем карточки товаров
            renderCartItems(cartItems);

            // Показываем форму оформления
            document.getElementById('order-form-wrapper').style.display = 'block';

            // Считаем итоговую стоимость
            recalcTotal();
        })
        .catch(function(error) {
            console.error('Ошибка загрузки товаров корзины:', error);
            showNotification('Не удалось загрузить товары корзины', 'error');
        });
}

/**
 * Рендерит карточки товаров в корзине.
 * @param {Array} items — массив объектов товаров
 */
function renderCartItems(items) {
    var grid = document.getElementById('cart-grid');
    grid.innerHTML = '';

    if (items.length === 0) {
        document.getElementById('cart-empty').style.display = 'block';
        document.getElementById('order-form-wrapper').style.display = 'none';
        return;
    }

    items.forEach(function(item) {
        var card = createCartCard(item);
        grid.appendChild(card);
    });
}

/**
 * Создаёт DOM-элемент карточки товара для корзины.
 * Карточка содержит изображение, название, рейтинг, цену
 * и кнопку «Удалить».
 * @param {Object} item — объект товара
 * @returns {HTMLElement}
 */
function createCartCard(item) {
    var card = document.createElement('div');
    card.className = 'cart-card';
    card.setAttribute('data-id', item.id);

    // Генерируем звёздочки рейтинга
    var starsHtml = generateStarsCart(item.rating);

    // Формируем блок цен
    var priceHtml = '';
    if (item.discount_price) {
        var discountPercent = Math.round(
            (1 - item.discount_price / item.actual_price) * 100
        );
        priceHtml = '<span class="cart-card__price">' + item.discount_price + ' ₽</span>' +
            '<span class="cart-card__old-price">' + item.actual_price + ' ₽</span>' +
            '<span class="cart-card__discount">-' + discountPercent + '%</span>';
    } else {
        priceHtml = '<span class="cart-card__price">' + item.actual_price + ' ₽</span>';
    }

    card.innerHTML =
        '<div class="cart-card__image-wrapper">' +
            '<img class="cart-card__image" src="' + item.image_url + '" ' +
                'alt="' + escapeHtmlCart(item.name) + '" loading="lazy">' +
        '</div>' +
        '<div class="cart-card__info">' +
            '<p class="cart-card__name">' + escapeHtmlCart(item.name) + '</p>' +
            '<div class="cart-card__rating">' +
                '<span class="cart-card__stars">' + starsHtml + '</span>' +
                '<span>' + item.rating + '</span>' +
            '</div>' +
            '<div class="cart-card__prices">' + priceHtml + '</div>' +
        '</div>' +
        '<button class="cart-card__remove-btn">Удалить</button>';

    // Обработчик удаления товара из корзины
    var removeBtn = card.querySelector('.cart-card__remove-btn');
    removeBtn.addEventListener('click', function() {
        removeFromCart(item.id);
        // Удаляем карточку со страницы
        card.remove();
        showNotification('Товар удалён из корзины', 'info');
        // Пересчитываем стоимость
        recalcTotal();
        // Проверяем, не пуста ли корзина
        var cart = getCart();
        if (cart.length === 0) {
            document.getElementById('cart-empty').style.display = 'block';
            document.getElementById('order-form-wrapper').style.display = 'none';
        }
    });

    return card;
}


// ===== РАСЧЁТ СТОИМОСТИ =====

/**
 * Пересчитывает итоговую стоимость заказа.
 * Стоимость доставки зависит от дня недели и времени:
 *   - будни: 200 руб.
 *   - выходные: 300 руб.
 *   - вечерний интервал (после 18:00): +200 руб.
 */
function recalcTotal() {
    // Суммируем цены товаров в корзине
    var cards = document.querySelectorAll('.cart-card');
    var goodsTotal = 0;

    cards.forEach(function(card) {
        // Берём актуальную цену (первый .cart-card__price)
        var priceEl = card.querySelector('.cart-card__price');
        if (priceEl) {
            goodsTotal += parseFloat(priceEl.textContent) || 0;
        }
    });

    // Считаем стоимость доставки
    var deliveryCost = calculateDeliveryCost();

    // Обновляем отображение
    var totalPrice = goodsTotal + deliveryCost;
    document.getElementById('total-price').textContent = totalPrice + ' ₽';
    document.getElementById('delivery-info').textContent =
        '(стоимость доставки ' + deliveryCost + ' ₽)';
}

/**
 * Рассчитывает стоимость доставки на основе даты и времени.
 * @returns {number} — стоимость доставки в рублях
 */
function calculateDeliveryCost() {
    var dateInput = document.getElementById('order-date').value;
    var timeSelect = document.getElementById('order-time').value;

    // Если дата не выбрана — возвращаем базовую стоимость
    if (!dateInput) return 200;

    var date = new Date(dateInput);
    var dayOfWeek = date.getDay(); // 0 — воскресенье, 6 — суббота

    // Базовая стоимость: 200 руб. в будни, 300 руб. в выходные
    var cost = (dayOfWeek === 0 || dayOfWeek === 6) ? 300 : 200;

    // Доплата за вечернюю доставку (после 18:00)
    if (timeSelect === '18:00-22:00') {
        cost += 200;
    }

    return cost;
}


// ===== ОФОРМЛЕНИЕ ЗАКАЗА =====

/**
 * Отправляет заказ на сервер при нажатии кнопки «Оформить».
 * Перед отправкой проверяет заполнение обязательных полей.
 */
function submitOrder() {
    // Собираем данные из формы
    var name = document.getElementById('order-name').value.trim();
    var phone = document.getElementById('order-phone').value.trim();
    var email = document.getElementById('order-email').value.trim();
    var address = document.getElementById('order-address').value.trim();
    // Получаем дату и конвертируем из YYYY-MM-DD в ДД.ММ.ГГГГ для API
    var rawDate = document.getElementById('order-date').value;
    var deliveryDate = '';
    if (rawDate) {
        var parts = rawDate.split('-');
        deliveryDate = parts[2] + '.' + parts[1] + '.' + parts[0];
    }
    var deliveryTime = document.getElementById('order-time').value;
    var comment = document.getElementById('order-comment').value.trim();
    var subscribe = document.getElementById('order-subscribe').checked;

    // Простая валидация — проверяем обязательные поля
    if (!name || !phone || !email || !address || !deliveryDate) {
        showNotification('Заполните все обязательные поля', 'error');
        return;
    }

    // Собираем данные корзины
    var cart = getCart();
    if (cart.length === 0) {
        showNotification('Корзина пуста', 'error');
        return;
    }

    // Рассчитываем итоговую стоимость
    var deliveryCost = calculateDeliveryCost();
    var cards = document.querySelectorAll('.cart-card');
    var goodsTotal = 0;
    cards.forEach(function(card) {
        var priceEl = card.querySelector('.cart-card__price');
        if (priceEl) {
            goodsTotal += parseFloat(priceEl.textContent) || 0;
        }
    });

    // Формируем объект заказа для отправки
    var orderData = {
        full_name: name,
        phone: phone,
        email: email,
        delivery_address: address,
        delivery_date: deliveryDate,
        delivery_interval: deliveryTime,
        comment: comment,
        subscribe: subscribe,
        good_ids: cart,
        delivery_cost: deliveryCost,
        total_cost: goodsTotal + deliveryCost
    };

    // Отправляем POST-запрос на сервер
    apiPost('/orders', orderData)
        .then(function(response) {
            showNotification('Заказ успешно оформлен!', 'success');
            // Очищаем корзину
            localStorage.removeItem('cart');
            // Перенаправляем на главную через небольшую задержку
            setTimeout(function() {
                window.location.href = 'index.html';
            }, 1500);
        })
        .catch(function(error) {
            console.error('Ошибка оформления заказа:', error);
            // Выводим текст ошибки, если сервер его вернул
            var msg = (error && error.error) ? error.error : 'Ошибка оформления заказа';
            showNotification(msg, 'error');
        });
}

/**
 * Сбрасывает все поля формы оформления заказа.
 */
function resetOrderForm() {
    document.getElementById('order-name').value = '';
    document.getElementById('order-phone').value = '';
    document.getElementById('order-email').value = '';
    document.getElementById('order-address').value = '';
    document.getElementById('order-date').value = '';
    document.getElementById('order-time').selectedIndex = 0;
    document.getElementById('order-comment').value = '';
    document.getElementById('order-subscribe').checked = false;
    // Пересчитываем стоимость
    recalcTotal();
}


// ===== ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ =====

/**
 * Получает массив ID товаров из localStorage.
 * @returns {Array}
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
 * Удаляет товар из корзины по ID.
 * @param {number} id — ID товара
 */
function removeFromCart(id) {
    var cart = getCart();
    var index = cart.indexOf(id);
    if (index !== -1) {
        cart.splice(index, 1);
        localStorage.setItem('cart', JSON.stringify(cart));
    }
}

/**
 * Генерирует звёздочки рейтинга.
 * @param {number} rating
 * @returns {string}
 */
function generateStarsCart(rating) {
    var full = Math.floor(rating);
    var half = rating % 1 >= 0.5 ? 1 : 0;
    var empty = 5 - full - half;
    var stars = '';
    for (var i = 0; i < full; i++) stars += '★';
    for (var i = 0; i < half; i++) stars += '★';
    for (var i = 0; i < empty; i++) stars += '☆';
    return stars;
}

/**
 * Экранирует HTML-символы в строке.
 * @param {string} text
 * @returns {string}
 */
function escapeHtmlCart(text) {
    var div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}
