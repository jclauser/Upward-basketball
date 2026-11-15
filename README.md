# Volunteer application (test site)

A static, multi-step volunteer form. It runs on GitHub Pages and sends each submission to a Google Apps Script, which saves it to a Google Sheet and a Drive folder.

## Files
- `index.html`, `styles.css`, `app.js`: the site
- `config.js`: name shown at the top, and the backend URL
- `apps-script/Code.gs`: the Google backend

## Connect the backend (about 5 minutes)
1. Go to https://script.google.com and click **New project**.
2. Delete the sample code, paste in all of `apps-script/Code.gs`, and click **Save**.
3. Choose the function **setup** in the toolbar and click **Run**. Approve the permissions. This creates the Sheet and the Drive folder (both named "Volunteer Applications (test)") and prints their links in the log.
4. Click **Deploy > New deployment > Web app**. Set **Execute as: Me** and **Who has access: Anyone**. Click Deploy and copy the **Web app URL** (it ends in `/exec`).
5. Paste that URL into `ENDPOINT_URL` in `config.js` and commit the change to GitHub. The site updates in about a minute.

If you change `Code.gs` later, use **Deploy > Manage deployments > Edit > New version**, or the site will keep using the old code.

## Test mode
With `ENDPOINT_URL` empty, the site works end to end but shows the data on screen instead of saving it.

## Put the church name back later
Change `ORG_NAME` in `config.js`. Replace the `[LOGO]` circle in `index.html` with an image.

## Notes
- The page has `noindex` so search engines skip it while testing.
- A hidden field and a minimum fill time catch most bots. Add a CAPTCHA before real use.
- Do not commit submissions or personal data to this repository. The repo should hold code only.
- Anyone who finds the web app URL can post to it, so treat the Sheet as untrusted input.
