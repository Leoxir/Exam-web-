/**
 * orders.js — скрипт для страницы личного кабинета (заказы).
 *
 * Реализует:
 *  - загрузку и отображение списка оформленных заказов
 *  - просмотр деталей заказа в модальном окне
 *  - редактирование заказа (PUT-запрос)
 *  - удаление заказа (DELETE-запрос) с подтверждением
 */

// ID заказа, с которым в данный момент работает пользователь
var currentOrderId = null;

// Массив всех заказов (для быстрого доступа)
var ordersData = [];

// ===== ИНИЦИАЛИЗАЦИЯ =====

document.addEventListener('DOMContentLoaded', function() {
    // Загружаем список заказов
    loadOrders();

    // Настраиваем обработчики модальных окон
    setupModals();

    // Обработчик сохранения при редактировании
    document.getElementById('modal-edit-save').addEventListener('click', saveOrder);

    // Обработчик подтверждения удаления
    document.getElementById('modal-delete-confirm').addEventListener('click', confirmDeleteOrder);
});


// ===== ЗАГРУЗКА ЗАКАЗОВ =====

/**
 * Загружает список заказов с сервера и отображает в таблице.
 */
function loadOrders() {
    apiGet('/orders')
        .then(function(data) {
            // Данные могут приходить в разных форматах
            ordersData = Array.isArray(data) ? data : (data.orders || []);
            renderOrders(ordersData);
        })
        .catch(function(error) {
            console.error('Ошибка загрузки заказов:', error);
            var tbody = document.getElementById('orders-tbody');
            tbody.innerHTML = '<tr><td colspan="6" class="orders-table__empty">' +
                'Не удалось загрузить заказы</td></tr>';
            showNotification('Ошибка загрузки заказов', 'error');
        });
}

/**
 * Рендерит строки таблицы заказов.
 * @param {Array} orders — массив объектов заказов
 */
function renderOrders(orders) {
    var tbody = document.getElementById('orders-tbody');
    tbody.innerHTML = '';

    // Если заказов нет — выводим сообщение
    if (orders.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" class="orders-table__empty">' +
            'У вас пока нет заказов</td></tr>';
        return;
    }

    // Создаём строку для каждого заказа
    orders.forEach(function(order, index) {
        var tr = document.createElement('tr');

        // Порядковый номер
        var tdNum = document.createElement('td');
        tdNum.textContent = index + 1;
        tr.appendChild(tdNum);

        // Дата оформления
        var tdDate = document.createElement('td');
        tdDate.textContent = formatDate(order.created_at);
        tr.appendChild(tdDate);

        // Состав заказа (список товаров)
        var tdGoods = document.createElement('td');
        var goodsText = getGoodsNames(order);
        var goodsSpan = document.createElement('span');
        goodsSpan.className = 'orders-table__truncated';
        goodsSpan.textContent = goodsText;
        goodsSpan.title = goodsText; // Всплывающая подсказка с полным текстом
        tdGoods.appendChild(goodsSpan);
        tr.appendChild(tdGoods);

        // Стоимость
        var tdCost = document.createElement('td');
        tdCost.textContent = (order.total_cost || order.delivery_cost || '—') + ' ₽';
        tr.appendChild(tdCost);

        // Дата и время доставки
        var tdDelivery = document.createElement('td');
        tdDelivery.textContent = (order.delivery_date || '—') + '\n' +
            (order.delivery_interval || '');
        tr.appendChild(tdDelivery);

        // Кнопки действий: Просмотр, Редактирование, Удаление
        var tdActions = document.createElement('td');
        tdActions.className = 'orders-table__actions';

        // Кнопка «Просмотр»
        var viewBtn = document.createElement('button');
        viewBtn.className = 'action-btn action-btn--view';
        viewBtn.innerHTML = '👁';
        viewBtn.title = 'Просмотр';
        viewBtn.addEventListener('click', function() {
            openViewModal(order);
        });

        // Кнопка «Редактирование»
        var editBtn = document.createElement('button');
        editBtn.className = 'action-btn action-btn--edit';
        editBtn.innerHTML = '✏';
        editBtn.title = 'Редактирование';
        editBtn.addEventListener('click', function() {
            openEditModal(order);
        });

        // Кнопка «Удаление»
        var deleteBtn = document.createElement('button');
        deleteBtn.className = 'action-btn action-btn--delete';
        deleteBtn.innerHTML = '🗑';
        deleteBtn.title = 'Удаление';
        deleteBtn.addEventListener('click', function() {
            openDeleteModal(order.id);
        });

        tdActions.appendChild(viewBtn);
        tdActions.appendChild(editBtn);
        tdActions.appendChild(deleteBtn);
        tr.appendChild(tdActions);

        tbody.appendChild(tr);
    });
}


// ===== ПРОСМОТР ЗАКАЗА =====

/**
 * Открывает модальное окно с подробной информацией о заказе.
 * @param {Object} order — объект заказа
 */
function openViewModal(order) {
    var body = document.getElementById('modal-view-body');

    // Формируем содержимое модального окна
    body.innerHTML =
        createInfoRow('Дата оформления', formatDate(order.created_at)) +
        createInfoRow('Имя', order.full_name || '—') +
        createInfoRow('Номер телефона', order.phone || '—') +
        createInfoRow('Email', order.email || '—') +
        createInfoRow('Адрес доставки', order.delivery_address || '—') +
        createInfoRow('Дата доставки', order.delivery_date || '—') +
        createInfoRow('Время доставки', order.delivery_interval || '—') +
        createInfoRow('Состав заказа', getGoodsNames(order)) +
        createInfoRow('Стоимость', (order.total_cost || '—') + ' ₽') +
        createInfoRow('Комментарий', order.comment || '—');

    // Показываем модальное окно
    document.getElementById('modal-view').style.display = 'flex';
}

/**
 * Создаёт строку с информацией для модалки просмотра.
 * @param {string} label — название поля
 * @param {string} value — значение поля
 * @returns {string} — HTML-строка
 */
function createInfoRow(label, value) {
    return '<div class="modal-info__row">' +
        '<span class="modal-info__label">' + label + ':</span>' +
        '<span>' + (value || '—') + '</span>' +
    '</div>';
}


// ===== РЕДАКТИРОВАНИЕ ЗАКАЗА =====

/**
 * Открывает модальное окно для редактирования заказа.
 * Поля формы заполняются текущими значениями заказа.
 * @param {Object} order — объект заказа
 */
function openEditModal(order) {
    currentOrderId = order.id;

    var body = document.getElementById('modal-edit-body');

    // Генерируем форму с текущими данными заказа
    body.innerHTML =
        '<div class="modal-form__group">' +
            '<label>Дата оформления</label>' +
            '<input type="text" value="' + formatDate(order.created_at) + '" disabled>' +
        '</div>' +
        '<div class="modal-form__group">' +
            '<label for="edit-name">Имя</label>' +
            '<input type="text" id="edit-name" value="' + escapeAttr(order.full_name || '') + '">' +
        '</div>' +
        '<div class="modal-form__group">' +
            '<label for="edit-phone">Телефон</label>' +
            '<input type="text" id="edit-phone" value="' + escapeAttr(order.phone || '') + '">' +
        '</div>' +
        '<div class="modal-form__group">' +
            '<label for="edit-email">Email</label>' +
            '<input type="email" id="edit-email" value="' + escapeAttr(order.email || '') + '">' +
        '</div>' +
        '<div class="modal-form__group">' +
            '<label for="edit-address">Адрес доставки</label>' +
            '<input type="text" id="edit-address" value="' + escapeAttr(order.delivery_address || '') + '">' +
        '</div>' +
        '<div class="modal-form__group">' +
            '<label for="edit-date">Дата доставки</label>' +
            '<input type="date" id="edit-date" value="' + (order.delivery_date || '') + '">' +
        '</div>' +
        '<div class="modal-form__group">' +
            '<label for="edit-time">Время доставки</label>' +
            '<select id="edit-time">' +
                '<option value="08:00-12:00"' + (order.delivery_interval === '08:00-12:00' ? ' selected' : '') + '>08:00-12:00</option>' +
                '<option value="12:00-14:00"' + (order.delivery_interval === '12:00-14:00' ? ' selected' : '') + '>12:00-14:00</option>' +
                '<option value="14:00-18:00"' + (order.delivery_interval === '14:00-18:00' ? ' selected' : '') + '>14:00-18:00</option>' +
                '<option value="18:00-22:00"' + (order.delivery_interval === '18:00-22:00' ? ' selected' : '') + '>18:00-22:00</option>' +
            '</select>' +
        '</div>' +
        '<div class="modal-form__group">' +
            '<label>Состав заказа</label>' +
            '<input type="text" value="' + escapeAttr(getGoodsNames(order)) + '" disabled>' +
        '</div>' +
        '<div class="modal-form__group">' +
            '<label>Стоимость</label>' +
            '<input type="text" value="' + (order.total_cost || '') + ' ₽" disabled>' +
        '</div>' +
        '<div class="modal-form__group">' +
            '<label for="edit-comment">Комментарий</label>' +
            '<textarea id="edit-comment" rows="2">' + (order.comment || '') + '</textarea>' +
        '</div>';

    // Показываем модальное окно
    document.getElementById('modal-edit').style.display = 'flex';
}

/**
 * Сохраняет изменения заказа — отправляет PUT-запрос на сервер.
 */
function saveOrder() {
    if (!currentOrderId) return;

    // Собираем данные из формы редактирования
    var updatedData = {
        full_name: document.getElementById('edit-name').value.trim(),
        phone: document.getElementById('edit-phone').value.trim(),
        email: document.getElementById('edit-email').value.trim(),
        delivery_address: document.getElementById('edit-address').value.trim(),
        delivery_date: document.getElementById('edit-date').value,
        delivery_interval: document.getElementById('edit-time').value,
        comment: document.getElementById('edit-comment').value.trim()
    };

    // Отправляем PUT-запрос
    apiPut('/orders/' + currentOrderId, updatedData)
        .then(function(response) {
            showNotification('Заказ успешно обновлён', 'success');
            // Закрываем модальное окно
            closeModal('modal-edit');
            // Перезагружаем таблицу заказов
            loadOrders();
        })
        .catch(function(error) {
            console.error('Ошибка обновления заказа:', error);
            var msg = (error && error.error) ? error.error : 'Ошибка при сохранении';
            showNotification(msg, 'error');
        });
}


// ===== УДАЛЕНИЕ ЗАКАЗА =====

/**
 * Открывает модальное окно подтверждения удаления.
 * @param {number} orderId — ID заказа
 */
function openDeleteModal(orderId) {
    currentOrderId = orderId;
    document.getElementById('modal-delete').style.display = 'flex';
}

/**
 * Подтверждает удаление заказа — отправляет DELETE-запрос.
 */
function confirmDeleteOrder() {
    if (!currentOrderId) return;

    apiDelete('/orders/' + currentOrderId)
        .then(function(response) {
            showNotification('Заказ удалён', 'success');
            closeModal('modal-delete');
            // Перезагружаем список заказов
            loadOrders();
        })
        .catch(function(error) {
            console.error('Ошибка удаления заказа:', error);
            var msg = (error && error.error) ? error.error : 'Ошибка при удалении';
            showNotification(msg, 'error');
            closeModal('modal-delete');
        });
}


// ===== УПРАВЛЕНИЕ МОДАЛЬНЫМИ ОКНАМИ =====

/**
 * Настраивает обработчики закрытия модальных окон.
 * Закрытие по кнопке (крестик) и клику по оверлею.
 */
function setupModals() {
    // Все кнопки закрытия с атрибутом data-close
    var closeButtons = document.querySelectorAll('[data-close]');
    closeButtons.forEach(function(btn) {
        btn.addEventListener('click', function() {
            var modalId = this.getAttribute('data-close');
            closeModal(modalId);
        });
    });

    // Закрытие по клику на оверлей (фон)
    var overlays = document.querySelectorAll('.modal-overlay');
    overlays.forEach(function(overlay) {
        overlay.addEventListener('click', function(event) {
            // Закрываем только если кликнули по самому оверлею,
            // а не по содержимому модалки
            if (event.target === overlay) {
                overlay.style.display = 'none';
            }
        });
    });
}

/**
 * Закрывает модальное окно по его ID.
 * @param {string} modalId — ID элемента модального окна
 */
function closeModal(modalId) {
    var modal = document.getElementById(modalId);
    if (modal) {
        modal.style.display = 'none';
    }
}


// ===== ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ =====

/**
 * Форматирует строку даты в читаемый формат.
 * @param {string} dateStr — строка даты (ISO формат)
 * @returns {string} — дата в формате ДД.ММ.ГГГГ ЧЧ:ММ
 */
function formatDate(dateStr) {
    if (!dateStr) return '—';

    try {
        var date = new Date(dateStr);
        var day = String(date.getDate()).padStart(2, '0');
        var month = String(date.getMonth() + 1).padStart(2, '0');
        var year = date.getFullYear();
        var hours = String(date.getHours()).padStart(2, '0');
        var minutes = String(date.getMinutes()).padStart(2, '0');
        return day + '.' + month + '.' + year + ' ' + hours + ':' + minutes;
    } catch (e) {
        return dateStr;
    }
}

/**
 * Получает строку с названиями товаров из заказа.
 * @param {Object} order — объект заказа
 * @returns {string} — названия через запятую
 */
function getGoodsNames(order) {
    // В зависимости от формата API, товары могут быть
    // в виде массива объектов или строки
    if (order.good_names && Array.isArray(order.good_names)) {
        return order.good_names.join(', ');
    }
    if (order.goods && Array.isArray(order.goods)) {
        return order.goods.map(function(g) {
            return g.name || g;
        }).join(', ');
    }
    if (order.good_ids && Array.isArray(order.good_ids)) {
        return 'Товары: ' + order.good_ids.join(', ');
    }
    return '—';
}

/**
 * Экранирует спецсимволы для атрибутов HTML.
 * @param {string} text
 * @returns {string}
 */
function escapeAttr(text) {
    if (!text) return '';
    return text.replace(/&/g, '&amp;')
               .replace(/"/g, '&quot;')
               .replace(/'/g, '&#39;')
               .replace(/</g, '&lt;')
               .replace(/>/g, '&gt;');
}
