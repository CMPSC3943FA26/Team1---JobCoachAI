# JobCoach AI Getting Started

This frontend is a static HTML, CSS, and JavaScript prototype. It does not currently have a `package.json`, bundler, or npm dev script.

## 1. Open the project

From PowerShell:

```powershell
Set-Location "C:\Users\Jared\JobCoachSoftdev\Team1---JobCoachAI"
```

## 2. Check the frontend files

```powershell
Get-ChildItem -Path frontend -Force
```

The required files are:

- `frontend/index.html`
- `frontend/styles.css`
- `frontend/app.js`

## 3. Run the frontend

Start a local static server from the project root:

```powershell
python -m http.server 4174 --directory frontend
```

Keep this terminal running. Stop the server with `Ctrl+C`.

Open the app in a browser:

```powershell
Start-Process "http://localhost:4174/?v=1#welcome"
```

Useful test URLs:

```text
http://localhost:4174/?v=1#welcome
http://localhost:4174/?v=1#tailor
http://localhost:4174/?v=1#parsed
```

Change the `v` query value after edits to force a fresh browser load.

## 4. Smoke-test the server

In a second PowerShell terminal:

```powershell
Invoke-WebRequest "http://localhost:4174/" | Select-Object StatusCode, Content
```

A successful server should return status code `200`.

## 5. Rebuild after changes

There is no compile step yet. Rebuild the prototype by restarting the static server if needed:

```powershell
Get-Process python -ErrorAction SilentlyContinue
python -m http.server 4174 --directory frontend
```

If port `4174` is already in use, use another port:

```powershell
python -m http.server 4175 --directory frontend
Start-Process "http://localhost:4175/?v=1#welcome"
```

## 6. Check changed files

```powershell
git diff --check
git status --short
```

`git diff --check` should finish without whitespace errors.

## 7. Manual test checklist

### Welcome

1. Open `#welcome`.
2. Confirm the title, email field, password field, Log in, Register, and guest actions are visible.
3. Confirm Log in, Register, and guest access route to `#tailor`.

### Tailor

1. Confirm `Create Resume` is visible at the top.
2. Confirm `Upload resume` opens a file picker.
3. Confirm selecting a file displays its filename.
4. Confirm `Create Resume` routes to `#parsed`.
5. Confirm the job title and job description fields are available.

### Parsed

1. Confirm user information is populated with first name, last name, phone, and email.
2. Confirm the professional summary, two experience entries, and five skills are populated.
3. Confirm each section can add and remove fields.
4. Confirm `Edit parsed resume` opens the full-document editor and imports the parsed values.
5. Confirm `Edit uploaded resume` is disabled until a resume is selected.
6. Confirm `Export DOCX` and `Export PDF` are visible.
7. Add enough editor content to trigger the one-page overflow warning.

## 8. Stop the server

Focus the terminal running the server and press:

```text
Ctrl+C
```

## Troubleshooting

- `npm run dev` is not available because this prototype has no `package.json`.
- If the browser shows an older version, change the `v` query value in the URL or use a hard refresh.
- If port `4174` is busy, use port `4175` or another available port.
