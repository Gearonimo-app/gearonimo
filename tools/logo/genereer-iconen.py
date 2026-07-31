#!/usr/bin/env python3
"""Maakt alle app-iconen uit het bronlogo.

Het bronlogo (`gearonimo-logo.jpg`) is een JPEG op een witte achtergrond met
het woordmerk eronder. Voor app-iconen hebben we iets anders nodig:

* een transparante achtergrond -- JPEG kan dat niet, en een wit blok in je
  appdrawer of op een gekleurd splashscreen ziet er niet uit;
* alleen het beeldmerk (karabiner + vinkje), zonder woordmerk. Op 48px is
  "Gearonimo" toch onleesbaar en het maakt het beeldmerk alleen maar kleiner;
* vierkant, in de maten die Android en iOS echt opvragen.

Draaien (Pillow is de enige afhankelijkheid, staat niet in package.json omdat
dit geen buildstap is maar handwerk bij een nieuw logo):

    pip install pillow
    python3 tools/logo/genereer-iconen.py

Schrijft naar apps/inspector/public/icons/ en apps/customer/public/icons/.
"""
from collections import deque
from pathlib import Path

from PIL import Image

WORTEL = Path(__file__).resolve().parents[2]
HIER = Path(__file__).resolve().parent
BRON = HIER / "gearonimo-logo.jpg"

# De keurmeester-app is de PWA en heeft de hele set nodig. De klant-app draait
# in de browser onder /portal/ en heeft alleen een favicon en een icoon voor
# "zet op beginscherm" nodig.
INSPECTOR = WORTEL / "apps/inspector/public/icons"
KLANT = WORTEL / "apps/customer/public/icons"

# Boven deze waarde (laagste RGB-kanaal) telt een pixel als achtergrondwit.
# Ruim onder 255 omdat JPEG-compressie lichte ruis rond de contouren achterlaat.
WIT = 226

# Uitsnedes in het bronbestand van 1024x1024. Het woordmerk begint op y=796
# (de kleine karabiner die als G dient) en de letters op y=876; de grote
# karabiner eindigt op y=849. Die overlap is de reden dat het beeldmerk links
# op x=230 wordt afgesneden: daar links zit alleen woordmerk.
UITSNEDE_VOLLEDIG = (120, 70, 958, 985)
UITSNEDE_MERK = (230, 70, 958, 853)


def wit_weg(im):
    """Maakt de witte achtergrond transparant, vanaf de rand naar binnen.

    Bewust een vulling vanaf de rand en niet "alle witte pixels weg": de
    glansplekken op de karabiner zijn ook bijna wit, maar die zitten ingesloten
    door groen en blijven zo staan. De open beugel laat de vulling wel de
    binnenkant van de karabiner bereiken, en dat is precies de bedoeling.
    """
    im = im.convert("RGBA")
    w, h = im.size
    px = im.load()
    achtergrond = bytearray(w * h)
    q = deque()

    def zet(x, y):
        i = y * w + x
        if achtergrond[i]:
            return
        r, g, b, _ = px[x, y]
        if min(r, g, b) < WIT:
            return
        achtergrond[i] = 1
        q.append((x, y))

    for x in range(w):
        zet(x, 0)
        zet(x, h - 1)
    for y in range(h):
        zet(0, y)
        zet(w - 1, y)
    while q:
        x, y = q.popleft()
        if x > 0:
            zet(x - 1, y)
        if x < w - 1:
            zet(x + 1, y)
        if y > 0:
            zet(x, y - 1)
        if y < h - 1:
            zet(x, y + 1)

    for y in range(h):
        for x in range(w):
            if achtergrond[y * w + x]:
                px[x, y] = (255, 255, 255, 0)
    return im


def losse_vlekken_weg(im, drempel=0.002):
    """Gooit losse stukjes weg die kleiner zijn dan `drempel` x het grootste stuk.

    Nodig voor het beeldmerk: de uitsnede pakt net de bovenste pixelrijen van de
    i-punt van "Gearonimo" mee. Niet gebruiken op het volledige logo -- daar
    zijn losse stukjes gewoon letters.
    """
    w, h = im.size
    px = im.load()
    label = [0] * (w * h)
    nummer = 0
    vlekken = []
    for sy in range(h):
        for sx in range(w):
            if label[sy * w + sx] or px[sx, sy][3] == 0:
                continue
            nummer += 1
            label[sy * w + sx] = nummer
            pixels = []
            q = deque([(sx, sy)])
            while q:
                x, y = q.popleft()
                pixels.append((x, y))
                for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                    nx, ny = x + dx, y + dy
                    if 0 <= nx < w and 0 <= ny < h:
                        j = ny * w + nx
                        if not label[j] and px[nx, ny][3] != 0:
                            label[j] = nummer
                            q.append((nx, ny))
            vlekken.append(pixels)

    grootste = max(len(p) for p in vlekken)
    for pixels in vlekken:
        if len(pixels) < grootste * drempel:
            for x, y in pixels:
                px[x, y] = (255, 255, 255, 0)
    return im


def vierkant(merk, maat, marge, achtergrond=None):
    """Schaalt het beeldmerk in een vierkant canvas met `marge` lucht rondom."""
    bw, bh = merk.size
    ruimte = maat * (1 - 2 * marge)
    schaal = min(ruimte / bw, ruimte / bh)
    klein = merk.resize((max(1, round(bw * schaal)), max(1, round(bh * schaal))), Image.LANCZOS)
    canvas = Image.new("RGBA", (maat, maat), achtergrond or (255, 255, 255, 0))
    canvas.paste(klein, ((maat - klein.width) // 2, (maat - klein.height) // 2), klein)
    return canvas


def bewaar(im, naam, mappen):
    """Slaat op als 256-kleuren-PNG: visueel gelijk, ~40% kleiner in de cache."""
    klein = im.quantize(colors=256, method=Image.FASTOCTREE).convert("RGBA")
    for map_ in mappen:
        map_.mkdir(parents=True, exist_ok=True)
        klein.save(map_ / naam, optimize=True)
    plekken = ", ".join(str((m / naam).relative_to(WORTEL)) for m in mappen)
    print(f"  {im.size[0]}x{im.size[1]}  {plekken}")


def main():
    bron = Image.open(BRON).convert("RGB")

    merk = losse_vlekken_weg(wit_weg(bron.crop(UITSNEDE_MERK)))
    merk = merk.crop(merk.getbbox())

    # Doorzichtig, met een beetje lucht: hier maakt Chrome het splashscreen mee.
    bewaar(vierkant(merk, 192, marge=0.05), "icon-192.png", [INSPECTOR])
    bewaar(vierkant(merk, 512, marge=0.05), "icon-512.png", [INSPECTOR])
    # Maskable: Android snijdt hier zelf een vorm uit, dus dekkende achtergrond
    # en het beeld binnen de veilige zone (de binnenste 80%).
    bewaar(vierkant(merk, 512, marge=0.14, achtergrond=(255, 255, 255, 255)),
           "icon-maskable-512.png", [INSPECTOR])
    # iOS negeert transparantie en maakt die zwart, dus hier ook dekkend.
    bewaar(vierkant(merk, 180, marge=0.08, achtergrond=(255, 255, 255, 255)),
           "apple-touch-icon.png", [INSPECTOR, KLANT])
    bewaar(vierkant(merk, 64, marge=0.02), "favicon-64.png", [INSPECTOR, KLANT])

    # Het volledige logo met woordmerk, transparant. Blijft hier staan als
    # werkbestand -- nog niets in de app gebruikt het, dus het hoort niet in
    # een public-map en al helemaal niet in de offline cache.
    volledig = wit_weg(bron.crop(UITSNEDE_VOLLEDIG))
    volledig = volledig.crop(volledig.getbbox())
    volledig.quantize(colors=256, method=Image.FASTOCTREE).save(
        HIER / "gearonimo-logo-transparant.png", optimize=True)
    print(f"  {volledig.size[0]}x{volledig.size[1]}  tools/logo/gearonimo-logo-transparant.png")


if __name__ == "__main__":
    main()
