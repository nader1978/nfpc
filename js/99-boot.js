/* ---------- Start-up: runs once every other script has been loaded (these statements depend on functions declared further down the old single file) ---------- */
(async function boot() {
  await loadUsers();
  const existing = loadSession();
  if (existing) {
    currentUser = existing;
    showApp();
    applyPermissions();
    onLoginComplete();
  } else {
    showLogin();
  }
  setInterval(() => { updateTimersUI(); updateUploadTimersUI(); }, 1000);
})();
wLoc_restore();
wLoc_renderPicker();
