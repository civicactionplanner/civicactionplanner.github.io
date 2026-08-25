# Firebase console setup (owner only, once)

The owner does these steps in the browser; nothing here requires a credit card, and the
free (Spark) plan is enough. The web config produced in step (d) is public by design —
it identifies the project, it is not a secret, and it is committed to the repository.
Never create, download, or commit a service account key; nothing in this app needs one.

a. Go to console.firebase.google.com → **Add project** → name it `civic-action-planner`
   → turn **Google Analytics off** → Create project.
b. **Build → Authentication → Get started → Sign-in method → Google → Enable**,
   choose the support email, **Save**.
c. **Build → Firestore Database → Create database → production mode**,
   location `nam5` (or `us-east1`) → Enable.
d. **Project settings (gear) → Your apps → Web app (</>)**, register the app as
   `planner` (no hosting needed), and copy the `firebaseConfig` object.
e. **Authentication → Settings → Authorized domains** → add
   `danielllobetv-a11y.github.io` (`localhost` is already there).
f. **Firestore Database → Rules** → paste the contents of `firestore.rules` from this
   repository → **Publish**. (Or run `bash scripts/rules-deploy.sh` if you have
   firebase-tools set up.)

Then paste the `firebaseConfig` object into `data/firebase-config.json` as plain JSON
(quote the keys), rebuild with `npm run build`, test, and push.

To undo everything later: delete the Firebase project from Project settings; the app
falls back to device-only saving the moment `data/firebase-config.json` is `{}` again.
