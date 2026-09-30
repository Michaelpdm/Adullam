# Set up your order inbox (10 minutes, free)

1. Go to https://sheets.google.com and click **Blank spreadsheet**. Name it "Adullam Orders".
2. In the sheet, click **Extensions → Apps Script**.
3. Delete everything in the editor. Open `backend/Code.gs` from this folder, copy ALL of it, and paste it in. Click the save icon.
4. Click **Deploy → New deployment**. Click the gear next to "Select type" and choose **Web app**.
   - Description: Adullam inbox
   - Execute as: **Me**
   - Who has access: **Anyone**
   Click **Deploy**.
5. Google asks you to **Authorize access**. Choose your account. If it says "Google hasn't verified this app", click **Advanced → Go to (project name) (unsafe)**, then **Allow**.
   (It's your own script. It needs permission to write to your sheet and send you email.)
6. Copy the **Web app URL** (it starts with https://script.google.com/macros/s/...).
7. Paste that URL into `data.js` in the `sheetUrl` line, upload to GitHub, done.

Changed the script later? Use Deploy → Manage deployments → pencil → Version: New version → Deploy.
