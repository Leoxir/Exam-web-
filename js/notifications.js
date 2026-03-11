/**
 * notifications.js — модуль для отображения всплывающих уведомлений.
 * Уведомления появляются в правом верхнем углу и автоматически
 * исчезают через 5 секунд после появления.
 *
 * Типы уведомлений:
 *   - success (зелёное) — операция выполнена успешно
 *   - error (красное) — произошла ошибка
 *   - info (синее) — информационное сообщение
 */

/**
 * Показывает уведомление пользователю.
 * @param {string} message — текст уведомления
 * @param {string} type — тип: 'success', 'error' или 'info'
 */
function showNotification(message, type) {
    // Находим контейнер для уведомлений
    var container = document.getElementById('notifications');

    // Создаём элемент уведомления
    var notification = document.createElement('div');
    notification.className = 'notification notification--' + type;
    notification.textContent = message;

    // Добавляем кнопку закрытия (крестик)
    var closeBtn = document.createElement('button');
    closeBtn.className = 'notification__close';
    closeBtn.innerHTML = '&times;';
    closeBtn.addEventListener('click', function() {
        // При клике на крестик — удаляем уведомление
        notification.remove();
    });

    notification.appendChild(closeBtn);
    container.appendChild(notification);

    // Автоматически скрываем уведомление через 5 секунд
    setTimeout(function() {
        // Проверяем, что элемент ещё существует в DOM
        if (notification.parentNode) {
            notification.remove();
        }
    }, 5000);
}
