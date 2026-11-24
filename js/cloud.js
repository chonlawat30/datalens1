// ดึงข้อมูลจาก Supabase (อ่านอย่างเดียว) — ข้อมูลทั้งหมดในแดชบอร์ดมาจากที่นี่
const Cloud = {
  sb: null,
  ok() {
    const c = window.APP_CONFIG || {};
    if (!c.SUPABASE_URL || !c.SUPABASE_ANON_KEY) return false;
    let url; try { url = new URL(c.SUPABASE_URL.trim()).origin; } catch (e) { return false; } // ตัด /rest/v1/ ส่วนเกินออก
    this.sb = this.sb || supabase.createClient(url, c.SUPABASE_ANON_KEY.trim());
    return true;
  },
  async table(name, order) {
    let all = [];
    for (let from = 0; ; from += 1000) {
      const { data, error } = await this.sb.from(name).select('*').order(order).range(from, from + 999);
      if (error) throw new Error(`${name}: ${error.message}`);
      all = all.concat(data); if (data.length < 1000) return all;
    }
  },
  async loadAll() {
    const [clean, raw, log] = await Promise.all([this.table('sales_clean', 'tx_id'), this.table('sales_raw', 'row_no'), this.table('cleaning_log', 'step_no')]);
    return { clean, raw, log };
  }
};
