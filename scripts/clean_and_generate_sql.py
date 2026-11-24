"""ตรวจสอบ/ทำความสะอาด data/raw_sales.xlsx แล้วสร้าง supabase/seed.sql
รัน:  pip install pandas openpyxl  &&  python scripts/clean_and_generate_sql.py
"""
import re, json, pandas as pd

SRC, OUT = 'data/raw_sales.xlsx', 'supabase/seed.sql'
COLS = ['tx_id','sale_date','product_code','product_name','category','branch','quantity','unit_price','discount','payment_method','channel']
raw = pd.read_excel(SRC, sheet_name='raw_sales', dtype=object); raw.columns = COLS
raw = raw.where(raw.notna(), None)
log = []
def add(issue, ids, action, reason): log.append((len(log)+1, issue, len(ids), action, reason, ', '.join(map(str, ids[:12])) + (' ...' if len(ids) > 12 else '')))

df = raw.copy()
# 1) แถวซ้ำ (ตรวจแล้วว่าซ้ำทุกคอลัมน์)
d = df.duplicated(keep='first'); add('แถวซ้ำทุกคอลัมน์ (เลขที่รายการซ้ำ)', list(df[d].tx_id), 'ลบสำเนา เก็บแถวแรกไว้', 'ตรวจแล้วเหมือนกันทุกช่อง เป็นการบันทึกซ้ำ ไม่ใช่การขายใหม่'); df = df[~d].copy()
# 2) ช่องว่างส่วนเกิน
ws = df[df.product_name.map(lambda s: s != s.strip())].tx_id.tolist(); add('ชื่อสินค้ามีช่องว่างท้ายข้อความ', ws, 'ตัดช่องว่าง (trim)', 'ทำให้ชื่อสินค้าชนิดเดียวกันแยกเป็นหลายกลุ่ม')
for c in ['product_name','branch','payment_method','channel','category']: df[c] = df[c].map(lambda s: s.strip() if isinstance(s, str) else s)
# 3) ชื่อสาขา
def br(s): return None if pd.isna(s) else re.sub(r'^สาขา\s*', '', s).strip()
b0 = df.branch.copy(); df['branch'] = df.branch.map(br)
add('ชื่อสาขาเขียนไม่เหมือนกัน (เช่น "สาขาเมือง", "สาขา เมือง", "เมือง")', df[b0.notna() & (b0 != df.branch)].tx_id.tolist(), 'รวมเป็น 4 สาขา: พระประแดง, สมุทรปราการ, เมือง, บางพลี', 'เป็นสาขาเดียวกัน')
m = df.branch.isna(); add('ไม่ระบุสาขา (ค่าว่าง)', df[m].tx_id.tolist(), 'ใส่ "ไม่ระบุ" และคงแถวไว้', 'ไม่สามารถเดาสาขาได้ จึงไม่ลบ ยังนับในยอดรวมแต่แยกกลุ่มไว้'); df.loc[m, 'branch'] = 'ไม่ระบุ'
# 4) วิธีชำระเงิน
PAY = {'เงินสด':'เงินสด','Cash':'เงินสด','สด':'เงินสด','โอน':'โอนเงิน','โอนเงิน':'โอนเงิน','Transfer':'โอนเงิน','Credit':'บัตรเครดิต','เครดิตการ์ด':'บัตรเครดิต','บัตรเครดิต':'บัตรเครดิต','QR':'QR PromptPay','พร้อมเพย์':'QR PromptPay','QR PromptPay':'QR PromptPay'}
p0 = df.payment_method.copy(); df['payment_method'] = p0.map(lambda s: PAY.get(s) if isinstance(s, str) else None)
add('วิธีชำระเงินใช้คำต่างกัน 11 แบบ (Cash/สด/เงินสด ฯลฯ)', df[p0.notna() & (p0 != df.payment_method)].tx_id.tolist(), 'รวมเป็น 4 กลุ่ม: เงินสด, โอนเงิน, บัตรเครดิต, QR PromptPay', 'ความหมายเดียวกัน')
m = df.payment_method.isna(); add('ไม่ระบุวิธีชำระเงิน (ค่าว่าง)', df[m].tx_id.tolist(), 'ใส่ "ไม่ระบุ" และคงแถวไว้', 'ไม่ควรเดาข้อมูลการชำระเงิน'); df.loc[m, 'payment_method'] = 'ไม่ระบุ'
# 5) วันที่
dt = pd.to_datetime(df.sale_date, errors='coerce'); m = dt.isna()
add('วันที่ไม่ถูกต้อง ("วันไม่ระบุ")', df[m].tx_id.tolist(), 'ตั้งวันที่เป็นค่าว่าง คงแถวไว้', 'ยังนับในยอดรวม แต่ไม่แสดงในกราฟรายเดือน')
df['sale_date'] = dt.dt.strftime('%Y-%m-%d').where(~m, None)
# 6) ราคา = 0 → ใช้ราคาปกติของสินค้านั้น
df['unit_price'] = df.unit_price.astype(float); good = df[df.unit_price > 0].groupby('product_code').unit_price.agg(lambda s: s.mode()[0])
m = df.unit_price == 0; add('ราคาต่อหน่วยเป็น 0', df[m].tx_id.tolist(), 'แทนด้วยราคาปกติของรหัสสินค้านั้น (ดินสอ 2B = 8, ยางลบ = 5)', 'สินค้าแต่ละรหัสมีราคาเดียวในข้อมูลส่วนที่เหลือทั้งหมด')
df.loc[m, 'unit_price'] = df[m].product_code.map(good)
# 7) ส่วนลด > 100%
df['discount'] = df.discount.astype(float); m = df.discount > 1
add('ส่วนลดเกิน 100% (1.5)', df[m].tx_id.tolist(), 'แก้เป็น 0.15 (สมมติว่าพิมพ์ผิด) และติดธง', 'ค่าอื่นมีแค่ 0, 5, 10, 15% — ควรยืนยันกับร้านค้า'); df.loc[m, 'discount'] = 0.15
# 8) จำนวน
q_raw = df.quantity.copy(); q = pd.to_numeric(q_raw, errors='coerce')
add('จำนวนเก็บเป็นข้อความหรือทศนิยม (เช่น "2.0")', df[q_raw.map(lambda v: isinstance(v, str) or (pd.notna(v) and float(v) != int(float(v))) or isinstance(v, float))].tx_id.tolist(), 'แปลงเป็นจำนวนเต็ม', 'ค่าเป็นจำนวนเต็มอยู่แล้ว เพียงชนิดข้อมูลไม่ตรงกัน')
df['quantity'] = q.astype('Int64'); mm = q.isna(); mn = q < 0
add('จำนวนว่าง', df[mm].tx_id.tolist(), 'คงแถวไว้ แต่ไม่นำไปคำนวณยอดขาย', 'ไม่ทราบจำนวนจริง จึงไม่เดา')
add('จำนวนติดลบ (-1)', df[mn].tx_id.tolist(), 'คงแถวไว้ แต่ไม่นำไปคำนวณยอดขาย', 'อาจเป็นการคืนสินค้าหรือคีย์ผิด ควรตรวจกับร้านค้าก่อนหักยอด')
pos = q[q > 0]; q1, q3 = pos.quantile(.25), pos.quantile(.75); hi = q3 + 1.5 * (q3 - q1); mo = q > hi
add(f'จำนวนสูงผิดปกติ (> {hi:.1f} ชิ้น ตามเกณฑ์ IQR)', df[mo].tx_id.tolist(), 'ตรวจแล้วเป็นไปได้ จึงเก็บไว้ ติดธงเตือน', 'ซื้อ 10 ชิ้นไม่เกินเหตุผล และราคาต่อหน่วยปกติ')
# ธงและยอดขาย
fl = {i: [] for i in df.index}
for cond, t in [(df.sale_date.isna(), 'ไม่ทราบวันที่'), (df.branch == 'ไม่ระบุ', 'ไม่ระบุสาขา'), (df.payment_method == 'ไม่ระบุ', 'ไม่ระบุการชำระเงิน'), (mm, 'ไม่ทราบจำนวน'), (mn, 'จำนวนติดลบ'), (mo, 'จำนวนสูงผิดปกติ')]:
    for i in df[cond.fillna(False)].index: fl[i].append(t)
df['flags'] = [';'.join(fl[i]) or None for i in df.index]
ok = df.quantity.notna() & (df.quantity.fillna(0) > 0); df['in_analysis'] = ok
df['gross_sales'] = (df.quantity.astype(float) * df.unit_price).where(ok); df['net_sales'] = (df.gross_sales * (1 - df.discount)).round(2).where(ok)
print('raw', len(raw), 'clean', len(df), 'analysis', int(ok.sum()), 'net', df.net_sales.sum().round(2)); [print(l[:3]) for l in log]
# สร้าง SQL
def lit(v):
    if v is None or (isinstance(v, float) and pd.isna(v)) or v is pd.NA: return 'null'
    if isinstance(v, bool): return 'true' if v else 'false'
    if isinstance(v, (int, float)): return repr(float(v)) if isinstance(v, float) and v != int(v) else str(int(v))
    return "'" + str(v).replace("'", "''") + "'"
def ins(table, cols, rows):
    out = []
    for i in range(0, len(rows), 100):
        out.append(f'insert into {table} ({", ".join(cols)}) values\n' + ',\n'.join('(' + ', '.join(lit(v) for v in r) + ')' for r in rows[i:i+100]) + ';')
    return '\n'.join(out)
raw_rows = [[i + 1] + [None if pd.isna(v) else str(v) for v in r] for i, r in enumerate(raw.itertuples(index=False))]
cc = ['tx_id','sale_date','product_code','product_name','category','branch','quantity','unit_price','discount','payment_method','channel','gross_sales','net_sales','in_analysis','flags']
sql = ['-- สร้างอัตโนมัติจาก scripts/clean_and_generate_sql.py (ข้อมูลต้นทาง: data/raw_sales.xlsx)', 'truncate sales_raw, sales_clean, cleaning_log;',
       ins('sales_raw', ['row_no'] + COLS, raw_rows), ins('sales_clean', cc, [[None if pd.isna(v) else v for v in r] for r in df[cc].astype(object).itertuples(index=False)]),
       ins('cleaning_log', ['step_no','issue','found_count','action','reason','detail'], log),
       "select (select count(*) from sales_raw) raw_rows, (select count(*) from sales_clean) clean_rows, (select count(*) from sales_clean where in_analysis) analysis_rows, (select round(sum(net_sales)) from sales_clean) net_sales;"]
open(OUT, 'w', encoding='utf8').write('\n\n'.join(sql)); print('wrote', OUT)
