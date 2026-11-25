# ตัวเลือกสำรองกรณีเวอร์ชันออนไลน์ใช้ไม่ได้: docker build -t sptc . && docker run -p 8080:80 sptc
FROM nginx:alpine
COPY . /usr/share/nginx/html
