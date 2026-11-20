"""Generate synthetic multilingual OCR test samples (Phase 0 benchmark).

All content is invented for benchmarking. No real contracts, no personal
information. Each sample writes a PNG plus a .gt.txt ground-truth file
containing the exact rendered lines.

Usage (from benchmarks/paddleocr-phase0, with the benchmark venv):
    .venv/Scripts/python.exe gen_samples.py
"""

from __future__ import annotations

import os
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

HERE = Path(__file__).resolve().parent
SAMPLES = HERE / "samples"
FONTS = Path(r"C:\Windows\Fonts")

WIDTH = 1600
MARGIN = 80
FONT_SIZE = 42
LINE_GAP = 14
BG = "white"
FG = "black"


def load_font(filename: str, size: int = FONT_SIZE) -> ImageFont.FreeTypeFont:
    path = FONTS / filename
    if not path.exists():
        raise FileNotFoundError(f"missing system font: {path}")
    return ImageFont.truetype(str(path), size)


def render_lines(lines: list[str], font: ImageFont.FreeTypeFont) -> Image.Image:
    draw_probe = ImageDraw.Draw(Image.new("RGB", (10, 10)))
    heights = []
    for line in lines:
        bbox = draw_probe.textbbox((0, 0), line if line else "Ag", font=font)
        heights.append(bbox[3] - bbox[1])
    total_h = sum(heights) + LINE_GAP * (len(lines) - 1) + 2 * MARGIN
    img = Image.new("RGB", (WIDTH, total_h), BG)
    draw = ImageDraw.Draw(img)
    y = MARGIN
    for line, h in zip(lines, heights):
        draw.text((MARGIN, y), line, font=font, fill=FG)
        y += h + LINE_GAP
    return img


def render_table(rows: list[list[str]], font: ImageFont.FreeTypeFont) -> Image.Image:
    cols = len(rows[0])
    col_w = (WIDTH - 2 * MARGIN) // cols
    probe = ImageDraw.Draw(Image.new("RGB", (10, 10)))
    row_h: list[int] = []
    for row in rows:
        hs = [probe.textbbox((0, 0), c or "Ag", font=font) for c in row]
        row_h.append(max(b[3] - b[1] for b in hs) + 24)
    total_h = sum(row_h) + 2 * MARGIN
    img = Image.new("RGB", (WIDTH, total_h), BG)
    draw = ImageDraw.Draw(img)
    y = MARGIN
    for r, h in zip(rows, row_h):
        x = MARGIN
        for c in r:
            draw.rectangle([x, y, x + col_w, y + h], outline="black", width=2)
            draw.text((x + 12, y + 12), c, font=font, fill=FG)
            x += col_w
        y += h
    return img


def save(name: str, img: Image.Image, gt_lines: list[str]) -> None:
    SAMPLES.mkdir(parents=True, exist_ok=True)
    img.save(SAMPLES / f"{name}.png")
    (SAMPLES / f"{name}.gt.txt").write_text("\n".join(gt_lines) + "\n", encoding="utf-8")
    print(f"wrote {name}.png  ({img.size[0]}x{img.size[1]})")


EN_OFFER = [
    "OFFER OF EMPLOYMENT",
    "",
    "Position: Fruit Picker (Seasonal)",
    "Employer: Kent Valley Farms Ltd",
    "Work location: Maidstone, United Kingdom",
    "Start date: 15 June 2026",
    "Contract duration: 6 months",
    "",
    "Basic pay: GBP 11.50 per hour",
    "Overtime rate: GBP 17.25 per hour",
    "Working hours: 40 hours per week",
    "Accommodation deduction: GBP 80.00 per week",
    "Transport deduction: 5% of gross pay",
    "",
    "Signed: ________________    Date: 01 June 2026",
]

EN_TABLE_ROWS = [
    ["Item", "Amount", "Frequency"],
    ["Basic salary", "GBP 1,840.00", "Monthly"],
    ["Overtime (10h)", "GBP 172.50", "Monthly"],
    ["Accommodation", "-GBP 320.00", "Monthly"],
    ["Transport", "-5%", "Of gross pay"],
    ["Net estimate", "GBP 1,692.50", "Monthly"],
]

EN_DENSE = [
    "The Employee shall perform seasonal agricultural work including planting,",
    "maintaining, and harvesting soft fruit crops at the sites designated by the",
    "Employer. Normal working hours are 8 hours per day, 5 days per week, from",
    "Monday to Friday, with a 30-minute unpaid meal break each working day. Any",
    "work performed beyond 40 hours per week shall be compensated at 1.5 times",
    "the basic hourly rate of GBP 11.50. The Employer shall provide shared",
    "accommodation at a charge of GBP 80.00 per week, deducted from wages. This",
    "agreement may be terminated by either party with 14 days written notice.",
    "Outstanding wages for hours worked up to 30 June 2026 shall be paid in full",
    "on the final pay date of 07 July 2026. Disputes shall first be raised with",
    "the site supervisor within 7 calendar days of the relevant event.",
]

ID_OFFER = [
    "SURAT PENAWARAN KERJA",
    "",
    "Posisi: Pekerja Perkebunan Kelapa Sawit",
    "Nama perusahaan: PT Nusantara Agro Lestari",
    "Lokasi kerja: Pekanbaru, Riau",
    "Tanggal mulai: 10 Agustus 2026",
    "Durasi kontrak: 24 bulan",
    "",
    "Gaji pokok: Rp 4.500.000 per bulan",
    "Tunjangan makan: Rp 750.000 per bulan",
    "Jam kerja: 8 jam per hari, 6 hari per minggu",
    "Potongan asuransi: 3% dari gaji pokok",
    "Uang lembur: Rp 35.000 per jam",
    "",
    "Tanda tangan: ________________    Tanggal: 01 Juli 2026",
]

MS_OFFER = [
    "SURAT TAWARAN PEKERJAAN",
    "",
    "Jawatan: Operator Pengeluaran",
    "Majikan: Kilang Maju Jaya Sdn. Bhd.",
    "Tempat kerja: Shah Alam, Selangor",
    "Tarikh mula: 05 Januari 2027",
    "Tempoh kontrak: 12 bulan",
    "",
    "Gaji asas: RM1,800.00 sebulan",
    "Elaun pengangkutan: RM200.00 sebulan",
    "Waktu kerja: 8 jam sehari, 5 hari seminggu",
    "Potongan KWSP: 11% daripada gaji asas",
    "Kadar kerja lebih masa: RM13.50 sejam",
    "",
    "Tandatangan: ________________    Tarikh: 20 Disember 2026",
]

JA_OFFER = [
    "雇用条件通知書",
    "",
    "職種: 食品加工スタッフ",
    "会社名: 株式会社さくら食品",
    "勤務地: 千葉県船橋市",
    "雇用開始日: 2026年9月1日",
    "契約期間: 12か月",
    "",
    "基本給: 月額 220,000円",
    "残業手当: 1時間あたり 1,720円",
    "勤務時間: 1日8時間、週40時間",
    "寮費控除: 月額 25,000円",
    "通勤手当: 月額 10,000円まで",
    "",
    "署名: ________________    日付: 2026年8月1日",
]

ZH_HANT_OFFER = [
    "聘僱要約書",
    "",
    "職位: 電子廠作業員",
    "雇主: 寶島精密工業股份有限公司",
    "工作地點: 桃園市中壢區",
    "到職日期: 2027年2月1日",
    "契約期間: 36個月",
    "",
    "基本工資: 新台幣 28,000元整",
    "加班費: 每小時 175元",
    "工作時間: 每日8小時, 每週40小時",
    "膳宿費扣款: 每月 2,500元",
    "交通津貼: 每月 1,200元",
    "",
    "簽名: ________________    日期: 2027年1月5日",
]

ZH_HANS_OFFER = [
    "聘用要约书",
    "",
    "职位: 电子厂作业员",
    "雇主: 宝岛精密工业股份有限公司",
    "工作地点: 桃园市中坜区",
    "到职日期: 2027年2月1日",
    "契约期间: 36个月",
    "",
    "基本工资: 新台币 28,000元整",
    "加班费: 每小时 175元",
    "工作时间: 每日8小时, 每周40小时",
    "膳宿费扣款: 每月 2,500元",
    "交通津贴: 每月 1,200元",
    "",
    "签名: ________________    日期: 2027年1月5日",
]

TH_OFFER = [
    "หนังสือเสนอจ้างงาน",
    "",
    "ตำแหน่ง: พนักงานบรรจุภัณฑ์",
    "นายจ้าง: บริษัท สยามฟู้ดส์ จำกัด",
    "สถานที่ทำงาน: สมุทรสาคร",
    "วันที่เริ่มงาน: 1 มีนาคม 2569",
    "ระยะเวลาสัญญา: 12 เดือน",
    "",
    "เงินเดือนพื้นฐาน: 15,000 บาทต่อเดือน",
    "ค่าล่วงเวลา: ชั่วโมงละ 95 บาท",
    "เวลาทำงาน: 8 ชั่วโมงต่อวัน",
    "หักค่าหอพัก: 2,000 บาทต่อเดือน",
]

VI_OFFER = [
    "THƯ MỜI LÀM VIỆC",
    "",
    "Vị trí: Công nhân may mặc",
    "Công ty: Công ty TNHH Dệt May Sài Gòn",
    "Nơi làm việc: Quận 12, TP. Hồ Chí Minh",
    "Ngày bắt đầu: 15/09/2026",
    "Thời hạn hợp đồng: 24 tháng",
    "",
    "Lương cơ bản: 8.000.000 đồng/tháng",
    "Phụ cấp ăn trưa: 800.000 đồng/tháng",
    "Giờ làm việc: 8 giờ/ngày, 6 ngày/tuần",
    "Khấu trừ bảo hiểm: 8% lương cơ bản",
    "Lương tăng ca: 55.000 đồng/giờ",
]


def main() -> None:
    latin = load_font("arial.ttf")
    japanese = load_font("NotoSansJP-VF.ttf")
    hant = load_font("msjh.ttc")
    hans = load_font("NotoSansSC-VF.ttf")
    thai = load_font("LeelawUI.ttf")

    save("en_offer", render_lines(EN_OFFER, latin), EN_OFFER)
    save("en_dense", render_lines(EN_DENSE, latin), EN_DENSE)
    table_gt = [" | ".join(r) for r in EN_TABLE_ROWS]
    save("en_table", render_table(EN_TABLE_ROWS, latin), table_gt)
    save("id_offer", render_lines(ID_OFFER, latin), ID_OFFER)
    save("ms_offer", render_lines(MS_OFFER, latin), MS_OFFER)
    save("ja_offer", render_lines(JA_OFFER, japanese), JA_OFFER)
    save("zh_hant_offer", render_lines(ZH_HANT_OFFER, hant), ZH_HANT_OFFER)
    save("zh_hans_offer", render_lines(ZH_HANS_OFFER, hans), ZH_HANS_OFFER)
    save("th_offer", render_lines(TH_OFFER, thai), TH_OFFER)
    save("vi_offer", render_lines(VI_OFFER, latin), VI_OFFER)
    print(f"samples in {SAMPLES}")


if __name__ == "__main__":
    main()
