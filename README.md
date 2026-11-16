# Phase 0 — සිංහල Speech-to-Text Engine Test (Node.js)

මේ tool එකෙන් ඔයාගේ videos, සිංහල support කරන AI engines කිහිපයකට යවලා
**වඩාත්ම නිවැරදි engine එක මොකක්ද** කියලා report එකකින් පෙන්වනවා.
මෙහි තියෙන engine code එක (`src/engines/`) Phase 1 SaaS system එකේ කෙලින්ම reuse කරනවා.

| Engine | සිංහල | Word timing |
|---|---|---|
| ElevenLabs Scribe v2 | ✅ (`sin`) | ✅ හැම වචනයකටම |
| ElevenLabs Scribe v3 | ✅ (`sin`) | ✅ හැම වචනයකටම |
| Google Chirp 2 | ✅ (`si-LK`, asia-southeast1) | ✅ |
| Gemini (general model) | ✅ prompt එකකින් | ⚠️ ආසන්න වශයෙන් විතරයි |

> AssemblyAI, Google Chirp 3 සහ Gemini 3.5 Transcribe දැනට සිංහල support කරන්නේ නැති නිසා ඒවා test එකට දාලා නෑ.

---

## 🅐 මූලික setup එක (එක පාරයි)

### පියවර 1: Node.js සහ FFmpeg check කරන්න
Start menu එකේ `cmd` type කරලා **Command Prompt** open කරන්න:
```
node --version
ffmpeg -version
```
- `node` එකට **v20 හෝ ඊට වැඩි** අංකයක් එන්න ඕනේ (Novitech නිසා දැනටමත් install කරලා ඇති).
  නැත්නම්: https://nodejs.org → **LTS** version එක install කරන්න.
- `ffmpeg` එකට error එකක් ආවොත්:
  ```
  winget install Gyan.FFmpeg
  ```
  ඉවර වුණාම **Command Prompt එක close කරලා ආයේ open කරන්න.**

### පියවර 2: Zip එක extract කරන්න
`subtitle-asr-test.zip` → right-click → **Extract All...** → `C:\Projects` දෙන්න.
Folder එක: `C:\Projects\subtitle-asr-test`

### පියවර 3: Folder එකේ Command Prompt open කරලා install කරන්න
File Explorer එකෙන් folder එක open කරලා, උඩ address bar එකේ `cmd` type කරලා Enter කරන්න. ඊට පස්සේ:
```
npm install
```

### පියවර 4: Keys දාන file එක (.env) හදන්න
```
copy .env.example .env
notepad .env
```
Notepad එක open කරලා තියන්න.

### පියවර 5: ElevenLabs API key එක
1. https://elevenlabs.io → **Sign up** (Google account එකෙන් ලේසියි)
2. වම් පැත්තේ පහළ profile එක → **API Keys** → **Create API Key**
3. Permissions වල **Speech to Text** on කරලා Create කරන්න
4. Key එක copy කරලා Notepad එකේ:
   ```
   ELEVENLABS_API_KEY=sk_xxxxxxxxxxxxxxxx
   ```

### පියවර 6: Gemini API key එක
1. https://aistudio.google.com/apikey → **Create API key**
2. Notepad එකේ:
   ```
   GEMINI_API_KEY=AIzaxxxxxxxxxxxx
   ```
3. **Ctrl + S** ගහලා save කරලා Notepad එක close කරන්න.

⚠️ Keys කාටවත් දෙන්න එපා, chat/WhatsApp වලවත් දාන්න එපා. `.env` file එක GitHub එකට යන්නේ නෑ (`.gitignore` එකේ තියෙනවා).

### පියවර 7: Video එක දාන්න
```
mkdir videos
```
`Ayu_1.mp4` එක `C:\Projects\subtitle-asr-test\videos` folder එකට copy කරන්න.

### පියවර 8: Reference text එක (accuracy මනින්න — optional)
Ayu_1 එකේ voice script එක ඔයා ළඟ තියෙනවා නම්:
```
notepad reference.txt
```
**Yes** දීලා script එක paste කරලා save කරන්න. නැත්නම් මේ පියවර skip කරන්න.

### පියවර 9: Test එක run කරන්න 🚀
```
node run-test.js videos\Ayu_1.mp4 --reference reference.txt
```
(Reference එක නැත්නම් `--reference reference.txt` කොටස අයින් කරන්න.)

`.env` එකේ key තියෙන engines විතරක් auto run වෙනවා. විනාඩි 1–3ක් යනවා.

### පියවර 10: Report එක බලන්න
```
start results\Ayu_1\report.html
```
- **Table එක** — හොඳම engine එකට ⭐
- **Video එක** — දකුණු පැත්තෙන් engine එකක් තෝරලා play කරන්න, කියවෙන වචනය කහ පාටින් එනවා
- **Text එක** — වැරදි වචන රතු/කොළ පාටින්

හැම engine එකකටම `.srt` subtitle file එකකුත් `results\Ayu_1` folder එකේ හැදෙනවා.

---

## 🔁 ඊළඟ පාර
Folder එකේ address bar එකේ `cmd` → අලුත් video එක `videos` එකට දාලා:
```
node run-test.js videos\අලුත්_video.mp4
```
තෝරපු engines විතරක්: `--engines elevenlabs_v2 gemini`
(තියෙන්නේ: `elevenlabs_v2`, `elevenlabs_v3`, `google`, `gemini`)

---

## 🅑 Google Cloud (පස්සේ, optional)

Google Chirp 2 engine එකටයි, Ayu_1 එකේ subtitles auto කියවන OCR එකටයි මේක ඕනේ.

1. https://console.cloud.google.com → **New Project** → නම `novi-subtitles` → **Create**
2. Billing setup කරන්න (අලුත් accounts වලට free trial credits ලැබෙනවා)
3. උඩ search bar එකේ **"Cloud Speech-to-Text API"** → **Enable**. **"Cloud Vision API"** එකත් එහෙමම **Enable**.
4. https://cloud.google.com/sdk/docs/install → **Google Cloud CLI** Windows installer එක install කරන්න
5. අලුත් Command Prompt එකක:
   ```
   gcloud auth application-default login
   ```
   Browser එකේ login වෙලා **Allow** කරන්න.
6. Project ID එක (`novi-subtitles-123456` වගේ) `notepad .env` එකේ:
   ```
   GOOGLE_CLOUD_PROJECT=novi-subtitles-123456
   ```
7. දැන් OCR එකෙන් reference හදලා, engines ඔක්කොම එක්ක run කරන්න පුළුවන්:
   ```
   node ocr-reference.js videos\Ayu_1.mp4
   notepad results\Ayu_1\reference_ocr.txt
   node run-test.js videos\Ayu_1.mp4 --reference results\Ayu_1\reference_ocr.txt
   ```
   OCR text එකේ වැරදි/product label අකුරු තියෙනවා නම් Notepad එකේ හදලා save කරලා ඊට පස්සේ test එක run කරන්න.

---

## 📤 ප්‍රතිඵල මට එවන්න
`results\<video නම>` folder එක zip කරලා (ඇතුළේ `audio` folder එක නැතුව) එවන්න.

## 🛠 ගැටලු ආවොත්
| Error | විසඳුම |
|---|---|
| `ffmpeg හම්බවුණේ නෑ` | FFmpeg install කරලා Command Prompt එක close කරලා ආයේ open කරන්න |
| `HTTP 401` (ElevenLabs) | Key එක වැරදියි, නැත්නම් Speech to Text permission එක නෑ |
| `Google login නෑ` | 🅑 කොටසේ පියවර 5 කරන්න |
| `PERMISSION_DENIED` (Google) | Speech-to-Text API / Vision API enable කරලා නෑ |
| Gemini `not found` | `.env` එකේ `GEMINI_MODEL=` අලුත් model නමකට වෙනස් කරන්න |
| `Cannot find package` | Folder එක ඇතුළේ `npm install` කරලා නෑ |
