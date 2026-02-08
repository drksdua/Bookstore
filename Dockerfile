# Простий nginx для віддачі статичних файлів
FROM nginx:alpine

# Прибрати дефолтні сторінки (не обов'язково, але акуратніше)
RUN rm -rf /usr/share/nginx/html/*

# Копіюємо весь сайт у стандартну веб-директорію nginx
COPY . /usr/share/nginx/html

# Порт, який слухає nginx
EXPOSE 80

# Старт (за замовчуванням уже є в базовому образі)
CMD ["nginx", "-g", "daemon off;"]