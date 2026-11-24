# ตัวเลือกสำรองกรณีเวอร์ชันออนไลน์ใช้ไม่ได้: docker build -t datalens . && docker run -p 8080:80 datalens
FROM nginx:alpine
COPY . /usr/share/nginx/html
