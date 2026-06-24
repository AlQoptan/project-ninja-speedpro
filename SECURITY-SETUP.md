# 🔐 Database security setup — SpeedPro

## Step 1 — Test if your database is open (30 seconds)
While **logged out**, open this in a browser:
```
https://ninja-system-30301-default-rtdb.firebaseio.com/ninja_data/admins.json
```
- ✅ **Secure** → you see `{ "error" : "Permission denied" }`
- 🔴 **Open** → you see real data (usernames/hashes). Fix it with Step 2 **now**.

## Step 2 — Apply the interim rules (closes public access)
1. Firebase Console → project **ninja-system-30301** → **Realtime Database** → **Rules** tab.
2. Replace everything with the contents of [`database.rules.json`](database.rules.json).
3. Click **Publish**.

These rules:
- Require an authenticated session (`auth != null`) for every read/write → blocks anonymous public `*.json` data dumps.
- Add `.indexOn` indexes for the queried nodes → faster queries + removes the console "add .indexOn" warnings.

This will **not** break the app: both the dashboard and the driver portal sign in via `signInAnonymously()` before any DB call.

## Step 3 (the real fix) — migrate to Firebase Email/Password Auth
⚠️ **Important honesty:** the interim rules stop *casual* access, but **not a determined attacker**. Because login happens **in the browser** (the app reads `ninja_data/admins` and compares password hashes), the rules must allow reading `admins` — and anyone who loads the app gets an anonymous token, so they can read it too.

True security requires moving authentication **off the client**:
- Create a Firebase **Email/Password** user per admin/supervisor.
- Verify the password with Firebase (server-side), not by reading hashes in the browser.
- Store the role as a **custom claim** (or in a node only that user can read), and write rules like:
  ```
  ".read": "auth != null",
  "ninja_data/admins": { ".read": "auth.token.role === 'super_admin'" }
  ```

This is an architectural change to the login flow (`checkLogin` in `app.js`). It's the proper fix — ask and I'll plan + implement it carefully (with a fallback so no one gets locked out).
