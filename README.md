# Kiberbez — Центр Кибербезопасности

Образовательный сайт по кибербезопасности: сканер утечек, OSINT-симулятор,
лента CVE, симулятор фишинга, терминал и игра **Kiber Run**.

## Структура проекта

```
kiberbez/
├── index.html          # Разметка (head, секции, без стилей и скриптов)
├── css/
│   └── styles.css      # Вся дизайн-система: палитра, glassmorphism, адаптив
├── js/
│   ├── config.js       # Конфигурация: Supabase, ADMIN_EMAIL, WORKER_URL
│   ├── app.js          # Логика сайта: навигация, утечки, OSINT, блог, CVE...
│   └── game.js         # Движок Kiber Run (отдельно от логики сайта)
├── assets/             # Картинки статей, логотипы
│   └── .gitkeep
├── database/
│   └── schema.sql      # Схема Supabase: таблицы, RLS-политики, RPC
├── sw.js               # Service worker (офлайн-кеш статики)
├── manifest.json       # PWA-манифест
├── .gitignore
├── LICENSE             # MIT
└── README.md
```

## Настройка Supabase

1. Создайте проект на [supabase.com](https://supabase.com) (регион — ближайший к пользователям).
2. **SQL Editor → New query** → вставьте `database/schema.sql` целиком → **Run**.
3. **Authentication → Providers → Email** → включите «Confirm email».
4. **Authentication → URL Configuration** → добавьте адрес сайта (GitHub Pages) в Site URL и Redirect URLs.
5. **Authentication → Users** → создайте пользователя из `ADMIN_EMAIL` (js/config.js) и подтвердите почту.
6. URL и publishable-ключ проекта впишите в `js/config.js`.

## Локальный запуск

```bash
cd kiberbez
python -m http.server 8000
# открыть http://localhost:8000
```

Двойной клик по `index.html` не подойдёт: service worker работает только по http/https.

## Деплой на GitHub Pages

1. Загрузите папку в репозиторий (см. команды ниже).
2. **Settings → Pages** → Source: Deploy from a branch → `main` / root → Save.
3. Сайт появится по адресу `https://ЛОГИН.github.io/kiberbez/`.

## Безопасность

- Publishable-ключ Supabase — публичный по дизайну; запись защищена RLS-политиками.
- `service_role` ключ никогда не должен попадать в репозиторий.
- Прямые вставки рекордов ограничены CHECK-ами и RPC `submit_score` (лимит: 1 раз в минуту).
