# Novi Subtitles — Web App (Phase 1: කොටස 1 – 4)

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
- ⏱ Minutes credit system: (plan එකේ මාසික විනාඩි) + (credits)

### කොටස 2 (අලුත්)
- 🎬 **Video upload** — 10MB කෑලි විදිහට Cloudflare R2 එකට, progress bar එක්ක (network error ආවොත් auto retry)
- ✨ **Subtitles හදන්න** — audio එක browser එකේම වෙන් කරලා (video එක ආයේ upload වෙන්නේ නෑ), දිග videos නිහඬ තැන්වලින් විනාඩි 5 කෑලිවලට කපලා ElevenLabs (scribe_v3 → fail නම් scribe_v2) එකට යවනවා
  - Credits අඩු වෙන්නේ server එක audio එකේ දිග ගණන් කරලා (browser එක කියන දිග විශ්වාස කරන්නේ නෑ); fail වුණොත් ආපහු එනවා
- 👀 Video එක උඩ subtitles preview (කියවෙන වචනය කහ පාටින්), වචනයක් click කළොත් ඒ තැනට යනවා
- ⬇ **SRT download**
- ⚙️ **Settings** — Premium users ලගේ ElevenLabs key එක (AES-GCM encrypt කරලා), password වෙනස් කිරීම

### කොටස 3 — Editor (අලුත්)
- ✏️ **Text edit** — line එකක් click කරලා text වෙනස් කරන්න. **Helakuru වගේ Singlish** (`mama gedhara yanawa` + space → `මම ගෙදර යනව`), suggestions bar එක (`යනවා`, `ට/ත`, `ද/ඩ`...), Ctrl + Space → English / සිංහල
- ✂ Split / ⤵ Merge / 🗑 Delete lines, Start / End timing ±0.1s
- 🎨 **Style** — Templates 5ක් (TikTok Bold, Clean White, Karaoke, News Box, Neon Glow) + හැම දේම වෙනස් කරන්න පුළුවන්:
  සිංහල font 5 / English font 12, size, සිංහල අකුරු size, thickness, letter spacing, line height, UPPERCASE,
  පාට, gradient, outline, shadow, glow, background box, කියවෙන වචනය highlight (color / scale / box / underline),
  animations (fade, pop, slide, bounce, typewriter, වචනෙන් වචනෙ), position (video එක උඩ ✥ drag කරන්න), line එකකට වචන / අකුරු ගණන
- ↶ Undo / ↷ Redo (Ctrl + Z / Ctrl + Y), 💾 auto save (තත්පර 1.2න්)

### කොටස 4 — Export (අලුත්)
- 🎬 **MP4 export** — Subtitles video එකට burn කරලා MP4 එකක් (H.264 + AAC). Render වෙන්නේ user ගේ browser එකේම (server වියදමක් නෑ)
  - Quality / watermark plan එක අනුව (Admin → Plans)
  - Chrome / Edge අලුත් version එකක් ඕනේ. Render වෙද්දී tab එක open කරලා තියන්න
- 📄 SRT / VTT download (edit කරපු text එකෙන්)

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
**Local settings file එක (එක පාරයි):**
```
copy .dev.vars.example .dev.vars
```
- `ELEVENLABS_MOCK=1` තියෙනකම් ඇත්ත ElevenLabs එකට යන්නේ නෑ — ව්‍යාජ subtitles එනවා (credits වැය නොකර test කරන්න)
- ඇත්ත සිංහල subtitles බලන්න: `notepad .dev.vars` → `ELEVENLABS_API_KEY=` එකට ඔයාගේ key එක දාලා, `ELEVENLABS_MOCK=0` කරන්න

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

### 3.5 Video storage (R2) සහ secrets
```
npx wrangler r2 bucket create novi-subtitles-videos
```
(R2 පළවෙනි පාර නම් Cloudflare dashboard → **R2** එකට ගිහින් enable කරන්න ඕනේ වෙන්න පුළුවන් — free ප්‍රමාණයක් තියෙනවා, ඒත් card එකක් ඉල්ලන්න පුළුවන්.)

අපේ ElevenLabs key එක (Basic/Standard plans වලට):
```
npx wrangler secret put ELEVENLABS_API_KEY
```
→ key එක paste කරලා Enter (පේන්නේ නෑ, ඒක සාමාන්‍යයි)

Premium keys encrypt කරන secret එක — මුලින්ම random එකක් හදන්න:
```
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```
ඒක copy කරලා:
```
npx wrangler secret put KEY_ENCRYPTION_SECRET
```
→ paste → Enter. ⚠️ මේක පස්සේ වෙනස් කළොත් save කරපු Premium keys ආයේ දාන්න වෙනවා.

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
npm run db:migrate:remote
npm run deploy
```
(`db:migrate:remote` එක අලුත් migrations තියෙනවා නම් විතරයි මොනවා හරි කරන්නේ — හැම පාරම ගැහුවට කමක් නෑ)

Admin panel → Overview එකේ **ElevenLabs key / Storage / Encryption** හරියට set වෙලාද කියලා පේනවා.

---

## 🌐 C. ඔයාගේ domain එක (optional)
`subtitles.novitechwa.com` වගේ එකක් දාන්න:
Cloudflare dashboard → **Workers & Pages** → **novi-subtitles** → **Settings** → **Domains & Routes** → **Add** → **Custom domain** → `subtitles.novitechwa.com` → **Add domain**

---

## 🎬 Remotion license (MP4 export)
MP4 export එකට Remotion කියන library එක පාවිච්චි කරනවා. ඒකේ license එක:
- **සේවකයෝ 3 දෙනෙක් හෝ අඩු company** → නොමිලේ. `wrangler.jsonc` එකේ `"REMOTION_LICENSE_KEY": "free-license"` තියන්න.
- **3ට වඩා වැඩි** → remotion.pro එකෙන් "Automators" license එක ගන්න (render එකකට $0.01, අවම $100/මාසෙට). ලැබෙන key එක `REMOTION_LICENSE_KEY` එකට දාන්න.
- විස්තර: https://www.remotion.dev/docs/license

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
├── worker/          ← Server (API): index.js (routes), auth.js (login), credits.js (විනාඩි system),
│                       projects.js (upload/subtitles), engines/ (ElevenLabs, mock — පස්සේ Whisper), secrets.js, wav.js
├── src/             ← Website (React): pages/, components/, lib/ (audio, subtitles),
│                       editor/ (Editor, Singlish, styles, fonts, MP4 export)
├── migrations/      ← Database tables
├── test/            ← Tests
└── wrangler.jsonc   ← Cloudflare settings
```
