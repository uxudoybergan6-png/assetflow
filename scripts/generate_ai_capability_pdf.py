#!/usr/bin/env python3
"""Generate PDF: Can Cursor AI do all Creative Tools briefing tasks?"""

from fpdf import FPDF
from pathlib import Path

OUTPUT = Path.home() / "Desktop" / "AI_Texnik_Qobiliyat_Bahosi.pdf"


class ReportPDF(FPDF):
    def header(self):
        self.set_font("Helvetica", "B", 11)
        self.set_text_color(60, 60, 120)
        self.cell(0, 8, "Creative Tools SaaS - AI (Cursor) qobiliyati", align="C", new_x="LMARGIN", new_y="NEXT")
        self.ln(2)

    def footer(self):
        self.set_y(-12)
        self.set_font("Helvetica", "I", 8)
        self.set_text_color(128, 128, 128)
        self.cell(0, 8, f"Sahifa {self.page_no()}/{{nb}}", align="C")

    def section_title(self, title: str):
        self.set_x(self.l_margin)
        self.ln(4)
        self.set_font("Helvetica", "B", 12)
        self.set_text_color(40, 40, 80)
        self.multi_cell(self.epw, 7, title)
        self.ln(2)

    def body_text(self, text: str):
        self.set_x(self.l_margin)
        self.set_font("Helvetica", "", 10)
        self.set_text_color(30, 30, 30)
        self.multi_cell(self.epw, 5.5, text)
        self.ln(2)

    def bullet(self, text: str):
        self.set_x(self.l_margin)
        self.set_font("Helvetica", "", 10)
        self.set_text_color(30, 30, 30)
        self.multi_cell(self.epw, 5.5, f"- {text}")


def build_pdf():
    pdf = ReportPDF()
    pdf.alias_nb_pages()
    pdf.set_auto_page_break(auto=True, margin=18)
    pdf.add_page()

    # Title block
    pdf.set_font("Helvetica", "B", 16)
    pdf.set_text_color(30, 30, 60)
    pdf.multi_cell(pdf.epw, 9, "AI (Cursor) barcha ishlarni\nqila oladimi?", align="C")
    pdf.ln(3)
    pdf.set_font("Helvetica", "", 10)
    pdf.set_text_color(80, 80, 80)
    pdf.multi_cell(
        pdf.epw,
        5,
        "Developer Texnik Brifing asosida baho\n"
        "Oceananimatsion Ltd | Creative Tools SaaS Platforma\n"
        "Tayyorlangan sana: 30-may, 2026",
        align="C",
    )
    pdf.ln(8)

    pdf.section_title("Qisqa javob")
    pdf.body_text(
        "HA - loyihaning asosiy texnik qismi (taxminan 70-85%) Cursor AI yordamida "
        "yozilishi va integratsiya qilinishi mumkin. Lekin 100% avtonom emas: Adobe "
        "pluginlarni real dasturda sinash, Stripe/AWS/Cloudflare hisoblarni sozlash, "
        "300+ professional asset kontenti va biznes qarorlari inson (yoki jamoa) "
        "tomonidan bajarilishi shart."
    )

    pdf.section_title("Brifingdagi ishlar - AI qobiliyati")
    table_rows = [
        ("Web (Landing, narx, kabinet)", "Ha", "~90%", "Next.js + Tailwind"),
        ("Backend + API", "Ha", "~85%", "Node.js + PostgreSQL"),
        ("Stripe integratsiya", "Qisman", "~80%", "Kod-AI; hisob-siz"),
        ("Auth tizimi", "Ha", "~90%", "NextAuth.js"),
        ("S3 + CDN", "Qisman", "~75%", "Kod-AI; infra-siz"),
        ("Admin panel", "Ha", "~85%", "Asset va user boshqaruv"),
        ("Premiere Pro UXP plugin", "Qisman", "60-70%", "Kod AI; test Adobe ichida"),
        ("After Effects CEP plugin", "Qisman", "55-65%", "CEP murakkabroq"),
        ("300+ asset kontenti", "Yo'q", "0%", "Dizayn/video - inson"),
        ("Production deploy", "Qisman", "~50%", "Server va monitoring"),
    ]

    pdf.set_font("Helvetica", "B", 8)
    col_w = [52, 14, 14, 50]
    headers = ["Qism", "AI?", "Daraja", "Izoh"]
    for i, h in enumerate(headers):
        pdf.cell(col_w[i], 7, h, border=1, align="C")
    pdf.ln()

    pdf.set_font("Helvetica", "", 8)
    for row in table_rows:
        for i, cell in enumerate(row):
            pdf.cell(col_w[i], 7, cell[:28], border=1)
        pdf.ln()

    pdf.set_x(pdf.l_margin)
    pdf.ln(4)
    pdf.section_title("AI nima qila oladi?")
    for item in [
        "Butun web stack: landing, pricing, foydalanuvchi kabineti, admin panel",
        "Backend API: foydalanuvchi, obuna, asset qidiruv, filter, pagination, download",
        "Stripe: Checkout, billing portal, webhook, obuna to'xtasa access yopish",
        "S3 API: signed upload/download URL, CDN integratsiya kodi",
        "Premiere Pro UXP plugin: search, filter, preview, download, obuna tekshiruv",
        "After Effects CEP plugin: dastlabki ishchi versiya (scaffold)",
        "Dokumentatsiya, README, .env namunalari, loyiha strukturasi",
    ]:
        pdf.bullet(item)

    pdf.section_title("Siz (inson) nima qilishingiz kerak?")
    for item in [
        "Adobe Premiere Pro va After Effects ichida plugin test va bug fix",
        "Stripe hisob (UK kompaniya - Oceananimatsion Ltd), webhook secret, narxlar",
        "AWS S3 / DigitalOcean bucket, Cloudflare DNS va CDN sozlash",
        "300+ motion template, transition, VFX, LUT kontentini yaratish yoki yuklash",
        "Production server, monitoring, qonuniy va shartnoma masalalari",
        "Brifing so'ragan muddat va narx taklifi (biznes qaror)",
        "Adobe Exchange ga plugin nashr qilish (review oylar davom etishi mumkin)",
    ]:
        pdf.bullet(item)

    pdf.add_page()
    pdf.section_title("Tavsiya etilgan bosqichlar")
    pdf.body_text(
        "Bosqich 1 - MVP: Premiere Pro plugin + Web + Stripe + S3 + Admin. "
        "After Effects plugin keyinroq (Adobe AE uchun UXP hali to'liq ochilmagan - brifingda ham aytilgan)."
    )
    pdf.body_text(
        "Bosqich 2: After Effects CEP plugin - ko'proq iteratsiya va test kerak."
    )
    pdf.body_text(
        "Bosqich 3: Admin va kontent kengaytirish, 5000+ asset, Adobe Exchange."
    )

    pdf.section_title("Brifingdagi 6 savolga javob (AI kontekstida)")
    qa = [
        ("1. UXP plugin tajribangiz bormi?", "AI UXP kodini yozadi; sizning tajribangiz Adobe testda ko'rinadi."),
        ("2. Stripe integratsiya qilganmisiz?", "AI integratsiya kodini yozadi; Stripe Dashboard sizda."),
        ("3. Next.js / React bilan ishlaysizmi?", "AI bu sohada juda kuchli - web qismi tez quriladi."),
        ("4. AWS S3 yoki CDN bilan tajribangiz?", "AI kod + config; bucket va DNS sizda."),
        ("5. Cursor ishlatamiz - qulay bo'ladi?", "Ha, bu loyiha Cursor uchun ideal (3-4x tezroq kod yozish)."),
        ("6. To'liq vaqt ishlaysizmi yoki qisman?", "Bu shaxsiy javob; AI o'rniga ishlay olmaydi."),
    ]
    for q, a in qa:
        pdf.set_x(pdf.l_margin)
        pdf.set_font("Helvetica", "B", 10)
        pdf.multi_cell(pdf.epw, 5.5, q)
        pdf.set_x(pdf.l_margin)
        pdf.set_font("Helvetica", "", 10)
        pdf.multi_cell(pdf.epw, 5.5, a)
        pdf.ln(2)

    pdf.section_title("Muddat taxmini (developer + Cursor AI)")
    pdf.body_text(
        "Faqat kod (AI yordamida): taxminan 4-8 hafta.\n"
        "To'liq MVP (kontent + Adobe test + deploy): odatda 3-5 oy (1 tajribali developer + sizning test va asset ishingiz)."
    )

    pdf.section_title("Xulosa")
    pdf.body_text(
        "Cursor AI sizning developer yordamchingiz sifatida brifingdagi texnik platformaning "
        "katta qismini qurishga qodir. Lekin loyiha \"tayyor mahsulot\" bo'lishi uchun Adobe sinovi, "
        "cloud hisoblar, kontent va biznes qarorlari sizda qoladi. Brifingga javob berishda: "
        "\"Texnik qism Cursor + developer bilan mumkin; MVP X oy, $Y\" deb aniq scope va bosqich "
        "ko'rsatish tavsiya etiladi."
    )

    pdf.ln(6)
    pdf.set_x(pdf.l_margin)
    pdf.set_font("Helvetica", "I", 9)
    pdf.set_text_color(100, 100, 100)
    pdf.multi_cell(
        pdf.epw,
        5,
        "Eslatma: Bu hujjat loyiha boshlanishidan oldin baho maqsadida tayyorlangan. "
        "Kod bazasi /Users/usmonov/Projects/creative-tools-saas da namuna sifatida mavjud, "
        "lekin ishga tushirish majburiy emas.",
    )

    pdf.output(OUTPUT)
    return OUTPUT


if __name__ == "__main__":
    path = build_pdf()
    print(f"PDF yaratildi: {path}")
