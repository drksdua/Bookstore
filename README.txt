# Bookstore (LitStore)

Статичний сайт-каталог книг: головна, каталог, сторінка товару, кошик, оформлення, контакти.  
Дані книг зберігаються в `data/books.json`, стилі — в `assets/css/main.css`.

## Демо (GitHub Pages)
https://drksdua.github.io/Bookstore/

> Якщо посилання не відкривається — перевір Settings → Pages: Branch = `main`, Folder = `/(root)`.

## Структура проєкту
- `index.html` — головна
- `catalog.html` — каталог
- `product.html` — сторінка книги
- `cart.html` — кошик
- `checkout.html` — оформлення
- `contacts.html` — контакти
- `data/books.json` — список книг (дані)
- `assets/css/main.css` — стилі (grayscale тема)
- `assets/js/app.js` — логіка (рендер, фільтри, кошик)

## Як запустити локально
### Варіант A: через VS Code Live Server
1. Відкрий папку проєкту у VS Code
2. ПКМ на `index.html` → **Open with Live Server**

### Варіант B: через Python (простий локальний сервер)
```bash
python -m http.server 8000
