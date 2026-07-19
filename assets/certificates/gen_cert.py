# -*- coding: utf-8 -*-
import qrcode, cairosvg, os
OUT="/sessions/hopeful-youthful-gates/mnt/outputs"
# ---- Thông tin chứng chỉ (có thể sửa) ----
C = dict(
    org="ASIAN RACING & JOCKEY COUNCIL",
    org_sub="International Licensing Authority  ·  Established 1987",
    org_addr="Regional Licensing Office — Ho Chi Minh City, Vietnam  ·  Headquarters: Hong Kong SAR",
    name="Nguyễn Quốc Hưng",
    licence_no="ARJC/PRO/2025/00842",
    verify_id="ARJC-PRO-2025-00842",
    klass="Licensed Professional Jockey",
    discipline="Thoroughbred Flat Racing",
    nationality="Vietnam",
    dob="16 June 2005",
    weight="72 kg",
    height="1.72 m",
    issue="15 January 2025",
    expiry="14 January 2028",
    off1_name="Dr. Harold M. Whitfield", off1_role="Secretary-General",
    off2_name="Catherine A. Loo", off2_role="Director of Licensing",
    verify_url="verify.arjc-council.org",
)
GOLD="#4B4636"; GOLDL="#BFB7A2"; INK="#1A160D"; SUB="#726A55"; CREAM="#FCFAF4"; PANEL="#F4F1EA"; LINE="#D8D2C4"; RED="#B01C1C"
SER="DejaVu Serif"; SERC="DejaVu Serif Condensed"; SANS="DejaVu Sans"; MONO="DejaVu Sans Mono"
def esc(s): return s.replace("&","&amp;").replace("<","&lt;").replace(">","&gt;")
def qr_svg(t,x,y,size,dark=INK):
    q=qrcode.QRCode(border=0,error_correction=qrcode.constants.ERROR_CORRECT_M);q.add_data(t);q.make(fit=True)
    m=q.get_matrix();n=len(m);c=size/n;o=[]
    for r in range(n):
        for k in range(n):
            if m[r][k]: o.append(f'<rect x="{x+k*c:.2f}" y="{y+r*c:.2f}" width="{c:.2f}" height="{c:.2f}" fill="{dark}"/>')
    return "".join(o)
W,H=595,842
s=[f'<svg xmlns="http://www.w3.org/2000/svg" width="{W}" height="{H}" viewBox="0 0 {W} {H}">']
s.append(f'<rect width="{W}" height="{H}" fill="{CREAM}"/>')
# viền vàng đôi
s.append(f'<rect x="26" y="26" width="{W-52}" height="{H-52}" fill="none" stroke="{GOLD}" stroke-width="3"/>')
s.append(f'<rect x="34" y="34" width="{W-68}" height="{H-68}" fill="none" stroke="{GOLDL}" stroke-width="1"/>')
# hoa văn góc (kim cương)
for cxg,cyg in [(34,34),(W-34,34),(34,H-34),(W-34,H-34)]:
    s.append(f'<path d="M{cxg-7} {cyg} L{cxg} {cyg-7} L{cxg+7} {cyg} L{cxg} {cyg+7} Z" fill="{GOLD}"/>')

cx=W/2
# ---- Con dấu / emblem ----
ey=104; R=46
s.append(f'<circle cx="{cx}" cy="{ey}" r="{R}" fill="none" stroke="{GOLD}" stroke-width="2.5"/>')
s.append(f'<circle cx="{cx}" cy="{ey}" r="{R-7}" fill="none" stroke="{GOLDL}" stroke-width="1"/>')
# ngôi sao trên
sy=ey-24
star=[]
import math
for i in range(5):
    a=-math.pi/2+i*2*math.pi/5; star.append(f"{cx+8*math.cos(a):.1f},{sy+8*math.sin(a):.1f}")
    a2=a+math.pi/5; star.append(f"{cx+3.4*math.cos(a2):.1f},{sy+3.4*math.sin(a2):.1f}")
s.append(f'<polygon points="{" ".join(star)}" fill="{GOLD}"/>')
# vòng nguyệt quế (2 cung)
s.append(f'<path d="M{cx-26} {ey+22} Q{cx-34} {ey} {cx-22} {ey-14}" fill="none" stroke="{GOLD}" stroke-width="2"/>')
s.append(f'<path d="M{cx+26} {ey+22} Q{cx+34} {ey} {cx+22} {ey-14}" fill="none" stroke="{GOLD}" stroke-width="2"/>')
for t in range(4):
    yy=ey-8+t*8
    s.append(f'<path d="M{cx-27+t*1.5} {yy} q-6 -2 -9 2" fill="none" stroke="{GOLD}" stroke-width="1.6"/>')
    s.append(f'<path d="M{cx+27-t*1.5} {yy} q6 -2 9 2" fill="none" stroke="{GOLD}" stroke-width="1.6"/>')
# monogram
s.append(f'<text x="{cx}" y="{ey+10}" text-anchor="middle" font-family="{SER}" font-weight="bold" font-size="22" fill="{GOLD}" letter-spacing="1">ARJC</text>')

# ---- Tên tổ chức ----
s.append(f'<text x="{cx}" y="{ey+74}" text-anchor="middle" font-family="{SER}" font-weight="bold" font-size="19" fill="{INK}" letter-spacing="2.5">{esc(C["org"])}</text>')
s.append(f'<text x="{cx}" y="{ey+92}" text-anchor="middle" font-family="{SANS}" font-size="9.5" fill="{SUB}" letter-spacing="1.5">{esc(C["org_sub"])}</text>')
s.append(f'<text x="{cx}" y="{ey+106}" text-anchor="middle" font-family="{SANS}" font-size="8" fill="{SUB}" letter-spacing="0.5">{esc(C["org_addr"])}</text>')
# divider
dy=ey+124
s.append(f'<line x1="120" y1="{dy}" x2="{cx-14}" y2="{dy}" stroke="{GOLD}" stroke-width="1"/>')
s.append(f'<line x1="{cx+14}" y1="{dy}" x2="{W-120}" y2="{dy}" stroke="{GOLD}" stroke-width="1"/>')
s.append(f'<path d="M{cx-8} {dy} L{cx} {dy-5} L{cx+8} {dy} L{cx} {dy+5} Z" fill="{GOLD}"/>')

# ---- Tiêu đề ----
ty=dy+44
s.append(f'<text x="{cx}" y="{ty}" text-anchor="middle" font-family="{SER}" font-weight="bold" font-size="27" fill="{INK}" letter-spacing="1">CERTIFICATE OF</text>')
s.append(f'<text x="{cx}" y="{ty+29}" text-anchor="middle" font-family="{SERC}" font-weight="bold" font-size="22" fill="{GOLD}" letter-spacing="2">PROFESSIONAL JOCKEY LICENCE</text>')

# ---- Thân ----
by=ty+66
s.append(f'<text x="{cx}" y="{by}" text-anchor="middle" font-family="{SER}" font-style="italic" font-size="13" fill="{SUB}">This is to certify that</text>')
s.append(f'<text x="{cx}" y="{by+40}" text-anchor="middle" font-family="{SER}" font-weight="bold" font-size="28" fill="{INK}">{esc(C["name"])}</text>')
s.append(f'<line x1="{cx-135}" y1="{by+50}" x2="{cx+135}" y2="{by+52}" stroke="{GOLDL}" stroke-width="1"/>')
body=["has fulfilled the professional, medical, and technical requirements",
      "established by the Asian Racing & Jockey Council, and is hereby granted",
      "the status of a Licensed Professional Jockey, authorised to compete in",
      "sanctioned Thoroughbred flat-racing events under the Council's jurisdiction."]
for i,ln in enumerate(body):
    s.append(f'<text x="{cx}" y="{by+78+i*19}" text-anchor="middle" font-family="{SER}" font-size="12.5" fill="{INK}">{esc(ln)}</text>')

# ---- Bảng thông tin ----
py=by+150; ph=140; pad=48
s.append(f'<rect x="{pad}" y="{py}" width="{W-2*pad}" height="{ph}" rx="4" fill="{PANEL}" stroke="{LINE}" stroke-width="1"/>')
rows=[("Licence No.",C["licence_no"]),("Category",C["klass"]),("Nationality",C["nationality"]),
      ("Date of Birth",C["dob"]),("Riding Discipline",C["discipline"]),("Declared Weight / Height",f'{C["weight"]}  /  {C["height"]}'),
      ("Date of Issue",C["issue"]),("Valid Until",C["expiry"])]
colx=[pad+22, cx+18]; 
lh=32; 
for i,(k,v) in enumerate(rows):
    col=i//4; rr=i%4
    x=colx[col]; yy=py+24+rr*lh
    s.append(f'<text x="{x}" y="{yy}" font-family="{SANS}" font-size="8" fill="{SUB}" letter-spacing="1.5">{esc(k.upper())}</text>')
    fam=MONO if k=="Licence No." else SER
    fs=11 if k=="Licence No." else 12.5
    s.append(f'<text x="{x}" y="{yy+15}" font-family="{fam}" font-weight="bold" font-size="{fs}" fill="{INK}">{esc(v)}</text>')
# đường chia cột
s.append(f'<line x1="{cx}" y1="{py+14}" x2="{cx}" y2="{py+ph-14}" stroke="{LINE}" stroke-width="1"/>')

# ---- Dòng xác thực (không dùng QR) ----
qy=py+ph+34
s.append(f'<text x="{cx}" y="{qy}" text-anchor="middle" font-family="{SANS}" font-size="8.5" fill="{SUB}" letter-spacing="2">VERIFY AUTHENTICITY  ·  {esc(C["verify_url"])}</text>')
s.append(f'<text x="{cx}" y="{qy+20}" text-anchor="middle" font-family="{MONO}" font-weight="bold" font-size="12" fill="{INK}" letter-spacing="1">{esc(C["verify_id"])}</text>')
s.append(f'<text x="{cx}" y="{qy+38}" text-anchor="middle" font-family="{SANS}" font-size="8" fill="{SUB}">This licence remains the property of the ARJC and must be produced upon request at any sanctioned event.</text>')

# ---- Chữ ký + dấu ----
gy=qy+100
# MỘC ĐỎ chính thức (nghiêng như con dấu thật)
import math as _m
sr=34; scy=gy-4
_star=[]
for _i in range(5):
    _a=-_m.pi/2+_i*2*_m.pi/5; _star.append(f"{cx+6*_m.cos(_a):.1f},{scy-12+6*_m.sin(_a):.1f}")
    _a2=_a+_m.pi/5; _star.append(f"{cx+2.5*_m.cos(_a2):.1f},{scy-12+2.5*_m.sin(_a2):.1f}")
s.append(f'<g transform="rotate(-9 {cx} {scy})" opacity="0.85">'
         f'<circle cx="{cx}" cy="{scy}" r="{sr}" fill="none" stroke="{RED}" stroke-width="2.6"/>'
         f'<circle cx="{cx}" cy="{scy}" r="{sr-6}" fill="none" stroke="{RED}" stroke-width="1"/>'
         f'<polygon points="{" ".join(_star)}" fill="{RED}"/>'
         f'<text x="{cx}" y="{scy+6}" text-anchor="middle" font-family="{SER}" font-weight="bold" font-size="13" fill="{RED}" letter-spacing="1">ARJC</text>'
         f'<text x="{cx}" y="{scy+18}" text-anchor="middle" font-family="{SANS}" font-size="5.5" fill="{RED}" letter-spacing="1.5">OFFICIAL SEAL</text></g>')
# hai chữ ký
lx=pad+66; rx=W-pad-66
for xx,nm,role in [(lx,C["off1_name"],C["off1_role"]),(rx,C["off2_name"],C["off2_role"])]:
    s.append(f'<text x="{xx}" y="{gy-2}" text-anchor="middle" font-family="{SER}" font-style="italic" font-size="13" fill="{INK}">{esc(nm)}</text>')
    s.append(f'<line x1="{xx-78}" y1="{gy+8}" x2="{xx+78}" y2="{gy+8}" stroke="{INK}" stroke-width="0.8"/>')
    s.append(f'<text x="{xx}" y="{gy+22}" text-anchor="middle" font-family="{SANS}" font-size="9" fill="{INK}" letter-spacing="1">{esc(role)}</text>')

s.append(f'<text x="{cx}" y="{gy+44}" text-anchor="middle" font-family="{SANS}" font-size="7.5" fill="{SUB}" letter-spacing="0.5">Issued electronically under ARJC Regulation 12(b). Digitally sealed — no handwritten signature required for validity.</text>')
s.append('</svg>')
svg="\n".join(s)
open(os.path.join(OUT,"jockey_certificate.svg"),"w").write(svg)
cairosvg.svg2pdf(bytestring=svg.encode("utf-8"),write_to=os.path.join(OUT,"Jockey_Certificate_NguyenQuocHung.pdf"))
cairosvg.svg2png(bytestring=svg.encode("utf-8"),write_to=os.path.join(OUT,"jockey_certificate_preview.png"),output_width=W*2,output_height=H*2)
print("cert done")
