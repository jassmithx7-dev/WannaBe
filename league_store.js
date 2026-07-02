// Per-league settings & draft state (keyed by Sleeper league_id)
(function(global) {
  var PROFILES_KEY = 'ff26_leagueProfiles';
  var ACTIVE_KEY = 'ff26_activeLeagueId';

  function getProfiles() {
    try {
      var raw = localStorage.getItem(PROFILES_KEY);
      return raw ? JSON.parse(raw) : {};
    } catch (e) { return {}; }
  }

  function saveProfiles(profiles) {
    localStorage.setItem(PROFILES_KEY, JSON.stringify(profiles || {}));
  }

  function migrateLegacy() {
    var profiles = getProfiles();
    var legacyId = localStorage.getItem('ff26_leagueId');
    if (!legacyId || profiles[legacyId]) return profiles;
    profiles[legacyId] = {
      leagueId: legacyId,
      leagueName: localStorage.getItem('ff26_leagueName') || '',
      draftId: localStorage.getItem('ff26_draftId') || '',
      myTeamIdx: parseInt(localStorage.getItem('ff26_myTeamIdx') || '-1', 10),
      trades: (function() { try { return JSON.parse(localStorage.getItem('ff26_trades') || '[]'); } catch (e) { return []; } })(),
      teamNames: (function() { try { return JSON.parse(localStorage.getItem('ff26_teamNames') || '[]'); } catch (e) { return []; } })(),
      posLimits: (function() { try { return JSON.parse(localStorage.getItem('ff26_posLimits') || '{}'); } catch (e) { return {}; } })()
    };
    saveProfiles(profiles);
    if (!localStorage.getItem(ACTIVE_KEY)) localStorage.setItem(ACTIVE_KEY, legacyId);
    return profiles;
  }

  function getProfile(leagueId) {
    if (!leagueId) return null;
    migrateLegacy();
    return getProfiles()[leagueId] || null;
  }

  function saveProfile(leagueId, patch) {
    if (!leagueId) return null;
    migrateLegacy();
    var profiles = getProfiles();
    var cur = profiles[leagueId] || { leagueId: leagueId };
    profiles[leagueId] = Object.assign({}, cur, patch, { leagueId: leagueId, updatedAt: Date.now() });
    saveProfiles(profiles);
    return profiles[leagueId];
  }

  function ensureProfile(leagueId, seed) {
    if (!leagueId) return null;
    var p = getProfile(leagueId);
    if (p) return p;
    return saveProfile(leagueId, seed || {});
  }

  function getActiveId() {
    migrateLegacy();
    var id = localStorage.getItem(ACTIVE_KEY);
    if (id) return id;
    try {
      var ac = JSON.parse(localStorage.getItem('dc_activeLeague') || 'null');
      if (ac && ac.leagueId) return ac.leagueId;
    } catch (e) {}
    return localStorage.getItem('ff26_leagueId') || '';
  }

  function setActiveId(leagueId) {
    if (leagueId) localStorage.setItem(ACTIVE_KEY, leagueId);
  }

  global.LeagueStore = {
    getProfiles: getProfiles,
    getProfile: getProfile,
    saveProfile: saveProfile,
    ensureProfile: ensureProfile,
    getActiveId: getActiveId,
    setActiveId: setActiveId,
    migrateLegacy: migrateLegacy
  };
})(window);
