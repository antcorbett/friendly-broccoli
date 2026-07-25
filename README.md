# Cruise Bar Tab Tracker

A simple shared bar tab tracker for Joe, Antony, David, and Brad. Add a charge,
split it between whoever was there, and everyone sees live, synced balances
against a $975 budget ($243.75 fair share each). Works on any phone browser.

It's a plain web page (`index.html`) backed by a free Google Firebase
database, so data is stored in the cloud — not in your browser — and updates
live for everyone with the link.

## One-time setup (about 5 minutes)

You only need to do this once, before the trip.

### 1. Create a free Firebase project
1. Go to https://console.firebase.google.com and sign in with a Google account.
2. Click **Add project**, give it any name (e.g. `cruise-bar-tab`), and finish
   the wizard (you can skip Google Analytics).

### 2. Create a Firestore database
1. In the left sidebar, click **Build → Firestore Database**.
2. Click **Create database**.
3. Choose **Start in test mode** (this allows reads/writes for 30 days by
   default — see step 4 to extend that for your trip).
4. Pick any region and click **Enable**.

### 3. Register a web app to get your config keys
1. In the project, click the gear icon → **Project settings**.
2. Under "Your apps", click the **`</>`** (web) icon.
3. Give it a nickname and click **Register app**. Don't bother with hosting.
4. You'll see a `firebaseConfig` object with `apiKey`, `authDomain`, etc.
   Copy those values.
5. Open `firebase-config.js` in this project and paste your values in,
   replacing the placeholders.

### 4. Set security rules for the length of your trip
By default Firestore's "test mode" rules expire after 30 days, which is
plenty for a 9-day cruise, but it's worth setting an explicit rule so it
doesn't accidentally lock earlier:
1. In Firestore, go to the **Rules** tab.
2. Replace the rules with:
   ```
   rules_version = '2';
   service cloud.firestore {
     match /databases/{database}/documents {
       match /charges/{chargeId} {
         allow read, write: if request.time < timestamp.date(2026, 8, 10);
       }
     }
   }
   ```
   (Adjust the date to a few days after you're back, just as a buffer.)
3. Click **Publish**.

   Note: this leaves the tab tracker open to anyone with the link and no
   login — fine for a private trip with friends, not for anything sensitive.

### 5. Put the app online with a shareable link
The simplest option is GitHub Pages, using this same repo:
1. On GitHub, go to this repository's **Settings → Pages**.
2. Under "Build and deployment", set **Source** to "Deploy from a branch".
3. Choose the branch this code is on (or merge it to `main` first) and
   folder `/ (root)`, then **Save**.
4. GitHub will give you a URL like
   `https://<your-username>.github.io/<repo-name>/` within a minute or two.
   That's the link to share with Joe, Antony, David, and Brad.

Alternative: drag the project folder into https://app.netlify.com/drop or
import the repo into Vercel — both give a free public URL in under a minute.

## Using it during the trip

- **Add a Charge**: enter the pre-VAT amount, pick who paid, tick everyone
  the charge should be split between, and hit **Add Charge**. VAT (10%) is
  added automatically.
- **Balances**: each person's card shows total spent, their $243.75 fair
  share, remaining budget, and whether they're Over/Under/Even.
- **Transaction History**: every charge is logged with date, who paid, the
  total, and the per-person split. Tap **✕** to delete a mistaken entry.
- Everyone who opens the link sees the same live data — no refresh needed.

## Files

- `index.html` — the page structure
- `style.css` — styling (mobile-friendly, dark theme)
- `app.js` — app logic (calculations, rendering, Firestore sync)
- `firebase-config.js` — **edit this** with your own Firebase project keys
