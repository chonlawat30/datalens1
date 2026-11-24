// ===== แดชบอร์ด: แสดงผลข้อมูลที่ดึงจาก Supabase =====
const $ = id => document.getElementById(id);
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const nf = (v, d = 0) => v == null || isNaN(v) ? '–' : Number(v).toLocaleString('th-TH', { minimumFractionDigits: d, maximumFractionDigits: d });
const MN = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
const mlab = k => k ? MN[+k.slice(5, 7) - 1] + ' ' + String(+k.slice(0, 4) + 543).slice(2) : 'ไม่ทราบวันที่';
const S = { clean: [], raw: [], log: [], page: 0, charts: {} }, PAGE = 50, BLUES = ['#0b2a5b', '#1d5fd1', '#5b9bff', '#8fb8ff', '#3a4f7a', '#b9d3ff'];
const sum = (a, f) => a.reduce((s, r) => s + (f(r) || 0), 0);
const status = (m, err) => { const s = $('status'); s.hidden = !m; s.textContent = m || ''; s.className = 'status' + (err ? ' err' : ''); };

async function load() {
  $('app').hidden = true; status('กำลังดึงข้อมูลจาก Supabase …');
  if (!Cloud.ok()) return status('ยังไม่ได้ตั้งค่า Supabase: ใส่ SUPABASE_URL และ SUPABASE_ANON_KEY ในไฟล์ js/config.js', true);
  try {
    Object.assign(S, await Cloud.loadAll());
    if (!S.clean.length) return status('ยังไม่มีข้อมูลใน Supabase กรุณารัน supabase/seed.sql', true);
    S.clean.forEach(r => r.month = r.sale_date ? r.sale_date.slice(0, 7) : null);
    initFilters(); status(''); $('app').hidden = false; renderAll();
  } catch (e) { status('ดึงข้อมูลไม่สำเร็จ: ' + e.message + ' — ตรวจ URL/anon key และว่ารัน schema.sql + seed.sql แล้ว ก่อนกดรีเฟรช', true); }
}
const FIL = { fMonth: ['เดือน', r => r.month], fBranch: ['สาขา', r => r.branch], fCat: ['หมวดหมู่', r => r.category], fChan: ['ช่องทางขาย', r => r.channel], fPay: ['วิธีชำระเงิน', r => r.payment_method] };
function initFilters() {
  for (const [id, [lab, f]] of Object.entries(FIL)) {
    const vals = [...new Set(S.clean.map(f).filter(Boolean))].sort();
    $(id).innerHTML = `<option value="">${lab}: ทั้งหมด</option>` + vals.map(v => `<option value="${esc(v)}">${id === 'fMonth' ? mlab(v) : esc(v)}</option>`).join('');
  }
  $('gDim').innerHTML = [['product_name', 'สินค้า'], ['category', 'หมวดหมู่'], ['branch', 'สาขา'], ['month', 'เดือน'], ['payment_method', 'วิธีชำระเงิน'], ['channel', 'ช่องทางขาย']].map(([v, l]) => `<option value="${v}">${l}</option>`).join('');
}
const view = (all) => S.clean.filter(r => (all || r.in_analysis) && Object.entries(FIL).every(([id, [, f]]) => !$(id).value || f(r) === $(id).value));
function agg(rows, key) { const m = new Map(); rows.forEach(r => { const k = key(r) ?? 'ไม่ทราบ'; const o = m.get(k) || { net: 0, qty: 0, n: 0 }; o.net += +r.net_sales || 0; o.qty += r.quantity || 0; o.n++; m.set(k, o); }); return m; }
const top = m => [...m].sort((a, b) => b[1].net - a[1].net);
function chart(id, cfg) { S.charts[id]?.destroy(); cfg.options = Object.assign({ responsive: true, maintainAspectRatio: false, animation: false, plugins: { legend: { display: cfg.type === 'doughnut', position: 'right' } } }, cfg.options); S.charts[id] = new Chart($(id), cfg); }

function renderAll() { const v = view(); renderOverview(v); renderQuality(); renderExplore(v); S.page = 0; renderTable(); }
function renderOverview(v) {
  const net = sum(v, r => +r.net_sales), gross = sum(v, r => +r.gross_sales), qty = sum(v, r => r.quantity);
  $('kpis').innerHTML = [[nf(net), 'ยอดขายสุทธิ (บาท)'], [nf(qty), 'จำนวนชิ้นที่ขาย'], [nf(v.length), 'จำนวนรายการขาย'], [nf(v.length ? net / v.length : 0, 2), 'ยอดเฉลี่ยต่อรายการ (บาท)'], [nf(gross - net), 'ส่วนลดรวม (บาท)']].map(k => `<div class="kpi"><b>${k[0]}</b><span>${k[1]}</span></div>`).join('');
  if (!v.length) { status('ไม่พบข้อมูลตามตัวกรองที่เลือก ลองกด "ล้างตัวกรอง"', false); } else status('');
  const mo = [...agg(v.filter(r => r.month), r => r.month)].sort((a, b) => a[0] < b[0] ? -1 : 1);
  chart('c1', { type: 'line', data: { labels: mo.map(x => mlab(x[0])), datasets: [{ label: 'ยอดขายสุทธิ', data: mo.map(x => x[1].net), borderColor: '#1d5fd1', backgroundColor: '#e8f0fd', fill: true, tension: .25, pointRadius: 4 }] } });
  const pr = top(agg(v, r => r.product_name)).slice(0, 10);
  chart('c2', { type: 'bar', data: { labels: pr.map(x => x[0]), datasets: [{ data: pr.map(x => x[1].net), backgroundColor: '#1d5fd1' }] }, options: { indexAxis: 'y' } });
  const ct = top(agg(v, r => r.category)); chart('c3', { type: 'doughnut', data: { labels: ct.map(x => x[0]), datasets: [{ data: ct.map(x => x[1].net), backgroundColor: BLUES }] } });
  const br = top(agg(v, r => r.branch)); chart('c4', { type: 'bar', data: { labels: br.map(x => x[0]), datasets: [{ data: br.map(x => x[1].net), backgroundColor: '#0b2a5b' }] } });
  const pa = top(agg(v, r => r.payment_method)); chart('c5', { type: 'doughnut', data: { labels: pa.map(x => x[0]), datasets: [{ data: pa.map(x => x[1].net), backgroundColor: BLUES }] } });
  insights(v, net, pr, br, mo);
}
function insights(v, net, pr, br, mo) {
  if (!v.length) return $('insights').innerHTML = '';
  const ins = [], pct = x => nf(100 * x / (net || 1), 1) + '%', known = br.filter(b => b[0] !== 'ไม่ระบุ');
  ins.push(`<b>${esc(pr[0][0])}</b> ทำยอดขายสุทธิสูงสุด ${nf(pr[0][1].net)} บาท (${pct(pr[0][1].net)} ของยอดรวม)`);
  if (known.length) ins.push(`สาขา<b>${esc(known[0][0])}</b> ขายดีที่สุด (${pct(known[0][1].net)}) ส่วนสาขา${esc(known.at(-1)[0])} ต่ำสุด (${pct(known.at(-1)[1].net)})`);
  if (mo.length > 1) { const s = [...mo].sort((a, b) => b[1].net - a[1].net); ins.push(`เดือนที่ขายดีสุดคือ <b>${mlab(s[0][0])}</b> (${nf(s[0][1].net)} บาท) และต่ำสุดคือ ${mlab(s.at(-1)[0])} (${nf(s.at(-1)[1].net)} บาท)`); }
  const on = sum(v.filter(r => r.channel === 'ออนไลน์'), r => +r.net_sales); ins.push(`ช่องทางออนไลน์คิดเป็น ${pct(on)} ของยอดขาย ส่วนหน้าร้านคิดเป็น ${pct(net - on)}`);
  const d = v.filter(r => r.discount > 0), nd = v.filter(r => !r.discount);
  if (d.length && nd.length) ins.push(`รายการที่มีส่วนลดมีค่าเฉลี่ย ${nf(sum(d, r => +r.net_sales) / d.length, 2)} บาท/รายการ เทียบกับ ${nf(sum(nd, r => +r.net_sales) / nd.length, 2)} บาท เมื่อไม่มีส่วนลด`);
  $('insights').innerHTML = '<h2>สรุปประเด็นสำคัญ (Insight)</h2><ul>' + ins.map(i => `<li>${i}</li>`).join('') + `</ul><div class="rec"><b>ข้อเสนอแนะ:</b> เพิ่มสต็อกและจัดโปรโมชันให้ ${esc(pr[0][0])} และสินค้าอันดับต้น ๆ, ศึกษาวิธีขายของสาขาที่ขายดีไปปรับใช้กับสาขาที่ยอดต่ำ, และบังคับกรอกสาขา/วิธีชำระเงิน/วันที่ในระบบบันทึกขาย เพื่อลดข้อมูลขาดหาย</div>`;
}
const DICT = [['tx_id', 'เลขที่รายการ', 'รหัสรายการ'], ['sale_date', 'วันที่ขาย', 'วันที่ (1 ม.ค. – 28 ต.ค. 2569)'], ['product_code', 'รหัสสินค้า', 'P001–P010'], ['product_name', 'ชื่อสินค้า', 'ข้อความ (ตัดช่องว่าง)'], ['category', 'หมวดหมู่', 'เครื่องเขียน / กระดาษ / อุปกรณ์สำนักงาน'], ['branch', 'สาขา', 'รวมชื่อให้เหลือ 4 สาขา'], ['quantity', 'จำนวน', 'จำนวนเต็ม > 0 จึงนำไปคำนวณ'], ['unit_price', 'ราคาต่อหน่วย', 'บาท (ราคา 0 แทนด้วยราคาปกติ)'], ['discount', 'ส่วนลด', 'สัดส่วน 0–1 (0.15 = 15%)'], ['payment_method', 'วิธีชำระเงิน', 'รวมเหลือ 4 กลุ่ม'], ['channel', 'ช่องทางขาย', 'หน้าร้าน / ออนไลน์']];
function renderQuality() {
  const fl = S.clean.filter(r => r.flags).length, used = S.clean.filter(r => r.in_analysis).length;
  $('qkpis').innerHTML = [[nf(S.raw.length), 'แถวข้อมูลดิบ', ''], [nf(S.clean.length), 'แถวหลังลบรายการซ้ำ', ''], [nf(used), 'แถวที่ใช้คำนวณยอดขาย', ''], [nf(fl), 'แถวที่ติดธงเตือน', 'warn']].map(k => `<div class="kpi ${k[2]}"><b>${k[0]}</b><span>${k[1]}</span></div>`).join('');
  $('log').innerHTML = '<tr><th>#</th><th>ปัญหาที่พบ</th><th>จำนวนแถว</th><th>วิธีจัดการ</th><th>เหตุผล</th><th>ตัวอย่างรายการ</th></tr>' + S.log.map(l => `<tr><td>${l.step_no}</td><td class="wrap">${esc(l.issue)}</td><td class="n">${l.found_count}</td><td class="wrap">${esc(l.action)}</td><td class="wrap">${esc(l.reason)}</td><td class="wrap">${esc(l.detail)}</td></tr>`).join('');
  $('dict').innerHTML = '<tr><th>คอลัมน์</th><th>ความหมาย</th><th>กฎ/รูปแบบ</th><th>ความครบถ้วน (ข้อมูลดิบ)</th><th>ค่าว่าง/ไม่ถูกต้อง</th></tr>' + DICT.map(([c, n, rule]) => {
    const miss = S.raw.filter(r => r[c] == null || r[c] === '' || (c === 'sale_date' && r[c] === 'วันไม่ระบุ')).length, p = 100 * (1 - miss / S.raw.length);
    return `<tr><td>${c}</td><td>${n}</td><td class="wrap">${rule}</td><td><div class="meter"><i style="width:${p}%"></i></div>${nf(p, 1)}%</td><td class="n">${miss}</td></tr>`; }).join('');
}
const stat = a => { a = a.filter(x => x != null && !isNaN(x)).sort((x, y) => x - y); if (!a.length) return []; const m = a.reduce((s, x) => s + x, 0) / a.length; return [m, a.length % 2 ? a[a.length >> 1] : (a[a.length / 2 - 1] + a[a.length / 2]) / 2, Math.sqrt(a.reduce((s, x) => s + (x - m) ** 2, 0) / a.length), a[0], a.at(-1)]; };
function renderExplore(v) {
  const F = [['จำนวน (ชิ้น)', r => r.quantity], ['ราคาต่อหน่วย (บาท)', r => +r.unit_price], ['ส่วนลด (%)', r => 100 * r.discount], ['ยอดขายสุทธิ (บาท)', r => +r.net_sales]];
  $('stats').innerHTML = '<tr><th>ตัวแปร</th><th>ค่าเฉลี่ย</th><th>มัธยฐาน</th><th>ส่วนเบี่ยงเบนมาตรฐาน</th><th>ต่ำสุด</th><th>สูงสุด</th></tr>' + F.map(([n, f]) => `<tr><td>${n}</td>${stat(v.map(f)).map(x => `<td class="n">${nf(x, 2)}</td>`).join('')}</tr>`).join('');
  const dim = $('gDim').value, net = sum(v, r => +r.net_sales);
  let g = [...agg(v, r => dim === 'month' ? mlab(r.month) : r[dim])]; g = dim === 'month' ? g.sort((a, b) => a[0] < b[0] ? -1 : 1) : g.sort((a, b) => b[1].net - a[1].net);
  $('group').innerHTML = '<tr><th>กลุ่ม</th><th>ยอดขายสุทธิ (บาท)</th><th>สัดส่วน</th><th>จำนวนชิ้น</th><th>จำนวนรายการ</th><th>เฉลี่ย/รายการ</th></tr>' + g.map(([k, o]) => `<tr><td>${esc(k)}</td><td class="n">${nf(o.net, 2)}</td><td><div class="meter"><i style="width:${100 * o.net / (net || 1)}%"></i></div>${nf(100 * o.net / (net || 1), 1)}%</td><td class="n">${nf(o.qty)}</td><td class="n">${nf(o.n)}</td><td class="n">${nf(o.net / o.n, 2)}</td></tr>`).join('');
}
const COLS = [['tx_id', 'เลขที่'], ['sale_date', 'วันที่'], ['product_name', 'สินค้า'], ['category', 'หมวดหมู่'], ['branch', 'สาขา'], ['quantity', 'จำนวน'], ['unit_price', 'ราคา'], ['discount', 'ส่วนลด'], ['payment_method', 'ชำระเงิน'], ['channel', 'ช่องทาง'], ['net_sales', 'ยอดสุทธิ'], ['flags', 'หมายเหตุ']];
const tview = () => { const q = $('q').value.trim().toLowerCase(); return view(true).filter(r => !q || Object.values(r).some(x => String(x ?? '').toLowerCase().includes(q))); };
function renderTable() {
  const v = tview(), pages = Math.max(1, Math.ceil(v.length / PAGE)); S.page = Math.min(S.page, pages - 1);
  $('count').textContent = v.length ? `พบ ${nf(v.length)} แถว (รวมแถวที่ติดธงเตือน)` : 'ไม่พบข้อมูลตามตัวกรอง ลองล้างตัวกรองหรือเปลี่ยนคำค้นหา';
  const cell = (c, r) => c === 'discount' ? nf(100 * r.discount) + '%' : c === 'flags' ? (r.flags ? `<span class="pill w">${esc(r.flags.replaceAll(';', ', '))}</span>` : '') : c === 'net_sales' ? nf(r[c], 2) : esc(r[c] ?? '');
  $('data').innerHTML = '<tr>' + COLS.map(c => `<th>${c[1]}</th>`).join('') + '</tr>' + v.slice(S.page * PAGE, (S.page + 1) * PAGE).map(r => '<tr>' + COLS.map(([c]) => `<td class="${['quantity', 'unit_price', 'discount', 'net_sales'].includes(c) ? 'n' : ''}">${cell(c, r)}</td>`).join('') + '</tr>').join('');
  $('pg').textContent = `หน้า ${S.page + 1} / ${pages}`; $('prev').disabled = S.page === 0; $('next').disabled = S.page >= pages - 1;
}
document.querySelectorAll('.tab').forEach(b => b.onclick = () => { document.querySelectorAll('.tab').forEach(x => x.classList.toggle('on', x === b)); document.querySelectorAll('.pane').forEach(p => p.classList.toggle('on', p.id === 'p-' + b.dataset.t)); $('filters').style.display = ['quality'].includes(b.dataset.t) ? 'none' : ''; if (b.dataset.t === 'overview') renderOverview(view()); });
Object.keys(FIL).forEach(id => $(id).onchange = renderAll);
$('gDim').onchange = () => renderExplore(view()); $('q').oninput = () => { S.page = 0; renderTable(); };
$('btnReset').onclick = () => { Object.keys(FIL).forEach(id => $(id).value = ''); $('q').value = ''; renderAll(); };
$('prev').onclick = () => { S.page--; renderTable(); }; $('next').onclick = () => { S.page++; renderTable(); };
$('btnRefresh').onclick = load;
$('btnCsv').onclick = () => { const q = x => { x = String(x ?? ''); return /[",\n]/.test(x) ? '"' + x.replace(/"/g, '""') + '"' : x; };
  const csv = [COLS.map(c => q(c[1])).join(','), ...tview().map(r => COLS.map(([c]) => q(c === 'discount' ? r.discount : r[c])).join(','))].join('\n');
  const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob(['\ufeff' + csv], { type: 'text/csv' })); a.download = 'datalens-sales.csv'; a.click(); };
load();
