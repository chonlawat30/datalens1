-- DataLens: ตารางยอดขายร้านเครื่องเขียน (หน้าเว็บอ่านได้อย่างเดียว)
drop table if exists dataset_rows, datasets cascade;  -- ตารางเวอร์ชันเก่า (ถ้ามี)
drop table if exists sales_raw, sales_clean, cleaning_log cascade;

create table sales_raw (            -- ข้อมูลดิบตามไฟล์ต้นฉบับ (เก็บเป็นข้อความ เพื่อตรวจย้อนกลับ)
  row_no int primary key, tx_id text, sale_date text, product_code text, product_name text, category text,
  branch text, quantity text, unit_price text, discount text, payment_method text, channel text);

create table sales_clean (          -- ข้อมูลหลังทำความสะอาด
  tx_id text primary key, sale_date date, product_code text, product_name text, category text, branch text,
  quantity int, unit_price numeric, discount numeric, payment_method text, channel text,
  gross_sales numeric, net_sales numeric, in_analysis boolean, flags text);

create table cleaning_log (         -- บันทึกขั้นตอนทำความสะอาด
  step_no int primary key, issue text, found_count int, action text, reason text, detail text);

alter table sales_raw enable row level security;
alter table sales_clean enable row level security;
alter table cleaning_log enable row level security;
create policy "public read" on sales_raw for select using (true);
create policy "public read" on sales_clean for select using (true);
create policy "public read" on cleaning_log for select using (true);

-- anon (หน้าเว็บ) อ่านได้อย่างเดียว การเพิ่มข้อมูลทำผ่าน SQL Editor
grant usage on schema public to anon, authenticated;
grant select on sales_raw, sales_clean, cleaning_log to anon, authenticated;
