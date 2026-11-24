# DataLens – แดชบอร์ดยอดขายร้านเครื่องเขียน
หน้าเว็บ HTML + CSS + JS (ไม่ต้อง build) ดึงข้อมูลจาก Supabase อ่านอย่างเดียว

## โครงสร้าง
- `index.html` · `css/style.css` · `js/app.js` (แดชบอร์ด) · `js/cloud.js` (Supabase) · `js/config.js` (ใส่ URL + anon key)
- `data/raw_sales.xlsx` ข้อมูลดิบ · `scripts/clean_and_generate_sql.py` ตรวจ/ทำความสะอาดด้วย Python แล้วสร้าง `supabase/seed.sql`
- `supabase/schema.sql` สร้างตาราง · `supabase/seed.sql` ข้อมูลดิบ + ข้อมูลที่ทำความสะอาดแล้ว + บันทึกขั้นตอน
- `Dockerfile`, `vercel.json`

## ขั้นตอน
1. Supabase → SQL Editor: รัน `supabase/schema.sql` แล้วรัน `supabase/seed.sql`
2. ใส่ Project URL (แบบ `https://xxxx.supabase.co`) และ anon key ใน `js/config.js`
3. ทดสอบ: `python -m http.server 8000` แล้วเปิด http://localhost:8000
4. push ขึ้น GitHub โดยให้ `index.html` อยู่ที่รากของรีโป → Vercel: Import (Framework: Other, ไม่ต้องตั้ง build)

## ปรับข้อมูลใหม่
แก้ `data/raw_sales.xlsx` แล้วรัน `python scripts/clean_and_generate_sql.py` จากนั้นรัน `seed.sql` ใหม่
