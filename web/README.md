# Novi Subtitles — Web App (Phase 1, කොටස 1: පදනම)

සිංහල සහ English auto subtitles SaaS එක. Cloudflare Workers + D1 database + React.

## මේ කොටසේ තියෙන දේවල්
- 🏠 Home page එක + plans (Basic / Standard / Premium)
- 🔐 Sign up, Login, Logout (passwords ආරක්ෂිතව hash කරලා)
- 📊 User dashboard: plan එක, ඉතුරු විනාඩි, credits ඉතිහාසය
- 🛠 Admin panel:
  - **Overview:** users ගණන, මේ මාසේ process කළ විනාඩි, ElevenLabs වියදම
  - **Users:** search, plan මාරු කිරීම, admin කිරීම, block කිරීම, **credits එකතු / අඩු කිරීම**
  - **Plans:** හැම plan එකකම engine, මාසික විනාඩි, video දිග, export quality, watermark, මිල වෙනස් කිරීම
  - **Settings:** Sign up bonus විනාඩි, sign up on/off
- ⏱ Minutes credit system: (plan එකේ මාසික විනාඩි) + (credits). Video upload එක එන්නේ ඊළඟ කොටසේ.

---

## 💻 A. ඔයාගේ computer එකේ run කරන්න (local)

Project folder එකේ Command Prompt එක open කරලා:
```
cd web
```
```
npm install
```
```
npm run db:migrate:local
```
```
npm run dev
```
Command Prompt එකේ පේන `http://localhost:5173` link එක Chrome එකේ open කරන්න.

- **මුලින්ම sign up වෙන කෙනා auto admin වෙනවා** (local එකේ විතරයි — deploy කරනකොට `ADMIN_EMAILS` දාන්න, පහළ බලන්න)
- නවත්වන්න: **Ctrl + C**
- ඊළඟ පාර: `cd web` → `npm run dev` විතරයි

---

## ☁️ B. Cloudflare එකට deploy කරන්න (internet එකට දාන්න)

### 1. Cloudflare එකට login වෙන්න
```
npx wrangler login
```
Browser එකේ Cloudflare page එකක් open වෙනවා → **Allow** click කරන්න.

### 2. Database එක හදන්න
```
npx wrangler d1 create novi-subtitles-db
```
- "Would you like Wrangler to add it on your behalf?" වගේ ඇහුවොත් → **No** (`n`) දෙන්න
- Output එකේ `"database_id": "xxxxxxxx-xxxx-..."` කියලා line එකක් එනවා → ඒ ID එක copy කරන්න

### 3. `wrangler.jsonc` එක හදන්න
```
notepad wrangler.jsonc
```
- `"database_id": "REPLACE_WITH_YOUR_D1_DATABASE_ID"` → copy කරපු ID එක දාන්න
- ⚠️ `"ADMIN_EMAILS": ""` → ඔයාගේ email එක දාන්න, උදා: `"ADMIN_EMAILS": "info@novitechwa.com"`
  (මේක නොදැම්මොත් ඔයාට කලින් වෙන කෙනෙක් sign up වුණොත් එයා admin වෙනවා!)
- **Ctrl + S** → close

### 4. Database tables හදන්න
```
npm run db:migrate:remote
```
"Ok to proceed?" ඇහුවොත් → **Yes** (`y`)

### 5. Deploy කරන්න
```
npm run deploy
```
අන්තිමට `https://novi-subtitles.xxxx.workers.dev` වගේ link එකක් එනවා. ඒක තමයි ඔයාගේ website එක! 🎉

### 6. Admin account එක හදන්න
ඒ link එක open කරලා **3 වෙනි පියවරේ දාපු email එකෙන්ම** sign up වෙන්න → ඔයා admin.

### ඊළඟ පාර update එකක් deploy කරන්න
```
cd web
npm run deploy
```
(අලුත් `migrations` file එකක් ආවොත් ඊට කලින් `npm run db:migrate:remote`)

---

## 🌐 C. ඔයාගේ domain එක (optional)
`subtitles.novitechwa.com` වගේ එකක් දාන්න:
Cloudflare dashboard → **Workers & Pages** → **novi-subtitles** → **Settings** → **Domains & Routes** → **Add** → **Custom domain** → `subtitles.novitechwa.com` → **Add domain**

---

## ⚠️ Cloudflare free plan එක ගැන
Free plan එකේ request එකකට CPU කාලය 10ms විතරයි. Login/Sign up වෙලාවට **error 1102** ආවොත්:
- **හොඳම විසඳුම:** Workers Paid plan ($5/මාසෙට) — ඊළඟ කොටස් (video render) වලටත් ඒක ඕනේ
- **තාවකාලික විසඳුම:** `wrangler.jsonc` එකේ `"PASSWORD_ITERATIONS": "20000"` කරලා `npm run deploy`

---

## 🧪 Tests
```
npm test
```

## 📁 Files
```
web/
├── worker/          ← Server (API): index.js (routes), auth.js (login), credits.js (විනාඩි system)
├── src/             ← Website (React): pages/, components/
├── migrations/      ← Database tables
├── test/            ← Tests
└── wrangler.jsonc   ← Cloudflare settings
```
