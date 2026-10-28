# NFPC SC Mngt Support System

Static web app (no server needed). Open `index.html` in a browser, or publish the folder with GitHub Pages / any web host.

- `index.html` — page structure (HTML) and the list of CSS / JS files in load order
- `css/` — styles (01-base, 02-mobile, 03-pro-theme, 04-logistics-plan)
- `js/` — scripts, loaded in numeric order (NN-name.js); `38…46-mod-*` are the newer modules (switchboard, tab hiding, activity archive, stock movement, re-login, project progress, fleet, WHs movements FEFO, RMPM); `00-users-data.js` is the central user list (salted hashes); `50-logistics-ready-plan.js` is the Logistics ready-plan import; `99-boot.js` is the start-up and must stay last
- `build.py` — optional: bundles everything back into ONE html file (`python build.py` → `dist/SC_Mngt_single.html`)

Rules: all scripts are plain (classic) scripts sharing one global scope, exactly like the old single file, so keep the order in `index.html`. A new module is a new file `js/NN-mod-name.js` plus one `<script src>` line before `99-boot.js`.
