/* ============================================================
   WHAT'S NEW — announces the new options / updates to every user, only for the areas that user can see
   at sign-in: a friendly message → "take me on the tour" (step by step, opens each updated area) → summary;
   or "remind me next login" / "don't show this again" (remembered per user and per update version).
   To announce a new update, add one entry to WN below (b = build number, v = view id of the area, t = title, d = text, pts = what to try, sel = element to point at).
   ============================================================ */
(function () {
  const Q = s => document.querySelector(s), esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const WN = [
    { b: 591, v: 'users', area: 'Users & Roles', ic: '👥', t: 'Two accounts with the same e-mail are no longer merged',
      d: 'When the users are read from the SharePoint list LoginUserList, a row was matched to an existing user by e-mail as well as by User_Name. Two different User_Names that share one e-mail (for example Gamal.M and Gamal.L, one e-mail, different Location ID) were therefore merged into one user and the second one never appeared. Now every User_Name of the list is its own user; the e-mail only joins an old local user that is not in the list. Press Refresh from SharePoint to bring in the missing accounts.',
      pts: ['Every User_Name = its own user', 'Refresh from SharePoint brings the missing ones'] },
    { b: 590, v: 'aem', area: 'Attendance by Employees', ic: '▾', t: 'OT source records: collapse / expand dates',
      d: 'In the source-records window of OT by period, click a date line to collapse or expand its records, or use Expand all dates / Collapse all dates.',
      pts: ['Click a date to collapse / expand', 'Expand all · Collapse all'] },
    { b: 589, v: 'aem', area: 'Attendance by Employees', ic: '🔎', t: 'OT source records: taller list, grouped by date, numbered',
      d: 'The source-records window opened by double-click in OT by period is now taller, the records are grouped by date (each date has a sub-total line) and every row is numbered. The numbering is also in the Excel / Print / E-mail output.',
      pts: ['Taller list', 'Grouped by date with sub-totals', '# row numbers'] },
    { b: 588, v: 'aem', area: 'Attendance by Employees', ic: '📅', t: 'OT by period: Working days column',
      d: 'The OT days column is now Working days: the number of different calendar days on which the group (warehouse, region …) had attendance in the period — not only the days that had overtime. A full month now shows the full number of working days for every warehouse that worked every day.',
      pts: ['Working days = days with attendance per group & period'] },
    { b: 587, v: 'aem', area: 'Attendance by Employees', ic: '📅', t: 'OT by period: OT days = working days of the period',
      d: 'In the OT by period table the OT days column now counts the different calendar days that had overtime in the period (per group, per period and in the total) instead of adding up the days of every employee.',
      pts: ['OT days = distinct days per period'] },
    { b: 586, v: 'aem', area: 'Attendance by Employees', ic: '⏱', t: 'OT by period: OT from actual working hours, less hours',
      d: 'OT by period now counts OT from the actual working hours: on a normal day Normal OT = actual hours − 9 (standard day, editable); on weekend (Friday / rest day) and public holidays every worked hour counts as OT. Days worked below the standard are shown in new columns Less hours h and Net OT h (OT − less); double-click Less hours to see those days. An "OT basis" selector switches back to the OT fields of the attendance file.',
      pts: ['Normal OT = actual hours − 9', 'Weekend / public = full hours', 'Less hours + Net OT columns', 'OT basis selector'] },
    { b: 585, v: 'aem', area: 'Attendance by Employees', ic: '🎯', t: 'OT by period: Compliance filter',
      d: 'The OT by period tab has a new Compliance filter (All / ✔ Within target / ✖ Over target / — No target). It applies to the table and to the E-mail, Excel and Print exports, and is remembered.',
      pts: ['Compliance filter', 'Applies to exports'] },
    { b: 584, v: 'aem', area: 'Attendance by Employees', ic: '🎯', t: 'OT by period: double-click for source records · OT target & compliance per warehouse',
      d: 'In the OT by period table, double-click a row (or a single figure such as Weekend OT h) to open the source attendance records behind it, with the total of that figure. Three new columns: Worked h, OT target % (read from WHs_tbl → WHs_OT_Prcntg, matched through the employee’s WHs_Link / WHs location) and Actual OT % of worked h, plus a Compliance column (✔ Within target / ✖ Over by x pts). For Region or Job role groups the target is weighted by worked hours. The new columns are also in E-mail, Excel and Print.',
      pts: ['Double-click row / figure → source records + total', 'OT target % from WHs_tbl', 'Compliance vs target'] },
    { b: 583, v: 'aem', area: 'Attendance by Employees', ic: '🔗', t: 'WHs_Link filter · hide the OT chart · E-mail / Excel / Print on the OT table',
      d: 'Attendance by Employees now has a WHs_Link filter (from Employees_tbl) and WHs_Link is also one of the "Group by" choices in OT by period. The OT-per-period chart has a ▾ Hide chart / ▸ Show chart button (remembered). The OT by period table has its own 📧 E-mail, 📊 Excel and 🖨 Print buttons above it.',
      pts: ['WHs_Link filter + Group by', '▾ Hide chart / ▸ Show chart', '📧 E-mail · 📊 Excel · 🖨 Print on the table'] },
    { b: 582, v: 'flr', area: 'Forklift Fleet — Condition', ic: '✔', t: 'Approve or reject the pending forklift requests from the dashboard',
      d: 'Every row of "Pending approval requests" now has ✔ Approve and ✖ Reject buttons. Approve records who approved and when (ApprovedBy_Sprvsr = Yes, ApprovedBy, ApprovalTimeStamp). Reject asks for the reason and saves it in Line_Remarks and the System Indication, the same as the mobile app does. The row leaves the list at once. If the request belongs to another approval staff, you are asked to confirm that you act on their behalf (administrators are not asked).',
      pts: ['✔ Approve · ✖ Reject on each pending request', 'Reject needs a reason', 'Confirms when approving for someone else'] },
    { b: 581, v: 'aem', area: 'Attendance by Employees', ic: '📆', t: 'New tab: OT by period — Normal / Weekend / Public OT',
      d: 'Attendance by Employees has a new tab "📆 OT by period". Choose how to group (Region, WHs Location, Job_Role — or any other Employees_tbl field, or no grouping) and the period (Daily, Weekly, Monthly, Quarterly, Yearly). Every period and group shows the staff with OT, OT days and the overtime split into Normal OT, Weekend OT (Friday + rest day), Public holiday OT and the total, with the weekend / public share. A stacked bar chart shows the trend per period; Print and Excel export the full table.',
      pts: ['Group by Region / WHs Location / Job_Role', 'Daily · Weekly · Monthly · Quarterly · Yearly', 'Normal · Weekend · Public holiday OT'] },
    { b: 580, v: 'flr', area: 'Forklift Fleet — Condition', ic: '⏳', t: 'Forklift dashboard: pending approval requests',
      d: 'The Forklift Fleet — Condition dashboard now shows the receive / park inspections that are still waiting for approval in FLOprt_CheckList_tbl (Approved By Supervisor = Not Yet): a new "Pending approval" card (count + how long the oldest has been waiting) and a "Pending approval requests" table — date, unit, type, reported by, approval staff, waiting time (red after 24 h) and the issues reported. Click the card or a row for the records / the unit history. It follows the Warehouse and Operator filters.',
      pts: ['Pending approval card', 'Pending approval requests table (oldest first)'] },
    { b: 579, v: 'home', area: 'All pages', ic: '🎨', t: 'Buttons: white text when the cursor is on a dark button',
      d: 'Buttons that turn dark navy under the mouse (e.g. "Choose fields…" in the edit forms and the buttons of the Download pop-up) kept their dark text, so the label disappeared. The label now turns white while the cursor is on the button — on every page.',
      pts: ['Readable labels on hover everywhere'] },
    { b: 578, v: 'lgtrips', area: 'Logistics › Open Trips', ic: '🪪', t: 'Open Trips: double-click a trip → card with Start · Cancel · Arrive',
      d: 'Double-click any trip row in Open Trips to open it as a card (driver, open time, pallets, unit, route, DN, material). The card has three buttons: ▶ Start (for trips not started yet), ✖ Cancel (reason required) and 🏁 Arrive (closes the trip; end ODO and destination optional). Buttons that do not apply to the trip\'s state are greyed out. Every action is written in the trip\'s Remarks.',
      pts: ['Double-click a row', '▶ Start · ✖ Cancel · 🏁 Arrive'] },
    { b: 577, v: 'lgtrips', area: 'Logistics › Open Trips', ic: '📅', t: 'Open Trips: date filter',
      d: 'Open Trips now has a Trip date filter (from – to) and a quick-range list (Today, Yesterday, Last 7 / 30 days, All dates). It works on every tab together with the search, region and open-time filters.',
      pts: ['Trip date from – to', 'Quick range: Today / Yesterday / Last 7 / 30 days'] },
    { b: 576, v: 'lgtrips', area: 'Logistics › Open Trips', ic: '🚛', t: 'New page: Open Trips — started trips + close / cancel',
      d: 'Logistics → "Open Trips (close trips)" lists every trip that was started and not closed yet (how long it has been open, unit, trailer, driver, from → to, DN), highlighted when open 12 h / 24 h or more. Close a trip (reason required, optional end ODO and destination), cancel it, or tick several and close / cancel them together. Other tabs: trips never started on past dates, and what was closed / cancelled in the last 7 days. Each action is written in the trip\'s Remarks and as the usual CLS- / CXL- log row.',
      pts: ['Logistics → Open Trips', '✔ Close / ✖ Cancel per trip or for a selection', 'Highlights trips open ≥ 12 h / 24 h'] },
    { b: 575, v: 'home', area: 'All pages', ic: '☰', t: 'Hide / show every section on every page',
      d: 'A new "☰ Sections" button in the top bar hides or shows ALL the sections of the page you are on in one click. The sub-sections inside the Warehouse, RMPM and other screens now also have their own ▾ Hide / ▸ Show button (the cards already had one). What you hide is remembered for you, page by page.',
      pts: ['☰ Sections → Hide all / Show all', '▾ Hide on each section heading'] },
    { b: 574, v: 'home', area: 'Data updates', ic: '☑', t: 'Data updates: the tick boxes now always respond',
      d: 'The ✔ Verify tick on each record, Hide verified, Include my own changes and "Show this pop-up when I sign in" now react on the click itself and keep working even when the browser storage is full (they are then kept for the session, with a notice).',
      pts: ['Tick a record to mark it verified', 'Show this pop-up when I sign in'] },
    { b: 573, v: 'md-rmi', area: 'Master data', ic: '⚖', t: 'RMPM items: UOM details + "without UOM list" filter',
      d: 'The RMPM items form now has the same ⚖ UOM details section as Inventory items — it lists the UoM rows of UOM_tbl for the item code (PC / CT / PLT … × base quantity) with an Add / Edit UOM values button. The RMPM items list also has the "Without UOM list" filter to find the materials that still have no UOM values.',
      pts: ['⚖ UOM details in the RMPM item form', 'Filter: ⚠ Without UOM list'] },
    { b: 572, v: 'md-emp', area: 'Master data', ic: '🕘', t: 'Employees: add history / log updates',
      d: 'In the Employees list every row now has a 🕘 button that opens the employee\'s history with a new history record ready (the employee\'s details already filled in). In the employee form there is a new "➕ Add history record" action, and a tick box "📝 Log this update in Employee history" (on by default): when you save a change, a history row is added automatically with the employee\'s details, the date and which fields changed.',
      pts: ['🕘 button on each employee row', '➕ Add history record in the employee form', 'Tick "Log this update in Employee history" when saving'] },
    { b: 571, v: 'md-inv', area: 'Master data', ic: '🔎', t: 'Master-data lists: filter on every column + row numbers',
      d: 'Every Master data list window (Inventory items, Item UoM, Employees, Suppliers … all of them) now has a filter box under each column heading and a # column that numbers the rows shown. Type text to filter any column; for number columns you can also type > < >= <= = with a number (e.g. >100), and "-" finds empty values. Filters combine with the search box, the status and the UOM filters; ✕ clears them all.',
      pts: ['Filter row under the column headings', '# row numbering follows the filtered list', 'Number columns accept >100, <=5 …'] },
    { b: 570, v: 'g5', area: '5 Gallon', ic: '🧮', t: '5G summary KPIs: click for the source figures · hide any card · Inventory items: find items without a UOM list',
      d: 'On 5 Gallon Plant & DC summary every KPI card is clickable — it opens the source entries behind the number — and has a small ✕ (on hover) to hide it; 📋 Measures brings it back. In Master data → Inventory items a new "UOM list" filter shows only the items that have no UOM values yet (or only those that have).',
      pts: ['Click a KPI card to see its source figures', '✕ on a card hides it, 📋 Measures restores it', 'Inventory items → ⚠ Without UOM list'] },
    { b: 569, v: 'whdu', area: 'Warehouse', ic: '✅', t: 'Submission page · required readings from the store list · tidy warehouse picker',
      d: 'WHs Daily Data Update has a new "✅ Submission" tab (moved from the Dashboard): which warehouse updated and which did not over the last 7 / 14 / 30 days or the whole period, with filters — warehouse picker (search, My warehouses), data sector, show (not updated on the last day, below 100% / 80%, days of nothing posted, partial days) and last update — and two e-mail buttons: "✉ Request clarification" (all shown, or ✉ per warehouse, listing each missed day and the sectors missing, with a reply-by date) and "✉ E-mail submission report". Both go to the users in charge of the warehouses (line managers in Cc). In Temperature · Reading compliance the required readings per day now come from the store list (Stores_Locations_tbl · Nr of Daily Temp readings); a value typed in a row still overrides it. The warehouse dropdowns have a clean layout (checkbox beside the name).',
      pts: ['Submission tab with filters + 2 e-mail buttons', 'Required readings per day from Stores_Locations_tbl', 'Warehouse dropdown layout fixed'] },
    { b: 568, v: 'whtmp', area: 'Warehouse', ic: '🏭', t: 'Reading compliance — warehouse and last-reading filters',
      d: 'In ✅ Reading compliance: a "🏭 Warehouses" filter — search, tick the warehouses you need, "👤 My warehouses" (the ones linked to your user) or All; the choice is remembered per user and applies to the table, the cards and the e-mails. New "Last reading" filter: read today, not read today, no reading for 2+ / 3+ days, never in the period.',
      pts: ['Warehouse picker with search + My warehouses', 'Remembered per user', 'Last reading filter'] },
    { b: 567, v: 'whtmp', area: 'Warehouse', ic: '✉', t: 'Reading compliance — filter and clarification requests',
      d: 'In ✅ Reading compliance: a new "Show" filter (all / non-compliant only / below 80% / with missed days / with partial days) and a "Reply by" date. "✉ Request clarification" e-mails the users in charge of the shown non-compliant warehouses, listing each missed or partial day (readings taken / required) and asking for the reason and the corrective action by the reply-by date; the ✉ button on a row sends the request for that warehouse only. Line managers are in Cc; the Excel attachment lists every non-compliant day with a blank "Reason / corrective action" column.',
      pts: ['Show filter: non-compliant / below 80% / missed / partial', 'Request clarification for all shown, or per warehouse', 'Reply-by date in the e-mail'] },
    { b: 566, v: 'whtmp', area: 'Warehouse', ic: '✅', t: 'Temperature Daily Records — Reading compliance report',
      d: 'New tab "✅ Reading compliance": every warehouse against the number of readings it must capture each day. Day-by-day cells show ✔ (all required readings taken), n/required (part of them) or ✘ (none); per warehouse: days met / partial / missed, readings captured vs required and the compliance %, lowest first. Set the required readings per day once (default) or per warehouse (0 = not required) — saved for you; if the store list has a readings-per-day column it is used automatically. Today is not counted until its readings are complete. The "✉ E-mail compliance report" button sends it to the users in charge of the warehouses below 100% (line managers in Cc).',
      pts: ['Required readings per day: default + per warehouse', 'Compliance %, missed days, today still open', 'E-mail to the users in charge of non-compliant warehouses'] },
    { b: 565, v: 'whdu', area: 'Warehouse', ic: '✅', t: 'WHs Daily Data Update — Submission table · Fleet Excel · Data updates look',
      d: 'The Dashboard of WHs Daily Data Update now has a "Submission" table: every warehouse against the last 14 days with ✔ (all sectors posted), ◐ (some sectors) or ✘ (nothing posted), the submitted % , last update and who posted — warehouses that did not post on the last day are listed first. The Fleet Dept e-mail Excel now holds only the units in breakdown now (with their Remarks), not the 14 days. The Data updates pop-up is back to the calm theme-based look (file renamed js/98f-data-updates.js so an old cached copy cannot load) and shows the build number in its header.',
      pts: ['Submission table on the Dashboard', 'Fleet Excel = current breakdown units only', 'Data updates: calm look, build shown in the header'] },
    { b: 564, v: 'whdu', area: 'Warehouse', ic: '📝', t: 'Fleet breakdown e-mail — Remarks added',
      d: 'The Remarks posted by the warehouses (the numbers of the equipment in breakdown) now show in "1 · Current status" (per equipment type, with the warehouse name) and in "2 · Where the equipment is down" (per warehouse and equipment). They are also in the Excel attachment.',
      pts: ['Remarks column in Current status', 'Remarks column in Where the equipment is down', 'Remarks in the Excel detail'] },
    { b: 563, v: 'home', area: 'All areas', ic: '🔧', t: 'Update fix — new pages and buttons now load straight away',
      d: 'Some updated files kept the old version tag in index.html, so browsers kept showing the old copy (e-mail buttons, Fleet breakdown e-mail, UOM details, dark-mode fix, Data updates look). Every changed file now carries the new tag, so after this update all of them load.',
      pts: ['E-mail Fleet Dept button (Block values · Equipment)', 'E-mail above-limit temperature readings', 'UOM details on Inventory items · dark-mode fix'] },
    { b: 562, v: 'md-inv', area: 'Master data', ic: '⚖', t: 'Inventory items — UOM details on the item',
      d: 'Open an item in Master data → Inventory items: a new "⚖ UOM details" section shows the UoM values of this item (PC, CT, OT, PLT … with the base quantity), and the "⚖ UOM details" button in Quick actions (or Edit / Add UOM values in the section) opens the UOM editor for that item, ready to add or change rows. After saving, the section refreshes.',
      pts: ['UOM section inside the item form', 'Quick action: ⚖ UOM details', 'Add / edit UoM rows and save to UOM_tbl'] },
    { b: 561, v: 'whdu', area: 'Warehouse', ic: '✉', t: 'Block values · Equipment — e-mail the breakdown status to the Fleet Dept',
      d: 'On WHs Daily Data Update → Block values → 6-Equipment there is a new "✉ E-mail Fleet Dept — breakdown status" button. The e-mail shows first the current status per equipment type (budgeted / working / breakdown / % / previous day), then where the equipment is down by warehouse, then the last 14 days of breakdowns by equipment type and by warehouse. LGVs are not included. It is addressed To the Fleet Dept users (job title / profile / BU says Fleet), or the Fleet recipients saved on the Fleet pages, with you in Cc; the Excel attachment has the 14-day detail.',
      pts: ['Current breakdown status first, then last 14 days', 'LGVs excluded', 'Default To = Fleet Dept users, editable'] },
    { b: 560, v: 'whtmp', area: 'Warehouse', ic: '✉', t: 'Temperature warning — e-mail the above-limit readings + dark mode fix',
      d: 'The red "WARNING — temperature above the limit" card has a new "✉ E-mail above-limit readings" button. It opens a ready e-mail (above-limit warehouses + the watch list, last reading, limit, over-by, readings above in the period) already addressed To the users in charge of those warehouses (matched by the Warehouse name / Location ID on the Users page) and Cc their line managers and you. You can edit the recipients before sending. Also fixed: dark mode now works when the Soft or Dim page brightness was chosen earlier (the 5 Gallon page and others stayed light).',
      pts: ['✉ button on the temperature warning card', 'To = users in charge of the warehouses, Cc = line managers', 'Dark mode no longer overridden by Soft / Dim brightness'] },
    { b: 559, v: 'g5', area: '5 Gallon', ic: '📋', t: 'Measure filter on every 5 Gallon page + Data updates follows the theme',
      d: 'One clean "Measures" filter now works the same on Dashboard, Totals, By brand, Brand per site, Today vs yesterday and Plant & DC summary: open it, search, tick only the measures you need (grouped, checkbox on the left), Select all / Deselect all, Done. The choice is kept per page and also applies to the exported report. The Data updates panel now takes the system accent colour and the dark / light mode.',
      pts: ['Measures filter on all measure pages', 'Search, group, Select all / Deselect all', 'Data updates follows accent colour + dark mode'] },
    { b: 558, v: 'home', area: 'All areas', ic: '🔔', t: 'Data updates — calmer, professional look',
      d: 'The Data updates panel now uses a restrained navy style: white record cards with a thin area-colour edge, outlined filter chips with a colour dot, soft NEW / UPDATED tags and quiet buttons. The sign-in pop-up switch is unchanged.',
      pts: ['Navy header, white cards', 'Subtle area colours', 'Quieter 🔔 button highlight'] },
    { b: 557, v: 'g5', area: '5 Gallon', ic: '👁', t: 'Plant & DC summary — shorter KPI cards, show / hide',
      d: 'The KPI cards are back to the full width of the page but shorter in height. New show / hide option: the "Hide KPI cards" button, or click the Plant / DC\'s label to fold just that line. The choice is remembered.',
      pts: ['Same width, lower height', 'Hide / show all KPI cards', 'Fold Plant or DC\'s separately (remembered)'] },
    { b: 556, v: 'home', area: 'All areas', ic: '🔔', t: 'Data updates — eye-catching look and a sign-in pop-up switch',
      d: 'The Data updates panel has a new vivid look (colour per area, big counter, bold NEW / UPDATED tags) and each user can choose whether it opens by itself at sign-in: tick or untick "Show this pop-up when I sign in" at the bottom of the panel. When it is off, the 🔔 Updates button pulses with a counter whenever there is something new.',
      pts: ['Colour per area', 'Switch: show the pop-up at sign-in or not (per user)', '🔔 button pulses when there are updates'] },
    { b: 555, v: 'g5', area: '5 Gallon', ic: '📐', t: 'Plant & DC summary — narrower KPI cards',
      d: 'The KPI cards are narrower (fixed width, more compact) so they sit grouped on the left instead of stretching across the page; still two lines.',
      pts: ['Narrower, compact cards', 'Two lines: Plant and DC\'s'] },
    { b: 554, v: 'g5', area: '5 Gallon', ic: '🔎', t: 'Plant & DC summary — double-click opens the source entries',
      d: 'Double-click a measure or a location in the summary table to see the records and fields behind the figure (date, site, brand, status, each field and the sum). Double-click a row — or press Open entry — to open that entry in Daily entry.',
      pts: ['Double-click a measure: all locations', 'Double-click a location: its entries', 'Double-click an entry: opens Daily entry'] },
    { b: 553, v: 'g5', area: '5 Gallon', ic: '🎨', t: 'Plant & DC summary — new KPI cards',
      d: 'Redesigned KPI cards: an icon per figure, a coloured accent per group (Plant / DC, FG / empties), larger numbers all aligned, orange for the non-usable figures, a soft hover lift. Still two lines: Plant, then the DC\'s.',
      pts: ['Icon + colour per figure', 'Aligned large numbers', 'Two lines only'] },
    { b: 552, v: 'g5', area: '5 Gallon', ic: '🗄️', t: 'Plant & DC summary — empty racks',
      d: "Empty racks on hand (RM_Empty_Racks, closing) added for the Plant and for the DC's, in the cards, the by-brand / location table and the exports.",
      pts: ['Total empty racks on hand — Plant', "Total empty racks on hand — DC's"] },
    { b: 551, v: 'g5', area: '5 Gallon', ic: '🏭', t: 'Plant & DC summary — two KPI lines, locations under every total',
      d: "The KPI cards of the Plant & DC summary now take two lines only (Plant, then DC's, with FG and empties side by side). The table below lists every location / warehouse under each total, with Expand all / Collapse all and a click on a measure to open or close its locations. Excel / Print / Email include the locations.",
      pts: ['Two KPI lines: Plant and DC\'s', 'Locations (warehouses) under each total, expand / collapse', 'Locations add up to the total'] },
    { b: 550, v: 'g5', area: '5 Gallon', ic: '🏭', t: "Plant & DC summary",
      d: "A new tab with the headline figures: Plant FG and empties (received, released, transferred, on hand, usable / non-usable) and DC's FG and empties (received, released, on hand, usable, returned to plants, from sales, customer returns), with a by-brand table, Excel / Print / Email and an ⓘ source on every figure.",
      pts: ['Plant — FG and EMP cards', "DC's — FG and EMP cards", 'By brand table', 'Customer deposits needs a column in the DC list'] },
    { b: 549, v: 'g5', area: '5 Gallon', ic: 'ⓘ', t: 'Source of every column on every 5 Gallon page',
      d: 'Every column header, measure name and KPI tile on the 5 Gallon pages now has an ⓘ: hover it to see the SharePoint list, the fields and the equation behind the figure (Daily entry, Dashboard, Totals, By brand, Brand per site, Today vs yesterday, By site, Checks, Records).',
      pts: ['Hover ⓘ next to a header or measure', 'Shows list → field(s) and how the total is calculated'] },
    { b: 548, v: 'g5', area: '5 Gallon', ic: 'ⓘ', t: 'Checks — where every column comes from',
      d: 'On the Checks page every column header has an ⓘ: hover it to see the SharePoint list and fields it sums. Under each table, "Where does each column come from?" opens a full list of source list, fields and calculation.',
      pts: ['Hover a header for its source', 'Expandable source table under table A and table B'] },
    { b: 547, v: 'aem', area: 'Attendance by Employees', ic: '📧', t: 'Email window in front · readable dates',
      d: 'Sharing an employee by email now opens the e-mail window in front of the employee card, and the card shows dates as dd/mm/yyyy (Date_of_Join, Date_of_Birth …) instead of the raw SharePoint format.',
      pts: ['Email window always on top', 'Dates on the employee card as 05/04/2004'] },
    { b: 546, v: 'g5', area: '5 Gallon', ic: '📅', t: 'Dates now follow the Entry_Date column',
      d: 'Records whose Title date differs from the Entry_Date shown in the list (for example KZD rows entered as 25/11 but dated 26/11) now appear on the Entry_Date, exactly as the SharePoint list shows them. All 5 Gallon pages, exports and e-mails use it.',
      pts: ['Entry_Date is the record date; the Title date is only a fallback', 'Totals, Brand per site and By brand now match the list'] },
    { b: 545, v: 'g5', area: '5 Gallon', ic: '📋', t: 'Brand per site — filter by measure',
      d: 'A Measure filter on the Brand per site page: tick one or several measures (FG released, EMP stock, Customer returns …) and only those lines show; Excel, Print and Email follow the filter.',
      pts: ['📋 Measure selector with tick boxes, Select all / Clear', 'Excel, Print and Email use only the chosen measures'] },
    { b: 544, v: 'home', area: 'All areas', ic: '🔔', t: 'Data updates — what the other users added or changed',
      d: 'After sign-in a panel lists the new and edited records of the other users, only in the areas you can open and the locations you belong to. Tick each record as verified, open its page in one click, or mark everything as seen. The 🔔 Updates button in the top bar (and Data updates in the side panel) opens it any time.',
      pts: ['📅 Period filter: since last visit, today, yesterday, last 7 / 30 days or any date range','🔔 Updates button with a counter, always available', 'NEW / UPDATED tags, who changed it and when', 'Verify tick per record, Verify all, filter by area', 'Open ➜ jumps to the page'] },
    { b: 541, v: 'g5', area: '5 Gallon · RM & PM', ic: '🔒', t: 'Lock / auto-lock, e-mail findings and filters',
      d: 'The 5 Gallon daily entry now has Lock day / Unlock day buttons (admins and people with the lock permission) and every day locks automatically 24 hours after the entry day ends. RM & PM: e-mail the most important findings, filter Abnormal changes by Level, Item, Description and Category, and filter Today vs previous by Status.',
      pts: ['Lock day / Unlock day on web and mobile', 'Auto-lock 24 h after the entry day; shown as Locked (auto)', 'Email findings button on the dashboard and Abnormal tab', 'Abnormal changes: Level, Item, Description, Category filters', 'Today vs previous: Status filter'] },
    { b: 539, v: 'g5', area: '5 Gallon', ic: '🫙', t: '5 Gallon — elegant e-mail for Brand per site',
      d: 'The e-mail of the Brand per site page is redesigned: a header, headline totals, brand colours and one band per measure with its sites underneath. In mail apps that support it (Apple Mail, iPhone / iPad Mail, Thunderbird) every measure line collapses and expands; the Excel stays the standard ORBIT export.',
      pts: ['Designed e-mail body with KPI tiles and brand colours', 'Collapse / expand on every measure line (where the mail app allows)', 'Excel unchanged — the standard export'] },
    { b: 538, v: 'rpa', area: 'RM & PM Analysis', ic: '🧱', t: 'RM & PM Analysis — daily stock file, comparison, trend and abnormal changes',
      d: 'Upload the daily RM & PM Excel file (JDE report + count sheet). ORBIT keeps every day, compares today with the previous file, follows the trend and the consumption, shows the KPIs and flags abnormal changes — unusual consumption, stock rising without a receipt, out of stock, negative system stock, count differences and low cover. Works on the web and on the phone.',
      pts: ['Upload file — the date is read from the file name; several files at once to fill earlier days', 'Dashboard: KPIs, totals by material group, top consumption, lowest cover', 'Today vs previous: every item with change, consumption, days of cover and a mini trend', 'Abnormal changes and Trends (item or category over time)', 'Print / Excel / Email, and three phone screens'] },
    { b: 537, v: 'g5', area: '5 Gallon', ic: '🫙', t: '5 Gallon — Today vs yesterday and abnormal-change alerts',
      d: 'A new page compares today with yesterday for every total, shows the last 15 days and the 7-day trend, and flags unusual changes — for the totals and for each site, brand and measure — against the normal level of the previous 14 days. It also lists sites that reported yesterday but have no entry today.',
      pts: ['Today, yesterday, change and change %', 'Usual level (14-day average) and status: Normal / Watch / Abnormal', 'Sensitivity setting', 'Six 30-day trend charts with a 7-day average', 'Print / Excel / Email'] },
    { b: 536, v: 'g5', area: '5 Gallon', ic: '🫙', t: '5 Gallon — Brand per site as an expandable list',
      d: 'Every line is now a measure (with the brand figures and the all-brands total) and under it the sites with their figures. Click a line to expand or collapse it, or use Expand all / Collapse all. Excel, Print and Email export the same layout. The stacked Expand and Columns buttons are gone from the 5 Gallon page.',
      pts: ['Measure line + its sites underneath', 'Expand all / Collapse all', 'Excel keeps the same measure → sites structure', 'Cleaner page without the extra buttons'] },
    { b: 535, v: 'g5', area: '5 Gallon', ic: '🫙', t: '5 Gallon — Brand per site page',
      d: 'A new page that shows every brand for every site: pick a measure to compare all sites and brands in one table, and see a full measure-by-brand table for each DC and the Plant.',
      pts: ['Measure picker with a total row', 'One card per site with all its measures by brand', 'Works with the date, brand, source and site filters; Print / Excel / Email'] },
    { b: 534, v: 'g5', area: '5 Gallon', ic: '🫙', t: '5 Gallon — Totals page and Source filter',
      d: 'The totals now have their own page (Totals), separate from By brand. A new Source filter (All sources / DC\'s only / Plant only) shows the analysis based on where the data was entered.',
      pts: ['Totals tab: summary by brand', 'By brand tab: side by side, charts and by-site tables', 'Source filter on all analysis tabs'] },
    { b: 533, v: 'g5', area: '5 Gallon', ic: '🫙', t: '5 Gallon — Summary by brand',
      d: 'The By brand page starts with a summary of totals per brand: FG released to sales, FG in stock, FG received from production, FG released to DC\'s, EMP received from sales, EMP released to production, EMP in stock, OCS, empty usable, production reject and leaked.',
      pts: ['One column per brand plus All brands', 'Movements = totals of the period, stock = closing position', 'Included in Print, Excel and Email'] },
    { b: 532, v: 'g5', area: '5 Gallon', ic: '🫙', t: '5 Gallon — new By brand page',
      d: 'A page that compares Oasis, Aqua and Oasis Zero side by side (production, releases, stock, empties quality, returns), with daily charts per brand and a by-site table for each brand.',
      pts: ['Brands side by side with an All brands column', 'Charts: release to sales, FG stock and bad empties per brand', 'Print, Excel and Email export the comparison'] },
    { b: 531, v: 'g5', area: '5 Gallon', ic: '🫙', t: "5 Gallon — total list for DC's and Plant",
      d: "Records now has an All view that lists the DC's and the Plant together, with DC total, Plant total and grand total rows at the bottom, and the calculated total columns (EMP received from sales, FG stock, EMP stock).",
      pts: ["Records > All: one list for DC's + Plant", 'Flows are summed; stock columns show the latest closing stock', 'Print, Excel and Email include the total rows'] },
    { b: 530, v: 'g5', area: '5 Gallon', ic: '🫙', t: "5 Gallon — Plant: Release to DC's",
      d: "New Plant field FG_Rls_DCs (finished goods released to the DC's) on the entry page and the phone, and in the analysis: the stock check, the DC-versus-plant FG comparison and the dashboard now use it.",
      pts: ["Entry: 'Release to DC's' in the FG group of the Plant", "Checks: plant FG released to DC's compared with DC receipts from BU's"] },
    { b: 529, v: 'g5', area: '5 Gallon', ic: '🫙', t: '5 Gallon — new brand Oasis Zero',
      d: 'The 5 Gallon entry and analysis now have three brands side by side: Oasis, Aqua and Oasis Zero. In SharePoint, add Oasis Zero to the Brand choice of both daily lists.',
      pts: ['Daily entry shows three columns', 'Dashboard, By site, Checks and Submission include Oasis Zero'] },
    { b: 528, v: 'g5', area: '5 Gallon', ic: '🫙', t: '5 Gallon moved to the Warehouse menu',
      d: 'The 5 Gallon page now sits in the Warehouse section of the menu, with the other warehouse pages.',
      pts: ['Open the Warehouse section in the left menu'] },
    { b: 527, v: 'g5', area: '5 Gallon', ic: '🫙', t: '5 Gallon — new module (web and mobile)',
      d: 'Daily bottles data of the DC\'s and the Plant, Oasis and Aqua side by side: enter it on the web or on the phone, and analyse it — FG flow, empties quality, stock in hand, DC return vs plant receipt, stock roll-forward check and the submission status of every site.',
      pts: ['Daily entry: live totals, yesterday beside today, Save draft / Submit', 'Dashboard with KPIs and trends; By site; Checks; Submission; Records', 'Print, Excel and Email from every tab', 'On the phone: 5 Gallon menu — Daily entry, Day status, Stock position'] },
    { b: 475, v: 'demandplan', area: 'Planning Dept. › Demand Plan vs Execution', ic: '📥', t: 'Demand Plan vs Execution — new page',
      d: 'Import the daily demand plans (Milco / GSD, Water, UHT Excel files and the PET requirements e-mail) and compare them with the trips that were really executed and with the picking done. See the trip compliance, pallet accuracy and picking accuracy per plan, per trip and per SKU.',
      pts: ['Drop the plan files (or an .eml e-mail) — nothing is imported twice', 'One page per plan type plus a comprehensive page, one row per trip with its source', 'Raw numbers table: planned / done / missing for trips, pallets, SKU lines and items', 'Double-click a row for the breakdown with the SKUs of each trip'], sel: '#dmpHost' },
    { b: 489, v: 'wh3d', area: 'Warehouse › 3D Warehouse View', ic: '🧊', t: 'Floor plan in 3D — set once by the administrator',
      d: 'The warehouse drawing can now lie under the racks in 3D. The administrator sets its size and position once and every user sees it the same way.',
      pts: ['Open a store and the floor plan appears under its racks', 'Same view for everyone at the location — nothing to set up'], sel: '#w3Cv' },
    { b: 492, v: 'wh3d', area: 'Warehouse › 3D Warehouse View', ic: '🧊', t: 'View a whole Region › WHs_ID in one 3D scene',
      d: 'A new "Region › WHs_ID" list shows all the stores (rack blocks) of one warehouse group together — e.g. the whole MAQ Lacnor — with its own map and totals. The single-store view is unchanged.',
      pts: ['Pick a Region › WHs_ID to see every store of the group side by side', 'Totals and KPIs add up the whole group', 'Choose "no grouping" to go back to one store'], sel: '#w3Grp' },
    { b: 491, v: 'whov', area: 'Warehouse › Warehouses Overview (3D)', ic: '🏢', t: 'One combined card per Region › WHs_ID',
      d: 'Choose a Region › WHs_ID to get one extra, full-width card that shows all of its stores together in 3D, above the single-store cards.',
      pts: ['Pick the group in the new "Region › WHs_ID" list', 'Drag to turn and zoom the combined view'], sel: '#woGrp' },
    { b: 526, v: 'aem', area: 'Attendance', ic: '🛠', t: 'Attendance by Employees — Expand and Columns buttons on every table',
      d: 'Every table of Attendance by Employees now has its own ⤢ Expand and ▦ Columns buttons above it (they were missing on some screens).',
      pts: ['Use ⤢ Expand for the full-screen list with search and filters', '▦ Columns shows / hides / reorders the columns'], sel: '#aemBody' },
    { b: 525, v: 'aem', area: 'Attendance', ic: '🛠', t: 'Fix: Add to Employees_tbl in Expand view, and date filters on all devices',
      d: 'The ➕ Add to Employees_tbl button (and row click / double-click) now also works in the Expand window of the lists. The From / To date filters now work on devices where the date picker only reports while typing or where the browser shows a plain text box: typed dates like 12/11/2026 or 2026-11-12 are accepted, and an invalid entry no longer clears the filter.',
      pts: ['Not matched → Expand → ➕ Add to Employees_tbl', 'Type the date as dd/mm/yyyy if no calendar appears'], sel: '#aemBody' },
    { b: 524, v: 'users', area: 'Users', ic: '0️⃣', t: 'Location ID 0 = all locations',
      d: 'A non-admin user whose Location ID is 0 (Users page or LoginUserList in SharePoint) now sees every location — ALL or * work too. The user keeps his role permissions; only the location limit is lifted. An empty Location ID still shows no location data.',
      pts: ['Users → edit the user → Location ID = 0 → Save', 'Sign out / in (or refresh) — the top bar shows 📍 All locations'], sel: '#userTableBody' },
    { b: 523, v: 'users', area: 'Users', ic: '🌍', t: 'Admin staff with access to all locations',
      d: 'A non-admin user can now see every location: on the Users page type ALL (or *) in the Location ID field — or in the Location ID column of the LoginUserList in SharePoint. The user keeps his own role permissions (no admin rights); only the location limit is lifted, and his uploads are not stamped with a single location. Users without any Location ID still see no location data.',
      pts: ['Users → edit the user → Location ID = ALL → Save', 'The top bar then shows 📍 All locations'], sel: '#userTableBody' },
    { b: 522, v: 'aem', area: 'Attendance', ic: '📍', t: 'Attendance by Employees — clear reason when no data shows',
      d: 'When the attendance list cannot be shown the page now says why: a user without a Location ID (non-admin) has every location’s data hidden by the system, and rows of other locations are hidden too. The page also waits for a slow list load and refreshes by itself when the data arrives.',
      pts: ['If you see no data: ask the administrator to set your Location ID in Users / LoginUserList'], sel: '#aemBody' },
    { b: 521, v: 'aem', area: 'Attendance', ic: '🔌', t: 'Attendance by Employees loads on its own',
      d: 'The page no longer depends on Attendance Analytics: when you open it, it reads Employees_tbl and the attendance (SharePoint list Attendance_Data_tbl, or the copy saved in this browser) by itself. Refresh checks the list for newer data and loads it. If the attendance cannot be read, the page now shows the reason.',
      pts: ['Open Attendance by Employees directly — no need to open Attendance Analytics first', 'Press Refresh to pull the latest attendance'], sel: '#aemBody' },
    { b: 520, v: 'aem', area: 'Attendance', ic: '📧', t: 'Breakdown e-mail goes to the Line Manager by default',
      d: 'When you e-mail a breakdown window from Attendance by Employees, the To field is now filled with the e-mail of the staff member\'s Line_Manager (from Employees_tbl; for staff not in Employees_tbl, the supervisor in the attendance; for an in-charge window, that in-charge). The address is looked up in the Users list by name — if none is found you get a warning and enter it yourself.',
      pts: ['Open a staff row → 📧 Email → To is the line manager'], sel: '#aemBody' },
    { b: 519, v: 'aem', area: 'Attendance', ic: '🧭', t: 'Not in Employees_tbl — full attendance data per staff',
      d: 'The list "In the attendance but not in Employees_tbl" now carries all the attendance data of each file number — work and payroll location, position, function, department, section, supervisor, group, category, status, shift, first / last day, present / absent days, average hours and OT — to help define the real working location before adding the staff. The extra columns are hidden by default; show them with ▦ Columns.',
      pts: ['Not matched → ▦ Columns → tick the columns to show'], sel: '#aemBody' },
    { b: 518, v: 'aem', area: 'Attendance', ic: '💡', t: 'Add to Employees_tbl — suggestions from existing data',
      d: 'In the Add to Employees_tbl form every field now offers the values already used in Employees_tbl (most used first) — pick from the list or type a new value. Choice fields also include the existing values.',
      pts: ['Click a field and pick from the suggestions, or keep typing'], sel: '#aemBody' },
    { b: 517, v: 'aem', area: 'Attendance', ic: '📧', t: 'Email, print or Excel from the breakdown window',
      d: 'The breakdown windows in Attendance by Employees now have Email, Print and Excel buttons. They export the records shown in the window; for a staff card the Excel file has a second sheet with the OT request lines.',
      pts: ['Open a row → 📧 Email / 🖨 Print / 📊 Excel at the top of the window'], sel: '#aemBody' },
    { b: 516, v: 'aem', area: 'Attendance', ic: '🖱', t: 'Double-click a row in the staff and records tables',
      d: 'In Attendance by Employees → By staff and Records, the breakdown window now opens with a double-click on the row (a single click no longer opens it), so selecting and scrolling the table is not interrupted.',
      pts: ['Double-click a staff row to open the details'], sel: '#aemBody' },
    { b: 515, v: 'aem', area: 'Attendance', ic: '👤', t: 'Click a name in the top lists to see the breakdown',
      d: 'In Attendance by Employees, the names in Most absences, Most late arrivals and Top 15 by overtime are now clickable and open the employee card with their attendance days and OT lines.',
      pts: ['Overview → click a name in Most absences / Most late arrivals'], sel: '#aemBody' },
    { b: 514, v: 'aem', area: 'Attendance', ic: '🔎', t: 'Attendance by Employees — click any row for the source data, and add missing staff',
      d: 'Every table row in Attendance by Employees now opens a breakdown window with the underlying records: a staff row shows the Employees_tbl main card plus all attendance days and OT request lines; a group row lists its staff and records; an in-charge row lists the OT request lines; a record row shows the full source attendance line. In the Not matched tab, the staff with no attendance open their Employees_tbl card, and each file number found in the attendance but missing from Employees_tbl has an Add to Employees_tbl button — a form prefilled from the attendance data that creates the employee in SharePoint (needs Master data → Employees edit rights).',
      pts: ['Click any row in the tables to see its source data', 'Not matched → In the attendance but not in Employees_tbl → ➕ Add to Employees_tbl', 'Check the prefilled values and press Save'], sel: '#aemBody' },
    { b: 513, v: 'aem', area: 'Attendance', ic: '⏱', t: 'Overtime analysis and OT recovery by area in-charge',
      d: 'Attendance by Employees has two new tabs. Overtime lists the OT hours of all sectors (any Employees_tbl field) — normal vs Fri/rest/holiday OT, staff with OT and OT % of worked hours. OT requests & recovery links the approved OT requests (OT_Approval_Hdr_tbl / OT_Staff_List_Data_tbl) to the staff by file number and shows, per area in-charge and per sector, the approved OT, the day-off taken, the hours recovered (verified), the balance and the recovery %, next to the actual OT in the attendance.',
      pts: ['Open Attendance by Employees → Overtime or OT requests & recovery', 'Choose the sector field with "Analyse by"', 'Click an in-charge to see the staff and what is still to recover'], sel: '#aemBody' },
    { b: 512, v: 'aem', area: 'Attendance', ic: '🕒', t: 'New page: Attendance by Employees',
      d: 'A second Attendance Analytics page built on the staff master. It reads Employees_tbl, links every attendance record to the employee by file number and filters by the Employees_tbl columns (choose them with Filter fields). It has KPIs, status and by-day charts, attendance rate per group, a by-staff table, records, and the lists of staff without attendance and attendance not found in Employees_tbl. Print and Excel included.',
      pts: ['Open Attendance by Employees in the menu', 'Pick a date range and the Employees_tbl filters', 'Click a bar or a status to filter; use Filter fields to change the filters'], sel: '#aemBody' },
    { b: 510, v: 'tt', area: 'Team Tasks', ic: '📎', t: 'Attach files when updating a task',
      d: 'The daily update and Mark done windows now have an Attachments box. When the task requires files, saving is blocked until the required number is attached. Files go to the task in Tasks_tbl (the same place as the Power App). The task window lists the attached files and has an Add attachment button.',
      pts: ['Press ✔ Update on a recurring date', 'Choose the files, add the note, Save', 'Open a task to see or add attachments'], sel: '#ttBody' },
    { b: 509, v: 'tt', area: 'Team Tasks', ic: '🔁', t: 'Recurring tasks: daily update by the assignee',
      d: 'A recurring task now shows one line per required date (today included) in Monitor tasks, and in the Recurring tab for the person it is assigned to. The assignee, or a user with the uploader permission, presses Update to record the daily execution with a note — it is saved to Tasks_tbl and counts as executed on time.',
      pts: ['Open Team Tasks → Monitor tasks (My tasks)', 'Press ✔ Update on the required date, add the note and save', 'The Recurring tab → open the task → Update column covers any date'], sel: '#ttBody' },
    { b: 508, v: 'demandplan', area: 'Demand Plan vs Execution', ic: '💾', t: 'Saving many plans to SharePoint no longer stops',
      d: 'When SharePoint throttles the save (429) the page now waits and continues with only the rows that failed, saves plan by plan and keeps the ones already saved. With the optional column Lines_JSON in Demand_Plan_tbl, one row per day and destination is saved instead of one row per SKU — about 50 times fewer rows.',
      pts: ['Add the column Lines_JSON (Multiple lines of text, plain text) to Demand_Plan_tbl', 'Press Save all to SharePoint — it shows which plan it is on', 'If it stops, press Save all again: it continues'], sel: '#dmpHost' },
    { b: 507, v: 'demandplan', area: 'Demand Plan vs Execution', ic: '🥛', t: 'Milco weekly production order e-mails now import',
      d: 'The Milco weekly demand e-mails ("MILCO-GSD & LAC WKLY PROD ORDER" Excel attached, dates in the header row, one block per emirate) are now read. Subtotal rows are skipped. Pallets come from the sheet, from earlier plans, or from the new "Pieces per pallet (if unknown)" box.',
      pts: ['Drop the .eml e-mails in Import & plans', 'If a message says some lines have no pallet size, type the pieces per pallet', 'Check the dates and save'], sel: '#dmpHost' },
    { b: 504, v: 'demandplan', area: 'Demand Plan vs Execution', ic: '📤', t: 'Update the plan from an Excel sheet',
      d: 'The Excel attached to the e-mail (and the new "Plan sheet" button) now contains the whole plan in an editable sheet, with empty rows for the days that have no plan. Edit it, fill the blank days and drop it back in Import & plans — the plan is updated.',
      pts: ['Press "📤 Plan sheet" or e-mail the report', 'Edit the "Plan update" sheet and fill the blank days', 'Drop the file in "Import & plans" and save'], sel: '[data-dm="plx"]' },
    { b: 502, v: 'demandplan', area: 'Demand Plan vs Execution', ic: '🚚', t: 'Upload the executed trips — with your own column mapping',
      d: 'Upload the Excel / CSV of the trips that were really executed, choose which column is the date, destination, trailer, pallets… and the compliance report compares them with the plan (Trip compliance, Pallet accuracy, by day and destination). Your mapping is remembered.',
      pts: ['Open "Import & plans"', 'Press "Choose executed-trips file", map the columns (including JDE Ref) and save', 'Pick the source the report should use: uploaded file, system trips or both — the JDE Ref shows in the trip table and the breakdown'], sel: '[data-dm="exPick"]' },
    { b: 500, v: 'otr', adm: 1, area: 'OT Approved vs Recovered', ic: '⚖', t: 'OT Balance Statement with Off / WE / Absent days (administrators)',
      d: 'A second balance page counts every Off, WE or Absent day without punches (from the Attendance sheet) as 8 h recovered, set against the oldest open OT.',
      pts: ['Open "OT Balance Statement · Off/WE/Absent"', 'Double-click a figure in the "of which Off/WE/Absent h" column to see the days counted'], sel: '[data-t="balx"]' },
    { b: 500, v: 'otr', area: 'OT Approved vs Recovered', ic: '✉', t: 'E-mail the OT Balance Statement of all locations in one click',
      d: 'A new button on the OT Balance Statement page e-mails every location its statement — one e-mail per location, styled like the page, with its own Excel file.',
      pts: ['Open the "OT Balance Statement" tab', 'Press "Email all locations"'], sel: '[data-t="bal"]' },
    { b: 495, v: 'otr', area: 'OT Approved vs Recovered', ic: '⚖', t: 'OT Balance Statement for your location',
      d: 'A new tab shows, per location, the OT earned, the hours recovered as days off, what is claimed but not verified and the outstanding hours not yet recovered — with ageing. Administrators see every warehouse, other users see their own location only.',
      pts: ['Open the "OT Balance Statement" tab', 'Double-click a row for the monthly statement, ageing, in-charges and staff', 'Double-click a figure to see the staff lines behind it'], sel: '[data-t="bal"]' },
    { b: 494, v: 'otapp', area: 'OT Approvals', ic: '✅', t: 'OT Balance Statement before you decide',
      d: 'Every request now shows the OT balance of its location — outstanding hours not yet recovered, ageing, the staff on the request who still have a balance, and what the balance becomes if you approve. Each block can be hidden or shown.',
      pts: ['Open a request and read the balance before approving', 'Use Hide / Show on any block'], sel: '[data-k="bal"]' }
  ];
  const BUILD = () => { try { return +APP_BUILD || 0; } catch (e) { return 0; } };
  const serial = b => { try { return APP_START + '.' + String(Math.max(1, b - 472)).padStart(2, '0'); } catch (e) { return String(b); } };
  const uKey = () => { const u = typeof currentUser !== 'undefined' && currentUser; return u ? 'orbit_wn_' + String(u.username || u.id || 'user').toLowerCase() : ''; };
  const seenGet = () => { try { return +(JSON.parse(localStorage.getItem(uKey()) || '{}').seen || 0); } catch (e) { return 0; } };
  const seenSet = b => { try { localStorage.setItem(uKey(), JSON.stringify({ seen: b, at: new Date().toISOString() })); } catch (e) {} };
  /* an area is "visible" when its menu item exists and is not locked / hidden for this user */
  const vis = v => { const el = Q('.nav-item[data-view="' + v + '"]'); if (!el || el.classList.contains('locked') || el.style.display === 'none' || el.hidden || el.closest('[hidden]')) return false; try { if (typeof acLevel === 'function' && acLevel(v) === 'none') return false; } catch (e) {} return getComputedStyle(el).display !== 'none'; };
  const mine = (all) => WN.filter(x => x.b <= BUILD() && (!x.adm || (typeof isAdmin === 'function' && isAdmin())) && vis(x.v) && (all || x.b > seenGet())).sort((a, b) => a.b - b.b);
  let T = null;   // tour state
  const css = document.createElement('style'); css.textContent = `
#wnOv{position:fixed;inset:0;z-index:2147483000;background:rgba(15,23,42,.55);display:flex;align-items:center;justify-content:center;padding:16px;font-family:inherit}
#wnBox{background:var(--card,#fff);color:var(--text,#0f172a);border-radius:16px;width:min(620px,100%);max-height:92vh;overflow:auto;box-shadow:0 24px 70px rgba(0,0,0,.45)}
#wnBox .wn-h{padding:18px 22px;background:linear-gradient(120deg,#0f2a5e,#1e40af 60%,#2563eb);color:#fff;border-radius:16px 16px 0 0}#wnBox .wn-h b{font-size:19px;display:block}#wnBox .wn-h span{font-size:12px;opacity:.9}
#wnBox .wn-b{padding:16px 22px;font-size:14px;line-height:1.5}#wnBox .wn-chips{display:flex;flex-wrap:wrap;gap:6px;margin:10px 0}#wnBox .wn-chip{background:#eef4ff;color:#1e3a8a;border-radius:999px;padding:3px 11px;font-size:12px;font-weight:600}
#wnBox .wn-f{padding:12px 22px 18px;display:flex;gap:10px;flex-wrap:wrap;align-items:center}#wnBox .wn-f .sp{flex:1}
#wnBox button{border-radius:9px;padding:9px 16px;font:inherit;font-weight:600;cursor:pointer;border:1px solid #c5cfe0;background:#fff;color:#1f3b73;width:auto;margin:0}#wnBox button.wn-go{background:#1e40af;color:#fff;border-color:#1e40af}#wnBox button.wn-lk{border:0;background:none;color:#64748b;font-weight:500;text-decoration:underline;padding:6px}
#wnBox ul{margin:6px 0 0 18px;padding:0}#wnBox li{margin:3px 0}
#wnBox .wn-it{border:1px solid #e2e8f0;border-radius:12px;padding:10px 14px;margin:8px 0;display:flex;gap:12px;align-items:flex-start}#wnBox .wn-it .ic{font-size:22px}#wnBox .wn-it small{display:block;color:#64748b}
#wnTour{position:fixed;right:18px;bottom:18px;z-index:2147483001;width:min(400px,calc(100vw - 28px));background:var(--card,#fff);color:var(--text,#0f172a);border-radius:14px;box-shadow:0 18px 50px rgba(0,0,0,.45);border:1px solid #cbd5e1;overflow:hidden;font-size:13.5px}
#wnTour .wn-th{background:linear-gradient(120deg,#0f2a5e,#2563eb);color:#fff;padding:10px 14px;display:flex;justify-content:space-between;gap:8px;align-items:center}#wnTour .wn-tb{padding:12px 14px;line-height:1.5;max-height:46vh;overflow:auto}#wnTour .wn-tf{padding:10px 14px;display:flex;gap:8px;border-top:1px solid #e2e8f0;align-items:center}#wnTour .wn-tf .sp{flex:1}
#wnTour button{border-radius:8px;padding:7px 13px;font:inherit;font-weight:600;cursor:pointer;border:1px solid #c5cfe0;background:#fff;color:#1f3b73;width:auto;margin:0}#wnTour button.wn-go{background:#1e40af;color:#fff;border-color:#1e40af}#wnTour ul{margin:6px 0 0 18px;padding:0}
#wnRing{position:fixed;z-index:2147483000;pointer-events:none;border:3px solid #f59e0b;border-radius:10px;box-shadow:0 0 0 6px rgba(245,158,11,.25),0 0 0 9999px rgba(15,23,42,.18);transition:all .25s}
#wnBtn{margin:6px 12px 2px;background:rgba(255,255,255,.14);border:1px solid rgba(255,255,255,.35);color:inherit;border-radius:9px;padding:5px 10px;font:inherit;font-size:12px;font-weight:700;cursor:pointer;width:calc(100% - 24px)}`;
  document.head.appendChild(css);
  const close = () => { const o = Q('#wnOv'); if (o) o.remove(); };
  const endTour = () => { T = null; const t = Q('#wnTour'); if (t) t.remove(); const r = Q('#wnRing'); if (r) r.remove(); };
  const who = () => { const u = typeof currentUser !== 'undefined' && currentUser; return (u && (u.displayName || u.username)) || ''; };
  const areas = L => [...new Set(L.map(x => x.area))];

  /* 1) the announcement */
  function announce(list, manual) {
    close(); endTour(); const L = list || mine(false); if (!L.length) { if (manual) { const o = document.createElement('div'); o.id = 'wnOv'; o.dataset.nohc = '1'; o.innerHTML = '<div id="wnBox"><div class="wn-h"><b>✨ What\'s new in ORBIT</b><span>Update ' + esc(serial(BUILD())) + '</span></div><div class="wn-b">There is nothing new for the areas you can see — you are up to date.</div><div class="wn-f"><span class="sp"></span><button class="wn-go" data-wn="close">Close</button></div></div>'; document.body.appendChild(o); o.addEventListener('click', e => { if (e.target === o || e.target.closest('[data-wn="close"]')) close(); }); } return; }
    const top = Math.max(...L.map(x => x.b)), o = document.createElement('div'); o.id = 'wnOv'; o.dataset.nohc = '1';
    o.innerHTML = `<div id="wnBox" role="dialog" aria-modal="true"><div class="wn-h"><b>✨ New updates in ORBIT</b><span>Update ${esc(serial(top))} · ${L.length} new item${L.length > 1 ? 's' : ''} in the areas you can see</span></div>
      <div class="wn-b"><p style="margin:0 0 8px">Hello${who() ? ' <b>' + esc(who()) + '</b>' : ''},</p>
      <p style="margin:0 0 8px">New options and updates have been added to the system in the areas you work with. It will be a <b>great advantage</b> for you to know about them — they <b>empower your visibility on the operations data</b>.</p>
      <div class="wn-chips">${areas(L).map(a => `<span class="wn-chip">${esc(a)}</span>`).join('')}</div>
      <p style="margin:0">Would you like a short tour of what is new?</p></div>
      <div class="wn-f"><button class="wn-go" data-wn="tour">▶ Yes, take me on the tour</button><button data-wn="later">⏰ Remind me next login</button><span class="sp"></span><button class="wn-lk" data-wn="never">Don't show this again</button></div></div>`;
    document.body.appendChild(o);
    o.addEventListener('click', e => { const b = e.target.closest('[data-wn]'); if (!b) return; const a = b.dataset.wn;
      if (a === 'tour') { close(); startTour(L); } else if (a === 'later') { close(); } else if (a === 'never') { seenSet(top); close(); } }); }

  /* 2) the tour: opens each updated area, points at the new option, then a summary */
  function startTour(L) { T = { L, i: 0, top: Math.max(...L.map(x => x.b)) }; step(); }
  function ring(sel) { let r = Q('#wnRing'); const el = sel && Q(sel); if (!el || !el.getClientRects().length) { if (r) r.remove(); return false; } if (!r) { r = document.createElement('div'); r.id = 'wnRing'; document.body.appendChild(r); } try { el.scrollIntoView({ block: 'center', behavior: 'smooth' }); } catch (e) {} const g = () => { const b = el.getBoundingClientRect(); r.style.left = (b.left - 4) + 'px'; r.style.top = (b.top - 4) + 'px'; r.style.width = (b.width + 8) + 'px'; r.style.height = (b.height + 8) + 'px'; }; g(); setTimeout(g, 450); return true; }
  function step() {
    if (!T) return; const L = T.L; if (T.i >= L.length) return summary(); const x = L[T.i], nav = Q('.nav-item[data-view="' + x.v + '"]');
    if (nav) { try { nav.click(); } catch (e) {} try { nav.scrollIntoView({ block: 'nearest' }); } catch (e) {} }
    let t = Q('#wnTour'); if (!t) { t = document.createElement('div'); t.id = 'wnTour'; t.dataset.nohc = '1'; document.body.appendChild(t); t.addEventListener('click', e => { const b = e.target.closest('[data-wt]'); if (!b || !T) return; const a = b.dataset.wt; if (a === 'next') { T.i++; step(); } else if (a === 'back') { T.i = Math.max(0, T.i - 1); step(); } else if (a === 'skip') { endTour(); } else if (a === 'done') { seenSet(T.top); endTour(); } else if (a === 'open') { const n = Q('.nav-item[data-view="' + b.dataset.v + '"]'); if (n) n.click(); } else if (a === 'redo') { T.i = 0; step(); } }); }
    t.innerHTML = `<div class="wn-th"><b>${x.ic} ${esc(x.t)}</b><span style="font-size:12px;opacity:.9">${T.i + 1} / ${L.length}</span></div><div class="wn-tb"><div style="font-size:11.5px;color:#64748b;margin-bottom:4px">${esc(x.area)}</div>${esc(x.d)}<ul>${(x.pts || []).map(p => `<li>${esc(p)}</li>`).join('')}</ul></div>
      <div class="wn-tf"><button data-wt="skip">Skip tour</button><span class="sp"></span>${T.i ? '<button data-wt="back">‹ Back</button>' : ''}<button class="wn-go" data-wt="next">${T.i + 1 === L.length ? 'Finish ›' : 'Next ›'}</button></div>`;
    const r0 = Q('#wnRing'); if (r0) r0.remove(); let n = 0; const tr = setInterval(() => { if (!T || L[T.i] !== x) return clearInterval(tr); if (ring(x.sel) || ++n > 14) clearInterval(tr); }, 350); }
  function summary() {
    const r = Q('#wnRing'); if (r) r.remove(); const L = T.L, t = Q('#wnTour'); if (!t) return;
    t.innerHTML = `<div class="wn-th"><b>✅ Summary of the updates</b><span style="font-size:12px;opacity:.9">Update ${esc(serial(T.top))}</span></div><div class="wn-tb">${L.map(x => `<div style="margin:0 0 9px"><b>${x.ic} ${esc(x.t)}</b><div style="font-size:12px;color:#64748b">${esc(x.area)}</div><div style="font-size:12.5px">${esc((x.pts || [])[0] || '')}</div><a href="#" data-wt="open" data-v="${esc(x.v)}" style="font-size:12px">Open this area ›</a></div>`).join('')}<div style="font-size:12px;color:#64748b">You can open this list again at any time with <b>✨ What's new</b> at the bottom of the menu.</div></div>
      <div class="wn-tf"><button data-wt="redo">↺ Tour again</button><span class="sp"></span><button class="wn-go" data-wt="done">Done</button></div>`; }

  /* 3) when: after sign-in (only the areas this user can see, only what he has not seen for this update version) */
  function check() { try { if (typeof currentUser === 'undefined' || !currentUser) return; addBtn(); const L = mine(false); if (L.length) announce(L); } catch (e) {} }
  function addBtn() { const f = Q('.sidebar-footer'); if (!f || Q('#wnBtn')) return; const b = document.createElement('button'); b.id = 'wnBtn'; b.type = 'button'; b.textContent = '✨ What\'s new'; b.title = 'The latest updates in the areas you can see'; b.addEventListener('click', () => announce(mine(true).slice(-12), true)); f.insertBefore(b, f.firstChild); }
  const prev = typeof onLoginComplete === 'function' ? onLoginComplete : null; if (prev) onLoginComplete = function () { const r = prev.apply(this, arguments); setTimeout(check, 2800); return r; };
  window.whatsNew = { WN, mine, announce, startTour, check, seen: seenGet, vis };
})();
