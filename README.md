# Laagje Warmte

Bestelsite voor 3D-prints van foto's, voor De Warmste Week. Klanten kiezen een formaat, laden een foto op en krijgen betaalgegevens met een persoonlijke mededeling. In het adminpaneel volg je de bestellingen op en download je per bestelling een zip om mee aan de slag te gaan in Meshy en Bambu Studio.

Het is gewone HTML, CSS en JavaScript: er is geen build-stap en geen framework. Het draait gratis op **GitHub Pages** en **Firebase** (Spark-plan).

| Pagina | Wat |
|---|---|
| `index.html` | De website: uitleg, bestelformulier en betaalgegevens na het bestellen |
| `admin.html` | Het adminpaneel: bestellingen, formaten en prijzen, export, instellingen |

## 1. Lokaal testen

```bash
node server.js
```

- Website: <http://localhost:8080>
- Adminpaneel: <http://localhost:8080/admin.html>, wachtwoord `admin`

Zolang `js/firebase-config.js` niet is ingevuld, draait alles in **lokale testmodus**: bestellingen en instellingen blijven enkel in die ene browser bewaard. Er staat dan een gele balk bovenaan. Dat wachtwoord `admin` geldt alleen in die testmodus.

## 2. Firebase instellen (eenmalig)

1. Ga naar <https://console.firebase.google.com> → **Add project**. Google Analytics mag uit.
2. **Build → Realtime Database → Create database**. Kies **Belgium (europe-west1)** en start in **locked mode**.
3. Open het tabblad **Rules**, plak de volledige inhoud van [`database.rules.json`](database.rules.json) en klik op **Publish**.
4. **Build → Authentication → Get started** en zet **Email/Password** aan.
5. Klik in Authentication op **Users → Add user** en maak het account van de beheerder aan.
6. Ga naar ⚙️ **Project settings → Your apps → Web (`</>`)** en registreer een app (Hosting hoeft niet). Kopieer de `firebaseConfig`-waarden naar [`js/firebase-config.js`](js/firebase-config.js). Kijk na dat `databaseURL` erbij staat.
7. Start de site en log in via `admin.html`. Je ziet dan je **UID**. Voeg in **Realtime Database → Data** toe: `admins` → `<jouw UID>` : `true`. Herlaad de pagina.
8. Ga in het adminpaneel naar **Instellingen** en vul het rekeningnummer, de begunstigde en de afzender in. Kijk onder **Formaten en prijzen** de formaten na.

> De waarden in `firebase-config.js` zijn niet geheim. De beveiliging zit in de databaseregels:
> - iedereen mag een bestelling aanmaken, maar niemand behalve de beheerder kan bestellingen of foto's lezen;
> - de prijs van een bestelling moet overeenkomen met de prijs van het gekozen formaat;
> - alleen de beheerder kan een bestelling op betaald zetten, aanpassen of verwijderen.

Deze regels zijn nog niet tegen een echte Firebase-database getest. Plaats na het instellen één testbestelling en zet ze op betaald om te zien dat alles doorkomt.

## 3. Online zetten op GitHub Pages

```bash
git init && git add . && git commit -m "Laagje Warmte"
git remote add origin https://github.com/<gebruiker>/<repo>.git
git push -u origin main
```

Ga op GitHub naar **Settings → Pages → Source: Deploy from a branch → `main` / root**. Voeg daarna `<gebruiker>.github.io` toe onder *Firebase → Authentication → Settings → Authorized domains*.

## Zo werkt het

**Voor de klant**

1. Formaat en kleur kiezen, foto opladen (jpg of png) en adres invullen. De kleuren (rood, oranje, geel, groen, blauw, paars, wit, zwart) staan in `js/common.js` (`COLORS`); pas je die lijst aan, pas dan ook de regel `color` in `database.rules.json` aan.
2. Na het versturen verschijnen het bedrag, het rekeningnummer, de gestructureerde mededeling (`+++123/4567/89012+++`) en een QR-code voor de bank-app.
3. Er wordt geen e-mail verstuurd: de klant drukt de pagina af of bewaart ze als pdf.

**Voor de beheerder**

- **Bestellingen**: filter op alle, onbetaalde of betaalde bestellingen, zoek op naam, mededeling, e-mail of gemeente, en zet een bestelling met de schakelaar op betaald.
- **Zip per bestelling**: `bestelling-<naam>.zip` met `afbeelding-<naam>.jpg` (of `.png`), `bestand-<naam>.pdf` (bestelbon) en `label-<naam>.pdf` (verzendlabel van 100 × 150 mm).
- **Formaten en prijzen**: formaten toevoegen, aanpassen, verbergen, verwijderen en van volgorde wisselen.
- **Exporteren**: alle, onbetaalde of betaalde bestellingen als Excel- of CSV-bestand.
- **Instellingen**: formulier open of dicht, betaalgegevens, afzender op het label, contactadres.

## Goed om te weten

- **Foto's staan in de database**, niet in bestandsopslag (die is niet gratis). Een foto groter dan ongeveer 700 kB wordt daarom in de browser van de klant verkleind tot maximaal 1600 pixels en als jpg bewaard. Kleinere bestanden blijven ongewijzigd.
- **Gratis limieten**: 1 GB opslag en 10 GB downloads per maand. Dat is goed voor ruwweg 1000 bestellingen. Verwijder afgewerkte bestellingen als je in de buurt komt.
- **Twee klanten met dezelfde naam** krijgen een zip met dezelfde bestandsnaam. De mededeling staat wel in de bestelbon en op het label.
- **Betalingen** worden niet automatisch herkend: je vergelijkt de mededelingen op je rekeninguittreksel met de lijst van onbetaalde bestellingen.
- **De naam en teksten van de site** staan in `js/common.js` (`BRAND`) en `js/shop.js`.

## Mappen

| Pad | Wat |
|---|---|
| `js/store.js` | Kiest tussen Firebase (`store-firebase.js`) en de lokale testmodus (`store-local.js`) |
| `js/shop.js` | De website en het bestelformulier |
| `js/admin.js` | Het adminpaneel |
| `js/docs.js` | Bestelbon, verzendlabel, zip en export |
| `js/image.js` | Foto's verkleinen voor het versturen |
| `vendor/` | JSZip, jsPDF en qrcode-generator (lokaal, zodat er geen CDN nodig is) |
