
window.onerror = function(msg, src, line, col, err) {
  console.error('[Global Error]', msg, 'at line', line);
};

// ── Supabase Auth ──
const SUPA_URL = 'https://cbjzvazwkkpjwobiqxsf.supabase.co';
const SUPA_KEY = 'sb_publishable_Wy-lbd-fC5ujiMI0m6SGpw_oEXnpTaj';
let supa = null;
let currentUser = null;

function initSupabase() {
  if (typeof supabase !== 'undefined' && supabase.createClient) {
    try {
      supa = supabase.createClient(SUPA_URL, SUPA_KEY);
      console.log('[Supabase] Client initialized');
      return true;
    } catch(e) {
      console.error('[Supabase] createClient failed:', e);
      return false;
    }
  }
  // Load SDK lazily if not yet loaded
  return false;
}

function loadSupabaseSDK(callback) {
  if (typeof supabase !== 'undefined') { callback(); return; }
  var s = document.createElement('script');
  s.src = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.min.js';
  s.onload = function() { 
    console.log('[Supabase] SDK loaded');
    if(initSupabase()) callback();
    else console.error('[Supabase] Failed to init after load');
  };
  s.onerror = function() { console.error('[Supabase] SDK failed to load'); };
  document.head.appendChild(s);
}

function showAuthError(msg) {
  const el = document.getElementById('authError');
  if (!msg) { el.style.display = 'none'; return; }
  el.textContent = msg; el.style.display = 'block';
  document.getElementById('authSuccess').style.display = 'none';
}
function showAuthSuccess(msg) {
  const el = document.getElementById('authSuccess');
  if (!msg) { el.style.display = 'none'; return; }
  el.textContent = msg; el.style.display = 'block';
  document.getElementById('authError').style.display = 'none';
}

async function signIn() {
  showAuthError('');
  if (!supa) {
    loadSupabaseSDK(async function() { await signIn(); });
    showAuthError('Loading auth service...');
    return;
  }
  const email = document.getElementById('authEmail').value.trim();
  const password = document.getElementById('authPassword').value;
  if (!email || !password) { showAuthError('Enter email and password'); return; }
  const { data, error } = await supa.auth.signInWithPassword({ email, password });
  if (error) { showAuthError(error.message); return; }
  await onSignedIn(data.user);
}

async function signUp() {
  showAuthError('');
  showAuthSuccess('Connecting...');
  
  // Step 1: Check SDK loaded
  if (typeof supabase === 'undefined') {
    showAuthError('ERROR: Supabase SDK not loaded. Check internet connection.');
    return;
  }
  
  // Step 2: Init client
  if (!supa) {
    try { supa = supabase.createClient(SUPA_URL, SUPA_KEY); }
    catch(e) { showAuthError('ERROR initializing auth: ' + e.message); return; }
  }
  
  const email = document.getElementById('authEmail').value.trim();
  const password = document.getElementById('authPassword').value;
  if (!email || !password) { showAuthError('Enter email and password'); return; }
  if (password.length < 6) { showAuthError('Password must be at least 6 characters'); return; }
  
  showAuthSuccess('Creating account...');
  try {
    const { data, error } = await supa.auth.signUp({ email, password });
    if (error) { showAuthError('Signup error: ' + error.message + ' (code: ' + (error.status||'?') + ')'); return; }
    if (!data || !data.user) { showAuthError('No user returned — check Supabase URL configuration'); return; }
    if (data.user && !data.user.confirmed_at) {
      showAuthSuccess('✅ Account created! Check your email to confirm, then sign in.');
    } else {
      await onSignedIn(data.user);
    }
  } catch(e) {
    showAuthError('Network error: ' + e.message);
  }
}

async function signOut() {
  await supa.auth.signOut();
  currentUser = null;
  document.getElementById('userBar').style.display = 'none';
  document.getElementById('authModal').style.display = 'flex';
}

function continueAsGuest() {
  document.getElementById('authModal').style.display = 'none';
  document.getElementById('userBar').style.display = 'none';
}

async function onSignedIn(user) {
  currentUser = user;
  document.getElementById('authModal').style.display = 'none';
  document.getElementById('userBar').style.display = 'flex';
  document.getElementById('userEmail').textContent = user.email;
  // Load saved settings from Supabase
  await loadUserSettings();
}

async function saveUserSettings() {
  if (!currentUser) { alert('Sign in to save settings'); return; }
  const settings = {
    user_id: currentUser.id,
    sleeper_league_id: sleeperLeagueId || '',
    sleeper_draft_id: sleeperDraftId || '',
    anthropic_key: apiKey || '',
    my_team_idx: myTeamIdx >= 0 ? myTeamIdx : null,
    team_names: JSON.stringify(teamNames),
    updated_at: new Date().toISOString()
  };
  const { error } = await supa.from('user_settings').upsert(settings, { onConflict: 'user_id' });
  if (error) {
    console.error('Save error:', error);
    alert('Save failed: ' + error.message);
  } else {
    const btn = document.querySelector('#userBar button');
    if (btn) { const orig = btn.textContent; btn.textContent = '✅ Saved!'; setTimeout(()=>btn.textContent=orig, 2000); }
  }
}

async function loadUserSettings() {
  if (!currentUser) return;
  const { data, error } = await supa.from('user_settings').select('*').eq('user_id', currentUser.id).single();
  if (error) {
    if (error.code === 'PGRST116') {
      console.log('[Supabase] No settings saved yet for this user');
    } else {
      console.error('[Supabase] Load error:', error.message, '— Run the SQL setup in Supabase dashboard');
    }
    return;
  }
  if (!data) return;

  // Restore settings
  if (data.sleeper_league_id) {
    sleeperLeagueId = data.sleeper_league_id;
    localStorage.setItem('ff26_leagueId', sleeperLeagueId);
    const li = document.getElementById('sleeperLeagueInput');
    if (li) li.value = sleeperLeagueId;
  }
  if (data.sleeper_draft_id) {
    sleeperDraftId = data.sleeper_draft_id;
    localStorage.setItem('ff26_draftId', sleeperDraftId);
    const di = document.getElementById('sleeperDraftInput');
    if (di) di.value = sleeperDraftId;
  }
  if (data.anthropic_key) {
    apiKey = data.anthropic_key;
    localStorage.setItem('ff26_apiKey', apiKey);
    showKeyActive();
  }
  if (data.my_team_idx !== null && data.my_team_idx !== undefined) {
    myTeamIdx = data.my_team_idx;
    const sel = document.getElementById('myTeamSel');
    if (sel) sel.value = myTeamIdx;
  }
  if (data.team_names) {
    try {
      const names = JSON.parse(data.team_names);
      if (Array.isArray(names)) {
        names.forEach((n,i) => { if(i < teamNames.length) teamNames[i] = n; });
        // Refresh dropdown
        const sel = document.getElementById('myTeamSel');
        if (sel) {
          sel.innerHTML = '<option value="-1">— Select your team —</option>';
          teamNames.forEach((n,i) => {
            const o = document.createElement('option');
            o.value = i; o.text = n;
            if (i === myTeamIdx) o.selected = true;
            sel.appendChild(o);
          });
        }
      }
    } catch(e) {}
  }
  renderAll();
  console.log('[Auth] Settings loaded for', currentUser.email);
}

// Check if already signed in on page load
async function checkSession() {
  if (!supa) {
    loadSupabaseSDK(async function() { await checkSession(); });
    document.getElementById('authModal').style.display = 'flex';
    return;
  }
  const { data } = await supa.auth.getSession();
  if (data.session && data.session.user) {
    await onSignedIn(data.session.user);
  } else {
    document.getElementById('authModal').style.display = 'flex';
  }
}

const BASE_PLAYERS=[
  {rank:1,name:"Josh Allen",team:"BUF",pos:"QB",bye:"TBD",adp:1,sf:1,note:"Joe Brady HC \u2014 elite rushing QB, SF lock"},
  {rank:2,name:"Lamar Jackson",team:"BAL",pos:"QB",bye:"TBD",adp:2,sf:2,note:"Jesse Minter HC \u2014 2x MVP, rushing floor unmatched"},
  {rank:3,name:"Jayden Daniels",team:"WAS",pos:"QB",bye:"TBD",adp:4,sf:3,note:"Dan Quinn HC \u2014 elite rusher, Blough OC"},
  {rank:4,name:"Drake Maye",team:"NE",pos:"QB",bye:"TBD",adp:6,sf:4,note:"Vrabel HC yr 2 \u2014 massive leap expected"},
  {rank:5,name:"Jalen Hurts",team:"PHI",pos:"QB",bye:"TBD",adp:8,sf:5,note:"Sirianni HC \u2014 best OL, SF locked starter"},
  {rank:6,name:"Joe Burrow",team:"CIN",pos:"QB",bye:"TBD",adp:9,sf:6,note:"Zac Taylor \u2014 top-5 QB when healthy"},
  {rank:7,name:"Jaxson Dart",team:"NYG",pos:"QB",bye:"TBD",adp:18,sf:7,note:"John Harbaugh HC \u2014 high upside rookie"},
  {rank:8,name:"Brock Purdy",team:"SF",pos:"QB",bye:"TBD",adp:22,sf:8,note:"Shanahan HC \u2014 Kubiak OC"},
  {rank:9,name:"Trevor Lawrence",team:"JAX",pos:"QB",bye:"TBD",adp:25,sf:9,note:"Liam Coen HC \u2014 contract year motivation"},
  {rank:10,name:"Bo Nix",team:"DEN",pos:"QB",bye:"TBD",adp:28,sf:10,note:"Payton HC yr 3 \u2014 elite pass protection"},
  {rank:11,name:"Caleb Williams",team:"CHI",pos:"QB",bye:"TBD",adp:30,sf:11,note:"Ben Johnson HC yr 2 \u2014 massive leap"},
  {rank:12,name:"Patrick Mahomes",team:"KC",pos:"QB",bye:"TBD",adp:32,sf:12,note:"Reid/Bieniemy \u2014 GOAT floor"},
  {rank:13,name:"Dak Prescott",team:"DAL",pos:"QB",bye:"TBD",adp:35,sf:13,note:"Schottenheimer \u2014 pass-heavy, comeback yr"},
  {rank:14,name:"Kyler Murray",team:"MIN",pos:"QB",bye:"TBD",adp:40,sf:14,note:"O’Connell HC \u2014 scheme fit"},
  {rank:15,name:"Jordan Love",team:"GB",pos:"QB",bye:"TBD",adp:45,sf:15,note:"LaFleur \u2014 bounce-back"},
  {rank:16,name:"Justin Herbert",team:"LAC",pos:"QB",bye:"TBD",adp:48,sf:16,note:"Harbaugh yr 2 \u2014 McDaniel OC"},
  {rank:17,name:"Baker Mayfield",team:"TB",pos:"QB",bye:"TBD",adp:55,sf:17,note:"Bowles/Robinson \u2014 proven system"},
  {rank:18,name:"Bijan Robinson",team:"ATL",pos:"RB",bye:"TBD",adp:3,sf:20,note:"Stefanski HC \u2014 RB1 consensus"},
  {rank:19,name:"Jahmyr Gibbs",team:"DET",pos:"RB",bye:"TBD",adp:5,sf:21,note:"Campbell \u2014 Drew Petzing OC"},
  {rank:20,name:"Christian McCaffrey",team:"SF",pos:"RB",bye:"TBD",adp:6,sf:22,note:"Shanahan zone \u2014 health key"},
  {rank:21,name:"Jonathan Taylor",team:"IND",pos:"RB",bye:"TBD",adp:8,sf:23,note:"Steichen \u2014 Quenton Nelson LG"},
  {rank:22,name:"De’Von Achane",team:"MIA",pos:"RB",bye:"TBD",adp:10,sf:24,note:"Hafley HC \u2014 explosive playmaker"},
  {rank:23,name:"James Cook",team:"BUF",pos:"RB",bye:"TBD",adp:12,sf:25,note:"Joe Brady HC \u2014 elite OL"},
  {rank:24,name:"Ashton Jeanty",team:"LV",pos:"RB",bye:"TBD",adp:13,sf:26,note:"Kubiak HC \u2014 run-first scheme"},
  {rank:25,name:"Saquon Barkley",team:"PHI",pos:"RB",bye:"TBD",adp:15,sf:27,note:"Sirianni \u2014 best OL, elite"},
  {rank:26,name:"Chase Brown",team:"CIN",pos:"RB",bye:"TBD",adp:20,sf:30,note:"Burrow health key"},
  {rank:27,name:"Kenneth Walker III",team:"KC",pos:"RB",bye:"TBD",adp:22,sf:31,note:"Reid/Bieniemy \u2014 new team"},
  {rank:28,name:"Derrick Henry",team:"BAL",pos:"RB",bye:"TBD",adp:24,sf:32,note:"Minter HC \u2014 power run"},
  {rank:29,name:"Breece Hall",team:"NYJ",pos:"RB",bye:"TBD",adp:26,sf:33,note:"Glenn yr 2 \u2014 Reich OC"},
  {rank:30,name:"Travis Etienne",team:"NO",pos:"RB",bye:"TBD",adp:28,sf:34,note:"Moore HC \u2014 Nussmeier OC"},
  {rank:31,name:"Omarion Hampton",team:"LAC",pos:"RB",bye:"TBD",adp:30,sf:35,note:"Harbaugh \u2014 power run"},
  {rank:32,name:"Javonte Williams",team:"DAL",pos:"RB",bye:"TBD",adp:32,sf:36,note:"Schottenheimer \u2014 Adams OC"},
  {rank:33,name:"Quinshon Judkins",team:"CLE",pos:"RB",bye:"TBD",adp:35,sf:37,note:"Monken HC \u2014 run-focused"},
  {rank:34,name:"Kyren Williams",team:"LAR",pos:"RB",bye:"TBD",adp:38,sf:38,note:"McVay \u2014 Scheelhaase OC"},
  {rank:35,name:"Cam Skattebo",team:"NYG",pos:"RB",bye:"TBD",adp:40,sf:39,note:"J. Harbaugh HC \u2014 Nagy OC"},
  {rank:36,name:"Bucky Irving",team:"TB",pos:"RB",bye:"TBD",adp:42,sf:40,note:"Bowles \u2014 Robinson OC"},
  {rank:37,name:"Chuba Hubbard",team:"CAR",pos:"RB",bye:"TBD",adp:45,sf:41,note:"Canales \u2014 Idzik OC"},
  {rank:38,name:"Ja’Marr Chase",team:"CIN",pos:"WR",bye:"TBD",adp:2,sf:19,note:"Burrow connection \u2014 elite route runner"},
  {rank:39,name:"Puka Nacua",team:"LAR",pos:"WR",bye:"TBD",adp:7,sf:28,note:"McVay \u2014 Scheelhaase OC"},
  {rank:40,name:"Jaxon Smith-Njigba",team:"SEA",pos:"WR",bye:"TBD",adp:9,sf:29,note:"Macdonald \u2014 Grubb OC"},
  {rank:41,name:"Amon-Ra St. Brown",team:"DET",pos:"WR",bye:"TBD",adp:11,sf:42,note:"Campbell \u2014 Petzing OC"},
  {rank:42,name:"CeeDee Lamb",team:"DAL",pos:"WR",bye:"TBD",adp:14,sf:43,note:"Schottenheimer \u2014 pass-heavy"},
  {rank:43,name:"Justin Jefferson",team:"MIN",pos:"WR",bye:"TBD",adp:16,sf:44,note:"O’Connell \u2014 Murray QB"},
  {rank:44,name:"Drake London",team:"ATL",pos:"WR",bye:"TBD",adp:18,sf:45,note:"Stefanski \u2014 Rees OC"},
  {rank:45,name:"Malik Nabers",team:"NYG",pos:"WR",bye:"TBD",adp:19,sf:46,note:"J. Harbaugh \u2014 Dart QB"},
  {rank:46,name:"Rashee Rice",team:"KC",pos:"WR",bye:"TBD",adp:21,sf:47,note:"Reid/Bieniemy \u2014 Mahomes"},
  {rank:47,name:"Chris Olave",team:"NO",pos:"WR",bye:"TBD",adp:23,sf:48,note:"Moore HC \u2014 Nussmeier OC"},
  {rank:48,name:"George Pickens",team:"DAL",pos:"WR",bye:"TBD",adp:25,sf:49,note:"Schottenheimer \u2014 new team"},
  {rank:49,name:"A.J. Brown",team:"NE",pos:"WR",bye:"TBD",adp:27,sf:50,note:"Vrabel \u2014 new team"},
  {rank:50,name:"Nico Collins",team:"HOU",pos:"WR",bye:"TBD",adp:29,sf:51,note:"Ryans \u2014 elite target share"},
  {rank:51,name:"Garrett Wilson",team:"NYJ",pos:"WR",bye:"TBD",adp:31,sf:52,note:"Glenn \u2014 Reich OC"},
  {rank:52,name:"DeVonta Smith",team:"PHI",pos:"WR",bye:"TBD",adp:33,sf:53,note:"Sirianni \u2014 best OL"},
  {rank:53,name:"Jaylen Waddle",team:"DEN",pos:"WR",bye:"TBD",adp:35,sf:54,note:"Payton \u2014 elite OL"},
  {rank:54,name:"Rome Odunze",team:"CHI",pos:"WR",bye:"TBD",adp:37,sf:55,note:"Ben Johnson \u2014 Taylor OC"},
  {rank:55,name:"Zay Flowers",team:"BAL",pos:"WR",bye:"TBD",adp:39,sf:56,note:"Minter HC \u2014 Jackson QB"},
  {rank:56,name:"Davante Adams",team:"LAR",pos:"WR",bye:"TBD",adp:41,sf:57,note:"McVay \u2014 Scheelhaase OC"},
  {rank:57,name:"Brock Bowers",team:"LV",pos:"TE",bye:"TBD",adp:10,sf:58,note:"Kubiak HC \u2014 elite TE talent"},
  {rank:58,name:"Harold Fannin Jr.",team:"CLE",pos:"TE",bye:"TBD",adp:22,sf:59,note:"Monken HC \u2014 breakout"},
  {rank:59,name:"Tyler Warren",team:"IND",pos:"TE",bye:"TBD",adp:25,sf:60,note:"Steichen \u2014 Nelson OL"},
  {rank:60,name:"Sam LaPorta",team:"DET",pos:"TE",bye:"TBD",adp:28,sf:61,note:"Campbell \u2014 Petzing OC"},
  {rank:61,name:"Trey McBride",team:"ARI",pos:"TE",bye:"TBD",adp:30,sf:62,note:"M. LaFleur HC \u2014 Hackett OC"},
  {rank:62,name:"Travis Kelce",team:"KC",pos:"TE",bye:"TBD",adp:33,sf:63,note:"Reid/Bieniemy \u2014 age concern"},
  {rank:63,name:"Isaiah Likely",team:"BAL",pos:"TE",bye:"TBD",adp:36,sf:64,note:"Minter HC \u2014 new role"},
  {rank:64,name:"Jake Ferguson",team:"DAL",pos:"TE",bye:"TBD",adp:38,sf:65,note:"Schottenheimer \u2014 Adams OC"},
  {rank:65,name:"D’Andre Swift",team:"CHI",pos:"RB",bye:"TBD",adp:55,sf:70,note:"Johnson yr 2"},
  {rank:66,name:"Aaron Jones",team:"MIN",pos:"RB",bye:"TBD",adp:58,sf:72,note:"O'Connell — vet"},
  {rank:67,name:"Tony Pollard",team:"TEN",pos:"RB",bye:"TBD",adp:60,sf:74,note:"Callahan HC"},
  {rank:68,name:"Rachaad White",team:"TB",pos:"RB",bye:"TBD",adp:62,sf:76,note:"Bowles — pass catcher"},
  {rank:69,name:"Jaleel McLaughlin",team:"DEN",pos:"RB",bye:"TBD",adp:64,sf:78,note:"Payton — committee"},
  {rank:70,name:"Jerome Ford",team:"CLE",pos:"RB",bye:"TBD",adp:66,sf:80,note:"Monken HC"},
  {rank:71,name:"Najee Harris",team:"PIT",pos:"RB",bye:"TBD",adp:68,sf:82,note:"McCarthy — workhorse"},
  {rank:72,name:"Tyjae Spears",team:"TEN",pos:"RB",bye:"TBD",adp:70,sf:84,note:"Callahan — speed"},
  {rank:73,name:"Jaylen Wright",team:"MIA",pos:"RB",bye:"TBD",adp:72,sf:86,note:"Hafley — explosive"},
  {rank:74,name:"Isaac Guerendo",team:"SF",pos:"RB",bye:"TBD",adp:74,sf:88,note:"Shanahan zone"},
  {rank:75,name:"Will Levis",team:"TEN",pos:"QB",bye:"TBD",adp:76,sf:89,note:"Callahan — backup"},
  {rank:76,name:"Gus Edwards",team:"NE",pos:"RB",bye:"TBD",adp:78,sf:90,note:"Vrabel — power"},
  {rank:77,name:"MarShawn Lloyd",team:"GB",pos:"RB",bye:"TBD",adp:80,sf:91,note:"LaFleur — rotational"},
  {rank:78,name:"Blake Corum",team:"LAR",pos:"RB",bye:"TBD",adp:82,sf:92,note:"McVay — committee"},
  {rank:79,name:"Ray Davis",team:"BUF",pos:"RB",bye:"TBD",adp:84,sf:93,note:"Brady — depth"},
  {rank:80,name:"Kimani Vidal",team:"LAC",pos:"RB",bye:"TBD",adp:86,sf:94,note:"Harbaugh — committee"},
  {rank:81,name:"Samaje Perine",team:"DEN",pos:"RB",bye:"TBD",adp:88,sf:95,note:"Payton — PPR back"},
  {rank:82,name:"Hassan Haskins",team:"LAR",pos:"RB",bye:"TBD",adp:90,sf:96,note:"McVay — power"},
  {rank:83,name:"Clyde Edwards-Helaire",team:"KC",pos:"RB",bye:"TBD",adp:92,sf:97,note:"Reid — depth"},
  {rank:84,name:"Elijah Mitchell",team:"SF",pos:"RB",bye:"TBD",adp:94,sf:98,note:"Shanahan — committee"},
  {rank:85,name:"Diontae Johnson",team:"BAL",pos:"WR",bye:"TBD",adp:60,sf:75,note:"Minter HC"},
  {rank:86,name:"Brandon Aiyuk",team:"SF",pos:"WR",bye:"TBD",adp:62,sf:77,note:"Shanahan"},
  {rank:87,name:"Stefon Diggs",team:"HOU",pos:"WR",bye:"TBD",adp:64,sf:79,note:"Ryans"},
  {rank:88,name:"Tyler Lockett",team:"SEA",pos:"WR",bye:"TBD",adp:66,sf:81,note:"Macdonald"},
  {rank:89,name:"Courtland Sutton",team:"DEN",pos:"WR",bye:"TBD",adp:68,sf:83,note:"Payton"},
  {rank:90,name:"Christian Kirk",team:"JAX",pos:"WR",bye:"TBD",adp:70,sf:85,note:"Coen"},
  {rank:91,name:"Curtis Samuel",team:"BUF",pos:"WR",bye:"TBD",adp:72,sf:87,note:"Brady"},
  {rank:92,name:"Michael Pittman Jr.",team:"IND",pos:"WR",bye:"TBD",adp:74,sf:89,note:"Steichen"},
  {rank:93,name:"Quentin Johnston",team:"LAC",pos:"WR",bye:"TBD",adp:76,sf:91,note:"Harbaugh"},
  {rank:94,name:"Wan’Dale Robinson",team:"NYG",pos:"WR",bye:"TBD",adp:78,sf:93,note:"J.Harbaugh"},
  {rank:95,name:"Kadarius Toney",team:"KC",pos:"WR",bye:"TBD",adp:80,sf:95,note:"Reid"},
  {rank:96,name:"Elijah Moore",team:"CLE",pos:"WR",bye:"TBD",adp:82,sf:97,note:"Monken"},
  {rank:97,name:"K.J. Hamler",team:"PIT",pos:"WR",bye:"TBD",adp:84,sf:99,note:"McCarthy"},
  {rank:98,name:"Parris Campbell",team:"NYG",pos:"WR",bye:"TBD",adp:86,sf:101,note:"J.Harbaugh"},
  {rank:99,name:"Marvin Mims Jr.",team:"DEN",pos:"WR",bye:"TBD",adp:88,sf:103,note:"Payton"},
  {rank:100,name:"Jalen Reagor",team:"NE",pos:"WR",bye:"TBD",adp:90,sf:105,note:"Vrabel"},
  {rank:101,name:"Dontayvion Wicks",team:"GB",pos:"WR",bye:"TBD",adp:92,sf:107,note:"LaFleur"},
  {rank:102,name:"Josh Downs",team:"IND",pos:"WR",bye:"TBD",adp:94,sf:109,note:"Steichen"},
  {rank:103,name:"Rashid Shaheed",team:"NO",pos:"WR",bye:"TBD",adp:96,sf:111,note:"Moore HC"},
  {rank:104,name:"Cedric Tillman",team:"CLE",pos:"WR",bye:"TBD",adp:98,sf:113,note:"Monken"},
  {rank:105,name:"Terrace Marshall Jr.",team:"BUF",pos:"WR",bye:"TBD",adp:100,sf:115,note:"Brady"},
  {rank:106,name:"Alec Pierce",team:"IND",pos:"WR",bye:"TBD",adp:102,sf:117,note:"Steichen"},
  {rank:107,name:"Xavier Hutchinson",team:"HOU",pos:"WR",bye:"TBD",adp:104,sf:119,note:"Ryans"},
  {rank:108,name:"Demario Douglas",team:"NE",pos:"WR",bye:"TBD",adp:106,sf:121,note:"Vrabel"},
  {rank:109,name:"Jaleel Scott",team:"BAL",pos:"WR",bye:"TBD",adp:108,sf:123,note:"Minter"},
  {rank:110,name:"Darius Slayton",team:"NYG",pos:"WR",bye:"TBD",adp:110,sf:125,note:"J.Harbaugh"},
  {rank:111,name:"Van Jefferson",team:"ATL",pos:"WR",bye:"TBD",adp:112,sf:127,note:"Stefanski"},
  {rank:112,name:"Tre Tucker",team:"LV",pos:"WR",bye:"TBD",adp:114,sf:129,note:"Carroll"},
  {rank:113,name:"Jaelon Darden",team:"TB",pos:"WR",bye:"TBD",adp:116,sf:131,note:"Bowles"},
  {rank:114,name:"Bo Melton",team:"GB",pos:"WR",bye:"TBD",adp:118,sf:133,note:"LaFleur"},
  {rank:115,name:"Tutu Atwell",team:"LAR",pos:"WR",bye:"TBD",adp:120,sf:135,note:"McVay"},
  {rank:116,name:"Tyquan Thornton",team:"NE",pos:"WR",bye:"TBD",adp:122,sf:137,note:"Vrabel"},
  {rank:117,name:"Jonnu Smith",team:"MIA",pos:"TE",bye:"TBD",adp:55,sf:80,note:"Hafley HC"},
  {rank:118,name:"T.J. Hockenson",team:"MIN",pos:"TE",bye:"TBD",adp:60,sf:82,note:"O'Connell"},
  {rank:119,name:"Cole Kmet",team:"CHI",pos:"TE",bye:"TBD",adp:65,sf:84,note:"B.Johnson"},
  {rank:120,name:"Tucker Kraft",team:"GB",pos:"TE",bye:"TBD",adp:70,sf:86,note:"LaFleur"},
  {rank:121,name:"David Njoku",team:"CLE",pos:"TE",bye:"TBD",adp:75,sf:88,note:"Monken"},
  {rank:122,name:"Taysom Hill",team:"NO",pos:"TE",bye:"TBD",adp:80,sf:90,note:"Moore HC"},
  {rank:123,name:"Cade Otton",team:"TB",pos:"TE",bye:"TBD",adp:85,sf:92,note:"Bowles"},
  {rank:124,name:"Juwan Johnson",team:"NO",pos:"TE",bye:"TBD",adp:90,sf:94,note:"Moore HC"},
  {rank:125,name:"Dalton Kincaid",team:"BUF",pos:"TE",bye:"TBD",adp:95,sf:96,note:"Brady"},
  {rank:126,name:"Hunter Henry",team:"NE",pos:"TE",bye:"TBD",adp:100,sf:98,note:"Vrabel"},
  {rank:127,name:"Gerald Everett",team:"LAC",pos:"TE",bye:"TBD",adp:105,sf:100,note:"Harbaugh"},
  {rank:128,name:"Kyle Pitts",team:"ATL",pos:"TE",bye:"TBD",adp:110,sf:102,note:"Stefanski"},
  {rank:129,name:"Mo Alie-Cox",team:"IND",pos:"TE",bye:"TBD",adp:115,sf:104,note:"Steichen"},
  {rank:130,name:"Adam Trautman",team:"DEN",pos:"TE",bye:"TBD",adp:120,sf:106,note:"Payton"},
  {rank:131,name:"Chigoziem Okonkwo",team:"TEN",pos:"TE",bye:"TBD",adp:125,sf:108,note:"Callahan"},
  {rank:132,name:"Noah Fant",team:"SEA",pos:"TE",bye:"TBD",adp:130,sf:110,note:"Macdonald"},
  {rank:133,name:"Justin Tucker",team:"BAL",pos:"K",bye:"TBD",adp:140,sf:200,note:"Elite — consistent"},
  {rank:134,name:"Harrison Butker",team:"KC",pos:"K",bye:"TBD",adp:145,sf:201,note:"Most reliable"},
  {rank:135,name:"Evan McPherson",team:"CIN",pos:"K",bye:"TBD",adp:150,sf:202,note:"Big leg"},
  {rank:136,name:"Tyler Bass",team:"BUF",pos:"K",bye:"TBD",adp:155,sf:203,note:"Brady HC"},
  {rank:137,name:"Brandon Aubrey",team:"DAL",pos:"K",bye:"TBD",adp:160,sf:204,note:"Schottenheimer"},
  {rank:138,name:"Cameron Dicker",team:"LAC",pos:"K",bye:"TBD",adp:165,sf:205,note:"Harbaugh"},
  {rank:139,name:"Jake Moody",team:"SF",pos:"K",bye:"TBD",adp:170,sf:206,note:"Shanahan"},
  {rank:140,name:"Cairo Santos",team:"CHI",pos:"K",bye:"TBD",adp:175,sf:207,note:"B.Johnson"},
  {rank:141,name:"Greg Joseph",team:"MIN",pos:"K",bye:"TBD",adp:180,sf:208,note:"O'Connell"},
  {rank:142,name:"Chris Boswell",team:"PIT",pos:"K",bye:"TBD",adp:185,sf:209,note:"McCarthy"},
  {rank:143,name:"Jake Elliott",team:"PHI",pos:"K",bye:"TBD",adp:190,sf:210,note:"Sirianni"},
  {rank:144,name:"Matt Gay",team:"IND",pos:"K",bye:"TBD",adp:195,sf:211,note:"Steichen"},
  {rank:145,name:"Joey Slye",team:"WAS",pos:"K",bye:"TBD",adp:200,sf:212,note:"Quinn"},
  {rank:146,name:"Graham Gano",team:"NYG",pos:"K",bye:"TBD",adp:205,sf:213,note:"J.Harbaugh"},
  {rank:147,name:"San Francisco",team:"SF",pos:"DEF",bye:"TBD",adp:150,sf:215,note:"Shanahan — elite"},
  {rank:148,name:"Dallas",team:"DAL",pos:"DEF",bye:"TBD",adp:155,sf:216,note:"Schottenheimer"},
  {rank:149,name:"Philadelphia",team:"PHI",pos:"DEF",bye:"TBD",adp:160,sf:217,note:"Sirianni"},
  {rank:150,name:"Pittsburgh",team:"PIT",pos:"DEF",bye:"TBD",adp:165,sf:218,note:"McCarthy"},
  {rank:151,name:"Baltimore",team:"BAL",pos:"DEF",bye:"TBD",adp:170,sf:219,note:"Minter HC"},
  {rank:152,name:"Kansas City",team:"KC",pos:"DEF",bye:"TBD",adp:175,sf:220,note:"Reid"},
  {rank:153,name:"New England",team:"NE",pos:"DEF",bye:"TBD",adp:180,sf:221,note:"Vrabel"},
  {rank:154,name:"Cleveland",team:"CLE",pos:"DEF",bye:"TBD",adp:185,sf:222,note:"Monken"},
  {rank:155,name:"Buffalo",team:"BUF",pos:"DEF",bye:"TBD",adp:190,sf:223,note:"Brady"},
  {rank:156,name:"Minnesota",team:"MIN",pos:"DEF",bye:"TBD",adp:195,sf:224,note:"O'Connell"},
  {rank:157,name:"Green Bay",team:"GB",pos:"DEF",bye:"TBD",adp:200,sf:225,note:"LaFleur"},
  {rank:158,name:"Detroit",team:"DET",pos:"DEF",bye:"TBD",adp:205,sf:226,note:"Campbell"},
  {rank:159,name:"Los Angeles Rams",team:"LAR",pos:"DEF",bye:"TBD",adp:210,sf:227,note:"McVay"},
  {rank:160,name:"Denver",team:"DEN",pos:"DEF",bye:"TBD",adp:215,sf:228,note:"Payton"},
  {rank:161,name:"Sam Darnold",team:"SEA",pos:"QB",bye:"TBD",adp:65,sf:40,note:"Macdonald HC"},
  {rank:162,name:"Geno Smith",team:"LV",pos:"QB",bye:"TBD",adp:70,sf:41,note:"Carroll"},
  {rank:163,name:"Daniel Jones",team:"NYJ",pos:"QB",bye:"TBD",adp:75,sf:42,note:"Glenn HC"},
  {rank:164,name:"Deshaun Watson",team:"CLE",pos:"QB",bye:"TBD",adp:80,sf:43,note:"Monken HC"},
  {rank:165,name:"Tua Tagovailoa",team:"MIA",pos:"QB",bye:"TBD",adp:85,sf:44,note:"Hafley HC"},
  {rank:166,name:"Aaron Rodgers",team:"NYJ",pos:"QB",bye:"TBD",adp:90,sf:45,note:"Glenn HC"},
  {rank:167,name:"Russell Wilson",team:"PIT",pos:"QB",bye:"TBD",adp:95,sf:46,note:"McCarthy HC"}
];;

const RSLOTS=[
  {l:"QB",sf:false},{l:"RB",sf:false},{l:"WR",sf:false},{l:"WR",sf:false},
  {l:"TE",sf:false},{l:"W/R/T Flex",sf:false},{l:"W/R Flex",sf:false},
  {l:"W/R/T/Q SF",sf:true},{l:"K",sf:false},{l:"DEF",sf:false},
  {l:"BN 1",sf:false},{l:"BN 2",sf:false},{l:"BN 3",sf:false},{l:"BN 4",sf:false},
  {l:"BN 5",sf:false},{l:"BN 6",sf:false},{l:"BN 7",sf:false},{l:"BN 8",sf:false}
];

const SCHEME_FIT = {
  'Josh Allen': {grade:'A', bg:'#1a3a2a', color:'#4ade80'},
  'Lamar Jackson': {grade:'A', bg:'#1a3a2a', color:'#4ade80'},
  'Jayden Daniels': {grade:'B+', bg:'#1e2d1a', color:'#86efac'},
  'Drake Maye': {grade:'B', bg:'#1e2d1a', color:'#86efac'},
  'Jalen Hurts': {grade:'A+', bg:'#1a3a2a', color:'#4ade80'},
  'Joe Burrow': {grade:'B', bg:'#1e2d1a', color:'#86efac'},
  'Jaxson Dart': {grade:'B', bg:'#1e2d1a', color:'#86efac'},
  'Brock Purdy': {grade:'A', bg:'#1a3a2a', color:'#4ade80'},
  'Trevor Lawrence': {grade:'B', bg:'#1e2d1a', color:'#86efac'},
  'Bo Nix': {grade:'A', bg:'#1a3a2a', color:'#4ade80'},
  'Caleb Williams': {grade:'B+', bg:'#1e2d1a', color:'#86efac'},
  'Patrick Mahomes': {grade:'B+', bg:'#1e2d1a', color:'#86efac'},
  'Dak Prescott': {grade:'B', bg:'#1e2d1a', color:'#86efac'},
  'Kyler Murray': {grade:'B+', bg:'#1e2d1a', color:'#86efac'},
  'Jordan Love': {grade:'B', bg:'#1e2d1a', color:'#86efac'},
  'Justin Herbert': {grade:'B+', bg:'#1e2d1a', color:'#86efac'},
  'Baker Mayfield': {grade:'B', bg:'#1e2d1a', color:'#86efac'},
  'Bijan Robinson': {grade:'B', bg:'#1e2d1a', color:'#86efac'},
  'Jahmyr Gibbs': {grade:'A', bg:'#1a3a2a', color:'#4ade80'},
  'Christian McCaffrey': {grade:'A', bg:'#1a3a2a', color:'#4ade80'},
  'Jonathan Taylor': {grade:'A', bg:'#1a3a2a', color:'#4ade80'},
  'De’Von Achane': {grade:'C+', bg:'#2d1f1a', color:'#fb923c'},
  'James Cook': {grade:'A', bg:'#1a3a2a', color:'#4ade80'},
  'Ashton Jeanty': {grade:'C', bg:'#2d1f1a', color:'#fb923c'},
  'Saquon Barkley': {grade:'A+', bg:'#1a3a2a', color:'#4ade80'},
  'Chase Brown': {grade:'C+', bg:'#2d1f1a', color:'#fb923c'},
  'Kenneth Walker III': {grade:'B+', bg:'#1e2d1a', color:'#86efac'},
  'Derrick Henry': {grade:'B+', bg:'#1e2d1a', color:'#86efac'},
  'Breece Hall': {grade:'C', bg:'#2d1f1a', color:'#fb923c'},
  'Travis Etienne': {grade:'C+', bg:'#2d1f1a', color:'#fb923c'},
  'Omarion Hampton': {grade:'B+', bg:'#1e2d1a', color:'#86efac'},
  'Javonte Williams': {grade:'B', bg:'#1e2d1a', color:'#86efac'},
  'Quinshon Judkins': {grade:'C', bg:'#2d1f1a', color:'#fb923c'},
  'Kyren Williams': {grade:'B', bg:'#1e2d1a', color:'#86efac'},
  'Cam Skattebo': {grade:'B', bg:'#1e2d1a', color:'#86efac'},
  'Bucky Irving': {grade:'B', bg:'#1e2d1a', color:'#86efac'},
  'Chuba Hubbard': {grade:'C', bg:'#2d1f1a', color:'#fb923c'},
  'Ja’Marr Chase': {grade:'B+', bg:'#1e2d1a', color:'#86efac'},
  'Puka Nacua': {grade:'B+', bg:'#1e2d1a', color:'#86efac'},
  'Jaxon Smith-Njigba': {grade:'B', bg:'#1e2d1a', color:'#86efac'},
  'Amon-Ra St. Brown': {grade:'A', bg:'#1a3a2a', color:'#4ade80'},
  'CeeDee Lamb': {grade:'B+', bg:'#1e2d1a', color:'#86efac'},
  'Justin Jefferson': {grade:'A', bg:'#1a3a2a', color:'#4ade80'},
  'Drake London': {grade:'C+', bg:'#2d1f1a', color:'#fb923c'},
  'Malik Nabers': {grade:'B', bg:'#1e2d1a', color:'#86efac'},
  'Rashee Rice': {grade:'B+', bg:'#1e2d1a', color:'#86efac'},
  'Chris Olave': {grade:'C+', bg:'#2d1f1a', color:'#fb923c'},
  'George Pickens': {grade:'B', bg:'#1e2d1a', color:'#86efac'},
  'A.J. Brown': {grade:'C+', bg:'#2d1f1a', color:'#fb923c'},
  'Nico Collins': {grade:'C', bg:'#2d1f1a', color:'#fb923c'},
  'Garrett Wilson': {grade:'C', bg:'#2d1f1a', color:'#fb923c'},
  'DeVonta Smith': {grade:'A', bg:'#1a3a2a', color:'#4ade80'},
  'Jaylen Waddle': {grade:'A', bg:'#1a3a2a', color:'#4ade80'},
  'Rome Odunze': {grade:'B+', bg:'#1e2d1a', color:'#86efac'},
  'Zay Flowers': {grade:'B+', bg:'#1e2d1a', color:'#86efac'},
  'Davante Adams': {grade:'B', bg:'#1e2d1a', color:'#86efac'},
  'Brock Bowers': {grade:'C+', bg:'#2d1f1a', color:'#fb923c'},
  'Harold Fannin Jr.': {grade:'C+', bg:'#2d1f1a', color:'#fb923c'},
  'Tyler Warren': {grade:'A', bg:'#1a3a2a', color:'#4ade80'},
  'Sam LaPorta': {grade:'A', bg:'#1a3a2a', color:'#4ade80'},
  'Trey McBride': {grade:'C', bg:'#2d1f1a', color:'#fb923c'},
  'Travis Kelce': {grade:'B+', bg:'#1e2d1a', color:'#86efac'},
  'Isaiah Likely': {grade:'B+', bg:'#1e2d1a', color:'#86efac'},
  'Jake Ferguson': {grade:'B', bg:'#1e2d1a', color:'#86efac'}
};
const CUSTOM_SCORES = {
  'Lamar Jackson': 469.0,
  'Josh Allen': 466.0,
  'Jalen Hurts': 397.0,
  'Jayden Daniels': 414.0,
  'Joe Burrow': 353.0,
  'Patrick Mahomes': 358.0,
  'Bo Nix': 346.0,
  'Kyler Murray': 350.0,
  'Bijan Robinson': 340.0,
  'Drake Maye': 342.0,
  'Christian McCaffrey': 324.0,
  'Jahmyr Gibbs': 322.0,
  'Caleb Williams': 331.0,
  'Dak Prescott': 321.0,
  'Justin Herbert': 327.0,
  'Trevor Lawrence': 326.0,
  'Brock Purdy': 313.0,
  'Baker Mayfield': 309.0,
  'Jordan Love': 308.0,
  'Saquon Barkley': 302.0,
  'Ja’Marr Chase': 296.0,
  'Amon-Ra St. Brown': 294.0,
  'CeeDee Lamb': 292.0,
  'Jaxson Dart': 292.0,
  'Justin Jefferson': 290.0,
  'Jonathan Taylor': 288.0,
  'James Cook': 285.0,
  'Puka Nacua': 281.0,
  'De’Von Achane': 280.0,
  'Travis Etienne': 274.0,
  'Rashee Rice': 272.0,
  'Breece Hall': 271.0,
  'Malik Nabers': 269.0,
  'Chase Brown': 266.0,
  'Jaxon Smith-Njigba': 265.0,
  'Kyren Williams': 261.0,
  'George Pickens': 257.0,
  'Drake London': 256.0,
  'DeVonta Smith': 251.0,
  'Chris Olave': 250.0,
  'Nico Collins': 249.0,
  'Jaylen Waddle': 249.0,
  'Ashton Jeanty': 248.0,
  'Bucky Irving': 248.0,
  'A.J. Brown': 247.0,
  'Derrick Henry': 245.0,
  'Garrett Wilson': 245.0,
  'Brock Bowers': 245.0,
  'Cam Skattebo': 243.0,
  'Omarion Hampton': 240.0,
  'Javonte Williams': 240.0,
  'Rome Odunze': 240.0,
  'Davante Adams': 239.0,
  'Kenneth Walker III': 236.0,
  'Zay Flowers': 230.0,
  'Quinshon Judkins': 227.0,
  'Chuba Hubbard': 222.0,
  'Harold Fannin Jr.': 220.0,
  'Tyler Warren': 210.0,
  'Trey McBride': 209.0,
  'Sam LaPorta': 208.0,
  'Travis Kelce': 208.0,
  'Isaiah Likely': 184.0,
  'Jake Ferguson': 176.0
,
  'Justin Tucker': 140.0,
  'Harrison Butker': 140.0,
  'Evan McPherson': 140.0,
  'Tyler Bass': 140.0,
  'Brandon Aubrey': 140.0,
  'Cameron Dicker': 140.0,
  'Jake Moody': 140.0,
  'Cairo Santos': 140.0,
  'Greg Joseph': 140.0,
  'Chris Boswell': 140.0,
  'Jake Elliott': 140.0,
  'Matt Gay': 140.0,
  'Joey Slye': 140.0,
  'Graham Gano': 140.0,
  'San Francisco': 120.0,
  'Dallas': 120.0,
  'Philadelphia': 120.0,
  'Pittsburgh': 120.0,
  'Baltimore': 120.0,
  'Kansas City': 120.0,
  'New England': 120.0,
  'Cleveland': 120.0,
  'Buffalo': 120.0,
  'Minnesota': 120.0,
  'Green Bay': 120.0,
  'Detroit': 120.0,
  'Los Angeles Rams': 120.0,
  'Denver': 120.0,
  'D’Andre Swift': 180.0,
  'Aaron Jones': 175.0,
  'Tony Pollard': 170.0,
  'Rachaad White': 165.0,
  'Jaleel McLaughlin': 160.0,
  'Jerome Ford': 155.0,
  'Najee Harris': 150.0,
  'Tyjae Spears': 145.0,
  'Jaylen Wright': 140.0,
  'Isaac Guerendo': 135.0,
  'Will Levis': 130.0,
  'Gus Edwards': 125.0,
  'MarShawn Lloyd': 120.0,
  'Blake Corum': 115.0,
  'Ray Davis': 110.0,
  'Kimani Vidal': 105.0,
  'Samaje Perine': 100.0,
  'Hassan Haskins': 95.0,
  'Clyde Edwards-Helaire': 90.0,
  'Elijah Mitchell': 85.0,
  'Diontae Johnson': 220.0,
  'Brandon Aiyuk': 200.0,
  'Stefon Diggs': 190.0,
  'Tyler Lockett': 180.0,
  'Courtland Sutton': 170.0,
  'Christian Kirk': 160.0,
  'Curtis Samuel': 150.0,
  'Michael Pittman Jr.': 145.0,
  'Quentin Johnston': 140.0,
  'Wan’Dale Robinson': 135.0,
  'Kadarius Toney': 130.0,
  'Elijah Moore': 125.0,
  'K.J. Hamler': 120.0,
  'Parris Campbell': 115.0,
  'Marvin Mims Jr.': 110.0,
  'Jalen Reagor': 105.0,
  'Dontayvion Wicks': 100.0,
  'Josh Downs': 95.0,
  'Rashid Shaheed': 90.0,
  'Cedric Tillman': 85.0,
  'Terrace Marshall Jr.': 80.0,
  'Alec Pierce': 75.0,
  'Xavier Hutchinson': 70.0,
  'Demario Douglas': 65.0,
  'Jaleel Scott': 60.0,
  'Darius Slayton': 58.0,
  'Van Jefferson': 56.0,
  'Tre Tucker': 54.0,
  'Jaelon Darden': 52.0,
  'Bo Melton': 50.0,
  'Tutu Atwell': 48.0,
  'Tyquan Thornton': 46.0,
  'Jonnu Smith': 170.0,
  'T.J. Hockenson': 160.0,
  'Cole Kmet': 150.0,
  'Tucker Kraft': 140.0,
  'David Njoku': 130.0,
  'Taysom Hill': 120.0,
  'Cade Otton': 115.0,
  'Juwan Johnson': 110.0,
  'Dalton Kincaid': 105.0,
  'Hunter Henry': 100.0,
  'Gerald Everett': 95.0,
  'Kyle Pitts': 90.0,
  'Mo Alie-Cox': 85.0,
  'Adam Trautman': 80.0,
  'Chigoziem Okonkwo': 75.0,
  'Noah Fant': 70.0,
  'Sam Darnold': 260.0,
  'Geno Smith': 240.0,
  'Daniel Jones': 220.0,
  'Deshaun Watson': 200.0,
  'Tua Tagovailoa': 190.0,
  'Aaron Rodgers': 180.0,
  'Russell Wilson': 170.0
};

function customRank(name){
  const score=CUSTOM_SCORES[name]||0;
  const sorted=Object.entries(CUSTOM_SCORES).sort((a,b)=>b[1]-a[1]);
  const idx=sorted.findIndex(([n])=>n===name);
  return idx>=0?idx+1:99;
}

// State
var TEAMS=12, ROUNDS=18, TOTAL=216;
let players=[];
let setup=null; // loaded from JSON
let teamNames=["Team 1","Team 2","Team 3","Team 4","Team 5","Team 6","Team 7","Team 8","Team 9","Team 10","Team 11","Team 12"];
let teamSlots=[]; // slot per team index (1-based, 0=unset)
let pickOwners=[]; // pickOwners[pick-1] = teamIdx who owns that pick
let keeperPicks=[]; // {pick,teamIdx,player} — pre-placed keepers
let trades=[];
let myTeamIdx=-1;
let sleeperLeagueId=localStorage.getItem('ff26_leagueId')||'';
let sleeperDraftId=localStorage.getItem('ff26_draftId')||'';
let sleeperSyncing=false;
let currentPick=1;
let pickLog=[]; // {pick,teamIdx,player,pos,nfl,isKeeper,isTraded}
let teamRosters=Array.from({length:TEAMS},()=>[]);
let history=[];

// ── AI state ──
let apiKey = localStorage.getItem('ff26_apiKey') || '';
let apiKeyInput = '';
let editingKey = false;
let aiHistory = [];
let aiLoading = false;
let lastAiMessage = '';
const aiChips = ['Who should I draft?','Am I QB heavy?','What position do I need?','Top VORP gaps?','Is my team balanced?','Bye week concerns?'];


function getNthBest(pos, n) {
  const sorted = [...players].filter(p => p.pos === pos)
    .sort((a,b) => (b.customScore||0) - (a.customScore||0));
  return sorted[n-1] ? (sorted[n-1].customScore || 0) : 0;
}

function calcVORP() {
  // Baselines: QB=16th (Superflex 2QB), RB=32nd, WR=48th, TE=18th
  const repl = {
    QB:  getNthBest('QB', 16),
    RB:  getNthBest('RB', 32),
    WR:  getNthBest('WR', 48),
    TE:  getNthBest('TE', 18),
    K:   getNthBest('K',  12),
    DEF: getNthBest('DEF',12),
  };

  players.forEach(p => {
    let base = repl[p.pos] || 0;
    // Superflex QB premium — QB value is at least 82% of baseline
    if (p.pos === 'QB') base = Math.max(base, repl.QB * 0.82);
    p.vorp = Math.round((p.customScore || 0) - base);
    p.vorpPerGame = ((p.vorp || 0) / 17).toFixed(1);
  });

  const sorted = [...players].sort((a,b) => (b.vorp||0) - (a.vorp||0));
  sorted.forEach((p, i) => { p.vorpRank = i + 1; });
}

function initPlayers(){
  players=BASE_PLAYERS.map(p=>({...p,drafted:false,customRank:customRank(p.name),customScore:CUSTOM_SCORES[p.name]||0}));
}

function ptRd(pick){return Math.ceil(pick/TEAMS);}
function ptSlotInRound(pick){return pick-(ptRd(pick)-1)*TEAMS;}

// Given slot assignments, compute which teamIdx is on the clock for each pick
function buildPickOwners(){
  pickOwners=[];
  // Build slot->teamIdx map
  const slotMap={};
  teamSlots.forEach((slot,ti)=>{if(slot>0)slotMap[slot]=ti;});
  for(let pick=1;pick<=TOTAL;pick++){
    const rd=ptRd(pick);
    const posInRound=pick-(rd-1)*TEAMS;
    const slot=rd%2===1?posInRound:TEAMS+1-posInRound;
    const ti=slotMap[slot];
    pickOwners.push(ti!==undefined?ti:-1);
  }
  // Apply trades: reassign pick ownership
  trades.forEach(tr=>{
    // Find picks owned by fromTeam in the given round and reassign to toTeam
    for(let pick=1;pick<=TOTAL;pick++){
      if(ptRd(pick)===tr.round&&pickOwners[pick-1]===tr.fromTeam){
        pickOwners[pick-1]=tr.toTeam;
        break; // only reassign one pick per round trade
      }
    }
  });
}

function buildKeeperPicks(){
  keeperPicks=[];
  if(!setup) return;
  setup.teams.forEach((t,ti)=>{
    t.keepers.forEach(k=>{
      if(!k.keeperCost) return;
      // Find the pick that this team owns in keeperCost round
      for(let pick=1;pick<=TOTAL;pick++){
        if(ptRd(pick)===k.keeperCost&&pickOwners[pick-1]===ti){
          // Check not already used
          if(!keeperPicks.find(kp=>kp.pick===pick)){
            keeperPicks.push({pick,teamIdx:ti,player:k.name,pos:k.pos,nfl:k.nflTeam||"?",keeperCost:k.keeperCost});
            // Mark as drafted
            const p=players.find(x=>x.name===k.name);
            if(p) p.drafted=true;
            // Add to team roster
            teamRosters[ti].push({name:k.name,pos:k.pos,team:k.nflTeam||"?",pickNum:pick,rd:k.keeperCost,isKeeper:true,customScore:CUSTOM_SCORES[k.name]||0});
            // Add to pick log
            pickLog.push({pick,rd:k.keeperCost,teamIdx:ti,team:teamNames[ti],player:k.name,pos:k.pos,nfl:k.nflTeam||"?",isKeeper:true});
            break;
          }
        }
      }
    });
  });
  // Advance currentPick past any auto-filled keeper slots at start
  while(currentPick<=TOTAL&&keeperPicks.find(kp=>kp.pick===currentPick)) currentPick++;
}



function applySetup(){
  teamNames=setup.teams.map(t=>t.name);
  teamSlots=setup.teams.map(t=>t.slot||0);
  trades=setup.trades||[];
  teamRosters=Array.from({length:TEAMS},()=>[]);
  pickLog=[];
  currentPick=1;
  history=[];
  initPlayers();
  buildPickOwners();
  buildKeeperPicks();
  // Rebuild myTeamSel
  const sel=document.getElementById("myTeamSel");
  sel.innerHTML='<option value="-1">\u2014 Select \u2014</option>'+teamNames.map((n,i)=>`<option value="${i}">${n}</option>`).join("");
  renderAll();
  renderTradePanel();
}

function setMyTeam(){
  myTeamIdx=parseInt(document.getElementById("myTeamSel").value);
  renderAll();
}

function clockTeamIdx(){
  if(currentPick>TOTAL) return -1;
  return pickOwners[currentPick-1]!=null?pickOwners[currentPick-1]:-1;
}

function isKeeperPick(pick){return keeperPicks.find(kp=>kp.pick===pick);}
isTradedPick=(pick)=>{
  if(!setup||!trades.length) return false;
  const rd=ptRd(pick);
  return trades.some(tr=>tr.round===rd);
};

function draftPlayer(rank){
  // If in mock mode, route to mock draft
  if(document.body.getAttribute('data-mock') === '1') {
    if(!mockState || !mockState.waiting) return; // not your turn
    var rp = players.find(function(x){ return x.rank === rank; });
    if(!rp) return;
    if(rp.drafted) { showPickSuggestions(); return; } // silently refresh suggestions
    executeMockPick(rp);
    return;
  }
  if(currentPick>TOTAL) return;
  // Skip keeper slots
  while(currentPick<=TOTAL&&isKeeperPick(currentPick)) currentPick++;
  if(currentPick>TOTAL) return;
  const p=players.find(x=>x.rank===rank);
  if(!p||p.drafted) return;
  const ti=clockTeamIdx();
  const rd=ptRd(currentPick);
  history.push({pick:currentPick,ti,rank,ps:players.map(x=>({...x})),rosterSlots:[...myRosterSlots],rs:teamRosters.map(r=>[...r]),pl:[...pickLog],cp:currentPick});
  p.drafted=true;
  teamRosters[ti]=[...teamRosters[ti],{...p,pickNum:currentPick,rd,isKeeper:false}];
  // Smart assign to My Roster slot if this is the user's team
  {const myTi2=myTeamIdx!==''?parseInt(myTeamIdx):-1;
   if(ti===myTi2){const result=smartAssign({...p,pickNum:currentPick,rd,isKeeper:false});
     if(!result.success&&document.getElementById('rNote'))document.getElementById('rNote').textContent='⚠️ '+result.message;}}
  pickLog=[...pickLog,{pick:currentPick,rd,teamIdx:ti,team:teamNames[ti]||"?",player:p.name,pos:p.pos,nfl:p.team,isKeeper:false,isTraded:isTradedPick(currentPick)}];
  currentPick++;
  while(currentPick<=TOTAL&&isKeeperPick(currentPick)) currentPick++;
  renderAll();
  setTimeout(()=>{const el=document.getElementById("pLog");const r=el.querySelector(".clk");if(r)r.scrollIntoView({block:"nearest"});},60);
  // Show next pick suggestions (only when it's my pick)
  if(ti===myTeamIdx) setTimeout(showPickSuggestions, 200);
}

function addCustomPlayer(){
  const name=document.getElementById("addName").value.trim();
  const pos=document.getElementById("addPos").value;
  const nfl=document.getElementById("addNfl").value.trim()||"?";
  if(!name) return;
  if(players.find(p=>p.name.toLowerCase()===name.toLowerCase())){alert("Player already in pool.");return;}
  const newRank=players.length+1;
  players.push({rank:newRank,name,team:nfl,pos,bye:"TBD",adp:999,sf:999,note:"Custom add",drafted:false,customRank:999,customScore:0});
  document.getElementById("addName").value="";document.getElementById("addNfl").value="";
  renderBA();
}

function undoPick(){
  if(!history.length) return;
  const last=history.pop();
  players=last.ps.map(x=>({...x}));
  teamRosters=last.rs.map(r=>[...r]);
  pickLog=last.pl;
  currentPick=last.cp;
  if(last.rosterSlots) myRosterSlots=[...last.rosterSlots];
  renderAll();
}

function resetDraft(){
  if(!confirm("Reset entire draft?")) return;
  teamRosters=Array.from({length:TEAMS},()=>[]);
  myRosterSlots=Array(18).fill(null);
  pickLog=[];history=[];currentPick=1;
  initPlayers();
  if(setup){buildPickOwners();buildKeeperPicks();}
  renderAll();
}

function renderClock(){
  const el=document.getElementById("clk");
  if(currentPick>TOTAL){el.textContent="Draft complete!";el.className="clock done";return;}
  const ti=clockTeamIdx();
  const rd=ptRd(currentPick);
  const tname=ti>=0?(teamNames[ti]||"Team "+(ti+1)):"Unknown";
  const me=myTeamIdx>=0&&ti===myTeamIdx;
  const traded=isTradedPick(currentPick);
  el.textContent=`Pick ${currentPick} \u00b7 Rd ${rd} \u00b7 ${tname}${me?" \u2014 YOUR PICK":""}${traded?" [TRADED PICK]":""}`;
  el.className="clock"+(me?" me":"");
  const ta=document.getElementById("tradedAlert");
  if(traded){ta.style.display="block";ta.textContent=`Pick #${currentPick} is a traded pick`;} else ta.style.display="none";
  document.getElementById("pickCounter").textContent=`(${currentPick-1}/${TOTAL} picks made)`;
}

const QB_STATS = {
  'Josh Allen': {pyds:259,ptd:2.1,ryds:38,rtd:0.7},
  'Lamar Jackson': {pyds:229,ptd:1.9,ryds:53,rtd:0.8},
  'Jayden Daniels': {pyds:224,ptd:1.6,ryds:46,rtd:0.6},
  'Jalen Hurts': {pyds:206,ptd:1.5,ryds:36,rtd:0.8},
  'Drake Maye': {pyds:212,ptd:1.5,ryds:26,rtd:0.4},
  'Joe Burrow': {pyds:247,ptd:2.0,ryds:12,rtd:0.1},
  'Patrick Mahomes': {pyds:241,ptd:1.9,ryds:16,rtd:0.2},
  'Bo Nix': {pyds:224,ptd:1.6,ryds:22,rtd:0.3},
  'Caleb Williams': {pyds:212,ptd:1.5,ryds:25,rtd:0.4},
  'Brock Purdy': {pyds:229,ptd:1.6,ryds:9,rtd:0.1},
  'Kyler Murray': {pyds:206,ptd:1.4,ryds:34,rtd:0.5},
  'Dak Prescott': {pyds:224,ptd:1.6,ryds:13,rtd:0.2},
  'Justin Herbert': {pyds:235,ptd:1.6,ryds:13,rtd:0.2},
  'Trevor Lawrence': {pyds:218,ptd:1.5,ryds:19,rtd:0.3},
  'Jordan Love': {pyds:218,ptd:1.6,ryds:13,rtd:0.2},
  'Baker Mayfield': {pyds:224,ptd:1.6,ryds:9,rtd:0.1},
  'Jaxson Dart': {pyds:200,ptd:1.4,ryds:19,rtd:0.3},
  'Sam Darnold': {pyds:188,ptd:1.3,ryds:12,rtd:0.2},
  'Geno Smith': {pyds:176,ptd:1.2,ryds:9,rtd:0.1},
  'Tua Tagovailoa': {pyds:224,ptd:1.6,ryds:5,rtd:0.1},
  'Aaron Rodgers': {pyds:188,ptd:1.3,ryds:6,rtd:0.1},
  'Russell Wilson': {pyds:176,ptd:1.2,ryds:16,rtd:0.2},
  'Daniel Jones': {pyds:165,ptd:1.1,ryds:21,rtd:0.2},
};


// ── Next Pick Suggestions ──
function showPickSuggestions() {
  if (myTeamIdx < 0) return;
  var roster = myRosterSlots.filter(Boolean);
  var available = players.filter(function(p){ return !p.drafted && !p.mockDrafted && p.customScore > 0; });
  
  var qbs = roster.filter(function(p){ return p.pos==='QB'; }).length;
  var rbs = roster.filter(function(p){ return p.pos==='RB'; }).length;
  var wrs = roster.filter(function(p){ return p.pos==='WR'; }).length;
  var tes = roster.filter(function(p){ return p.pos==='TE'; }).length;
  var size = roster.length;
  var rd = Math.ceil(currentPick / TEAMS);

  // Score each available player: VORP + positional need bonus
  var scored = available.map(function(p) {
    var score = p.vorp || 0;
    var reason = '';

    // Position need bonuses
    if (p.pos === 'QB' && qbs === 0 && rd > 3) { score += 40; reason = 'Need QB'; }
    if (p.pos === 'QB' && qbs === 0 && rd <= 3) { score += 15; reason = 'SF value'; }
    if (p.pos === 'QB' && qbs >= 2) { score -= 60; } // too many QBs
    if (p.pos === 'RB' && rbs < 2) { score += 30; reason = 'Need RB'; }
    if (p.pos === 'WR' && wrs < 2) { score += 25; reason = 'Need WR'; }
    if (p.pos === 'TE' && tes === 0 && rd > 3) { score += 35; reason = 'Need TE'; }
    if (p.pos === 'K' && size < 14) { score -= 100; } // too early for K
    if (p.pos === 'DEF' && size < 14) { score -= 100; } // too early for DEF

    // Tier bonus — prefer top-tier players when available
    if (p.tier === 1) score += 20;
    if (p.tier === 2) score += 10;

    return { p: p, score: score, reason: reason };
  });

  scored.sort(function(a,b){ return b.score - a.score; });
  var top3 = scored.slice(0, 3);

  var bar = document.getElementById('suggBar');
  var cards = document.getElementById('suggCards');
  if (!bar || !cards) return;

  var posColors = {QB:'#60a5fa',RB:'#4ade80',WR:'#fb923c',TE:'#c084fc',K:'#fbbf24',DEF:'#94a3b8'};

  // Ensure position diversity in suggestions (don't show 3 WRs)
  var seenPos = {};
  var diverse = [];
  // First pass: one per position
  for (var i = 0; i < scored.length && diverse.length < 3; i++) {
    var pos = scored[i].p.pos;
    if (!seenPos[pos]) { seenPos[pos] = true; diverse.push(scored[i]); }
  }
  // Fill remaining slots if needed
  for (var i = 0; i < scored.length && diverse.length < 3; i++) {
    if (diverse.indexOf(scored[i]) < 0) diverse.push(scored[i]);
  }

  cards.innerHTML = diverse.map(function(item) {
    var p = item.p;
    var color = posColors[p.pos] || '#9ca3af';
    var vorp = p.vorp != null ? (p.vorp > 0 ? '+' : '') + p.vorp.toFixed(0) : '—';
    return '<div class="sugg-card" onclick="if(!players.find(function(x){return x.rank===' + p.rank + '&&x.drafted;})){draftPlayer(' + p.rank + ');}else{showPickSuggestions();}" title="Click to draft ' + p.name + '">' +
      '<div class="sugg-card-pos" style="color:' + color + ';font-size:11px;font-weight:700">' + p.pos +
        (item.reason ? ' <span style="color:#86efac;font-weight:400;font-size:10px">· ' + item.reason + '</span>' : '') + '</div>' +
      '<div class="sugg-card-name" style="font-size:12px;font-weight:600;color:#e8eaf0;margin:2px 0">' + p.name + '</div>' +
      '<div class="sugg-card-meta" style="font-size:10px;color:#6b7280">' + p.team + ' · ' + (p.customScore||0).toFixed(0) + 'pts · VORP ' + vorp + '</div>' +
      '<div style="font-size:10px;color:#4ade80;margin-top:3px;font-weight:600">⚡ Click to draft</div>' +
    '</div>';
  }).join('');

  bar.style.display = 'flex';
}


function renderBA(){
  calcVORP();
  const sort=document.getElementById("sortSel").value;
  const filt=document.getElementById("posFilt").value;
  const fit=document.getElementById("fitFilt").value;
  const q=(document.getElementById("srch").value||"").toLowerCase();
  // Use players directly — they are already references so drafted flag is live
  let list = players.filter(function(p, idx) {
    // Deduplicate by name — keep first occurrence with stats, skip later dupes without
    var key = p.name.toLowerCase();
    var firstWithStats = players.findIndex(function(q) {
      return q.name.toLowerCase() === key && q.customScore > 0;
    });
    // If this player has no stats AND there's a ranked version, skip this one
    if (!p.customScore && firstWithStats >= 0 && firstWithStats !== idx) return false;
    // If this player has no stats AND no ranked version exists, keep it
    return true;
  });
  if(filt!=="ALL") list=list.filter(p=>p.pos===filt);
  if(q) list=list.filter(p=>p.name.toLowerCase().includes(q)||p.team.toLowerCase().includes(q));
  if(fit==="A") list=list.filter(p=>{const f=SCHEME_FIT[p.name];return f&&(f.grade==="A"||f.grade==="A+");});
  if(fit==="B") list=list.filter(p=>{const f=SCHEME_FIT[p.name];return !f||!f.grade.startsWith("C");});
  // Always push unranked players (no projection) to bottom regardless of sort
  const hasScore = p => p.customScore && p.customScore > 0;
  if(sort==="custom") list.sort((a,b)=>{
    if(!hasScore(a)&&hasScore(b)) return 1;
    if(hasScore(a)&&!hasScore(b)) return -1;
    return a.customRank-b.customRank;
  });
  else if(sort==="sf") list.sort((a,b)=>{
    if(!hasScore(a)&&hasScore(b)) return 1;
    if(hasScore(a)&&!hasScore(b)) return -1;
    return (a.sf||999)-(b.sf||999);
  });
  else list.sort((a,b)=>{
    if(!hasScore(a)&&hasScore(b)) return 1;
    if(hasScore(a)&&!hasScore(b)) return -1;
    return a.pos.localeCompare(b.pos)||a.customRank-b.customRank;
  });
  const qbGone=players.filter(p=>p.pos==="QB"&&p.drafted).length;
  document.getElementById("qbAlert").style.display=qbGone>=8?"block":"none";
  document.getElementById("baList").innerHTML=list.map((p,idx)=>{
    const prevTier = idx>0?list[idx-1].tier:null;
    const tierBreakHtml = (p.tier && p.tier!==prevTier) ? `<div style="display:flex;align-items:center;gap:8px;padding:3px 8px;min-width:900px;border-top:1px dashed #2a2d3a;margin-top:2px"><span style="font-size:10px;color:#4b5563;white-space:nowrap">— Tier ${p.tier} —</span></div>` : '';

    const fit=SCHEME_FIT[p.name]||{grade:"?",bg:"#252836",color:"#9ca3af"};
    const sc=p.customScore?p.customScore.toFixed(0):"—";
    const intel = PLAYER_INTEL[p.name] || {};
    const isUrgent = false;
    const olC = intel.ol_grade ? olColor(intel.ol_grade) : {color:'#9ca3af',bg:'#252836'};
    const sosC = intel.sos ? sosColor(intel.sos) : {color:'#9ca3af',bg:'#252836',label:'?'};
    const tendC = intel.tendency ? tendencyColor(intel.tendency) : {color:'#9ca3af',bg:'#252836'};
    const tendShort = intel.tendency === 'Pass-Heavy' ? 'Pass↑' : intel.tendency === 'Pass-First' ? 'Pass' : intel.tendency === 'Run-Heavy' ? 'Run↑' : 'Bal';
    const olLabel = intel.ol_grade ? `${intel.ol_label||'OL'}:${intel.ol_grade}` : '—';
    const sosLabel = intel.sos ? `${intel.sos}` : '—';
    const hasProj = p.customScore && p.customScore > 0;
    const vorpTxt = hasProj ? (p.vorp>0?'+':'')+p.vorp.toFixed(1) : '—';
    const vorpColor = !hasProj ? '#4b5563' : p.vorp>30?'#4ade80':p.vorp>10?'#60a5fa':p.vorp>0?'#9ca3af':'#f87171';
    return tierBreakHtml + `<div class="ba${p.drafted?" out":""}" onclick="draftPlayer(${p.rank})"
      style="display:grid;grid-template-columns:28px 30px 180px 36px 36px 46px 44px 42px 38px 50px 120px 36px 30px;gap:4px;align-items:center;padding:5px 8px;border-bottom:1px solid #1e2130;cursor:${p.drafted?'default':'pointer'};transition:background .1s;min-width:900px"
      title="${p.note} | HC: ${intel.hc||'?'} OC: ${intel.oc||'?'}${p.pos==='QB'?(()=>{const s=QB_STATS[p.name];return s?' | '+Math.round(s.pyds*17).toLocaleString()+'py '+Math.round(s.ptd*17)+'td'+(s.ryds>50?' '+Math.round(s.ryds*17)+'ry '+Math.round(s.rtd*17)+'rtd':'')+'  (proj 2026)':' | '+intel.pass_pct+'% pass team';})():''}">
      <span style="font-size:10px;color:#6b7280;text-align:right">${p.customRank<90?p.customRank:"—"}</span>
      <span class="pos ${p.pos}">${p.pos}</span>
      <span style="font-size:12px;font-weight:500;color:${p.drafted?'#4b5563':'#e8eaf0'};overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${p.name}${p.isKeeper?'<span style="color:#60a5fa;font-size:9px;margin-left:3px">[K]</span>':''}</span>${isUrgent&&!p.drafted?'<span style="font-size:9px;background:#3d1515;color:#fca5a5;padding:1px 4px;border-radius:3px;margin-left:2px;white-space:nowrap;flex-shrink:0">NEED</span>':''}
      <span style="font-size:10px;color:#6b7280;text-align:center">${p.team}</span>
      <span class="fit-badge" style="background:${fit.bg};color:${fit.color}">${fit.grade}</span>
      <span style="font-size:10px;text-align:center;color:${p.drafted?'#4b5563':'#60a5fa'};font-variant-numeric:tabular-nums">${sc}</span>
      <span style="font-size:10px;text-align:center;color:${vorpColor};font-variant-numeric:tabular-nums">${vorpTxt}</span>
      <span style="font-size:9px;font-weight:700;text-align:center;padding:1px 3px;border-radius:3px;background:${olC.bg};color:${olC.color}" title="${intel.ol_label||'OL'} Grade: ${intel.ol_grade||'?'} (Rank #${intel.ol_rank||'?'})">${intel.ol_grade||'?'}</span>
      <span style="font-size:9px;font-weight:600;text-align:center;padding:1px 3px;border-radius:3px;background:${sosC.bg};color:${sosC.color}" title="SoS #${intel.sos||'?'} vs ${intel.sos_label==='pSoS'?'pass':'rush'} defense (1=easiest, 32=hardest)">${sosLabel}</span>
      <span style="font-size:10px;font-weight:600;text-align:center;color:${intel.pass_pct>=60?'#60a5fa':intel.pass_pct<=48?'#4ade80':'#9ca3af'}" title="Team pass rate: ${intel.pass_pct||'?'}% | HC: ${intel.hc||'?'}">${intel.pass_pct?intel.pass_pct+'%':'—'}</span>
      <span style="font-size:9px;color:#9ca3af;white-space:nowrap;overflow:hidden;text-overflow:ellipsis" title="${intel.usage||''}">${p.pos==='QB'?(()=>{const s=QB_STATS[p.name];return s?s.pyds+'py '+s.ptd+'td'+(s.ryds>50?' '+s.ryds+'ry':'')+'/g':'~'+Math.round((intel.pass_pct||55)/100*65)+' att/g';})():(intel.usage||'—')}</span>
      <span style="font-size:10px;color:#6b7280;text-align:center">${p.bye||'TBD'}</span>
      <span style="font-size:9px;font-weight:700;text-align:center;color:${p.tier===1?'#4ade80':p.tier===2?'#60a5fa':p.tier===3?'#fb923c':p.tier===4?'#f87171':'#6b7280'}">${p.tier?'T'+p.tier:'—'}</span>
    </div>`;
  }).join("");
}

function renderLog(){
  const start=Math.max(1,currentPick-10);
  const end=Math.min(TOTAL,currentPick+25);
  let rows="";
  for(let pick=start;pick<=end;pick++){
    const ti=pickOwners[pick-1]!=null?pickOwners[pick-1]:-1;
    const rd=ptRd(pick);
    const log=pickLog.find(l=>l.pick===pick);
    const kp=isKeeperPick(pick);
    const me=myTeamIdx>=0&&ti===myTeamIdx;
    const clk=pick===currentPick;
    const traded=isTradedPick(pick)&&!log&&!kp;
    let cls="pr"+(clk?" clk":log?" done":"")+(me?" me":"")+(kp?" keeper-slot":"")+(traded?" traded":"");
    const tname=ti>=0?(teamNames[ti]||"?"):"?";
    rows+=`<div class="${cls}">
      <span class="pr-num">#${pick}</span><span class="pr-rd">R${rd}</span>
      <div><div class="pr-team">${tname}</div>
      ${kp?`<div class="pr-player" style="color:#60a5fa">[K] ${kp.player} (${kp.pos})</div>`
        :log?`<div class="pr-player"><span class="pos ${log.pos}" style="font-size:9px;padding:1px 3px;margin-right:2px">${log.pos}</span>${log.player} (${log.nfl})</div>`
        :traded?`<div class="pr-player" style="color:#fbbf24">Traded pick</div>`
        :`<div class="pr-empty">\u2014</div>`}
      </div>
    </div>`;
  }
  document.getElementById("pLog").innerHTML=rows;
}

/*OLD*/ function renderRoster_OLD(){
  const ti=myTeamIdx>=0?myTeamIdx:-1;
  const roster=ti>=0?teamRosters[ti]:[];
  const qbs=roster.filter(p=>p.pos==="QB").length;
  document.getElementById("statsBar").innerHTML=`
    <div class="sv"><div class="sv-n">${roster.length}</div><div class="sv-l">Picked</div></div>
    <div class="sv"><div class="sv-n">${ROUNDS-roster.length}</div><div class="sv-l">Left</div></div>
    <div class="sv"><div class="sv-n${qbs>=3?" warn":""}">${qbs}/3</div><div class="sv-l">QBs</div></div>
    <div class="sv"><div class="sv-n">${roster.filter(p=>p.pos==="RB").length}</div><div class="sv-l">RBs</div></div>
    <div class="sv"><div class="sv-n">${roster.filter(p=>p.pos==="WR").length}</div><div class="sv-l">WRs</div></div>
    <div class="sv"><div class="sv-n">${roster.filter(p=>p.pos==="TE").length}</div><div class="sv-l">TEs</div></div>`;
  if(ti<0){document.getElementById("rNote").textContent="Select your team above.";document.getElementById("rList").innerHTML="";return;}
  document.getElementById("rNote").textContent=`${teamNames[ti]} \u00b7 ${roster.length}/${ROUNDS} picks \u00b7 QBs: ${qbs}/3 max`;
  document.getElementById("rList").innerHTML=RSLOTS.map((slot,i)=>{
    const p=roster[i];
    const fit=p?SCHEME_FIT[p.name]:null;
    return `<div class="rslot">
      <span class="rslot-lbl${slot.sf?" sf":""}">${slot.l}</span>
      ${p?`<span class="rslot-p"><span class="pos ${p.pos}" style="font-size:9px">${p.pos}</span>${p.isKeeper?"<span style='font-size:9px;color:#60a5fa;margin:0 2px'>[K]</span>":""}${p.name} <span style="color:#6b7280;font-size:9px">(${p.team||p.nflTeam||"?"})</span>${fit?`<span class="fit-badge" style="background:${fit.bg};color:${fit.color};margin-left:3px">${fit.grade}</span>`:""}</span>`:`<span class="rslot-empty">empty</span>`}
    </div>`;
  }).join("");
}

function renderRoster(){
  const myTi = myTeamIdx >= 0 ? parseInt(myTeamIdx) : -1;
  const filled = myRosterSlots.filter(Boolean);
  const qbs = filled.filter(p => p.pos === 'QB').length;
  const rbs = filled.filter(p => p.pos === 'RB').length;
  const wrs = filled.filter(p => p.pos === 'WR').length;
  const tes = filled.filter(p => p.pos === 'TE').length;
  const startersFilled = myRosterSlots.slice(0,10).filter(Boolean).length;
  const needs = getPositionNeeds();
  const urgentNeeds = needs.filter(n => n.urgent);

  document.getElementById('statsBar').innerHTML=`
    <div class="sv"><div class="sv-n">${filled.length}</div><div class="sv-l">Picked</div></div>
    <div class="sv"><div class="sv-n">${ROUNDS-filled.length}</div><div class="sv-l">Left</div></div>
    <div class="sv"><div class="sv-n${qbs>=3?" warn":""}">${qbs}/3</div><div class="sv-l">QBs</div></div>
    <div class="sv"><div class="sv-n">${rbs}</div><div class="sv-l">RBs</div></div>
    <div class="sv"><div class="sv-n">${wrs}</div><div class="sv-l">WRs</div></div>
    <div class="sv"><div class="sv-n">${tes}</div><div class="sv-l">TEs</div></div>`;

  if(myTi<0){
    document.getElementById('rNote').textContent='Select your team above.';
    document.getElementById('rList').innerHTML='';
    return;
  }

  // Position need alerts
  let alertHtml = '';
  if (urgentNeeds.length) {
    const urgentLabels = urgentNeeds.map(n => `<span style="background:#3d1515;color:#fca5a5;padding:1px 5px;border-radius:3px;font-size:9px;margin:1px">${n.slot}</span>`).join(' ');
    alertHtml = `<div style="padding:4px 10px;background:#2d1515;border-bottom:1px solid #3d1515;font-size:10px;color:#fca5a5;display:flex;align-items:center;gap:4px;flex-wrap:wrap">⚠️ Need starters: ${urgentLabels}</div>`;
  }

  const projTotal = myRosterSlots.slice(0,10).reduce((s,p) => s + (p ? (p.customScore||0) : 0), 0);

  document.getElementById('rNote').textContent = `${teamNames[myTi]} · ${filled.length}/${ROUNDS} picks · Starters: ${startersFilled}/10`;

  const rListEl = document.getElementById('rList');
  rListEl.innerHTML = alertHtml + ROSTER_SLOTS.map((slot, i) => {
    const p = myRosterSlots[i];
    const isEmpty = !p;
    const isStarter = slot.starter;
    const isSf = slot.sf;
    // Color coding for empty slots
    let emptyColor = '#374151';
    let emptyBg = 'transparent';
    if (isEmpty && isStarter) {
      emptyColor = isSf ? '#c084fc' : '#6b7280';
      emptyBg = isSf ? '#1a0a2e' : 'transparent';
    }
    const fit = p ? (SCHEME_FIT[p.name] || null) : null;
    const divider = i === 9 ? 'border-top:2px solid #374151;margin-top:2px;' : '';
    return `<div class="rslot" style="${divider}${isEmpty && isStarter ? 'background:'+emptyBg : ''}">
      <span class="rslot-lbl${isSf?' sf':''}" style="color:${isEmpty && isStarter ? emptyColor : ''}">${slot.label}</span>
      ${p
        ? `<span class="rslot-p">
            <span class="pos ${p.pos}" style="font-size:9px">${p.pos}</span>
            ${p.isKeeper ? '<span style="color:#60a5fa;font-size:9px;margin:0 2px">[K]</span>' : ''}
            <span style="font-size:11px;color:#e8eaf0">${p.name}</span>
            <span style="color:#6b7280;font-size:9px">(${p.team||'?'})</span>
            ${fit ? `<span class="fit-badge" style="background:${fit.bg};color:${fit.color};margin-left:2px">${fit.grade}</span>` : ''}
            <button onclick="moveToRoster(${p.id},'remove')" style="margin-left:auto;background:transparent;border:none;color:#4b5563;cursor:pointer;font-size:9px" title="Remove">✕</button>
           </span>`
        : `<span style="font-size:10px;color:${emptyColor};font-style:italic">${isStarter ? '— open —' : 'bench'}</span>`
      }
    </div>`;
  }).join('') + `<div style="padding:4px 10px;border-top:1px solid #374151;font-size:10px;display:flex;justify-content:space-between;color:#6b7280"><span>Proj starter pts</span><span style="color:#4ade80;font-weight:600">${projTotal.toFixed(0)}</span></div>`;
}

function moveToRoster(playerId, action) {
  if (action === 'remove') {
    removeFromRoster(playerId);
    const p = players.find(x => x.id === playerId);
    renderRoster();
    renderBA();
  }
}
function renderAllTeams(){
  document.getElementById("atList").innerHTML=teamNames.map((tn,ti)=>{
    const roster=teamRosters[ti];
    const slot=teamSlots[ti]||0;
    const me=ti===myTeamIdx;
    return `<div class="at-card${me?" me":""}">
      <div class="at-card-hdr">
        <span class="at-card-name">${tn}${me?" \u2605":""}</span>
        <span class="at-slot">${slot?"Slot "+slot:"No slot"}</span>
      </div>
      <div class="at-picks">${roster.length?roster.map(p=>`<span class="pos ${p.pos}" style="font-size:9px" title="${p.name}">${p.name.split(" ").pop()}${p.isKeeper?"[K]":""}</span>`).join(""):"<span style='font-size:10px;color:#2d3748'>\u2014</span>"}</div>
    </div>`;
  }).join("");
}

function renderQBPanel(){
  const gone=players.filter(p=>p.pos==="QB"&&p.drafted);
  const avail=players.filter(p=>p.pos==="QB"&&!p.drafted).sort((a,b)=>a.customRank-b.customRank);
  const myQBs=myTeamIdx>=0?teamRosters[myTeamIdx].filter(p=>p.pos==="QB"):[];
  document.getElementById("qbPanel").innerHTML=`
    ${gone.length>=8?`<div class="alert">QB run \u2014 ${gone.length} gone. Act now.</div>`:""}
    <div style="font-size:11px;color:#6b7280;margin-bottom:6px">${gone.length} taken \u00b7 ${avail.length} available \u00b7 Your QBs: ${myQBs.length}/3</div>
    ${myQBs.map(p=>`<div style="font-size:11px;padding:3px 0;color:#60a5fa">\u2713 ${p.name} (${p.team||"?"}) Rd ${p.rd}${p.isKeeper?" [K]":""}</div>`).join("")}
    <div style="font-size:10px;font-weight:600;color:#6b7280;text-transform:uppercase;margin:6px 0 3px">Available QBs</div>
    ${avail.map(p=>{const fit=SCHEME_FIT[p.name]||{grade:"?",bg:"#252836",color:"#9ca3af"};return`<div class="qb-row">
      <span style="font-size:10px;color:#6b7280;width:18px">${p.customRank}</span>
      <span style="font-size:12px;font-weight:500;flex:1">${p.name}</span>
      <span style="font-size:10px;color:#6b7280;width:28px">${p.team}</span>
      <span class="fit-badge" style="background:${fit.bg};color:${fit.color}">${fit.grade}</span>
      <span style="font-size:9px;color:#4b5563;flex:1.5;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${p.note.substring(0,28)}</span>
      <button class="qb-btn" onclick="draftPlayer(${p.rank})">Draft</button>
    </div>`}).join("")}
    ${gone.length?`<div style="font-size:10px;font-weight:600;color:#6b7280;text-transform:uppercase;margin:8px 0 3px">Taken</div>${gone.map(p=>`<div style="font-size:10px;color:#374151;padding:2px 0;text-decoration:line-through">${p.name} (${p.team})</div>`).join("")}`:""}`;
}

function renderTradePanel(){
  if(!trades||!trades.length){
    document.getElementById("tradePanel").innerHTML="<p style='font-size:12px;color:#4b5563;font-style:italic'>No pick trades recorded. Load a setup file to see trades.</p>";
    return;
  }
  document.getElementById("tradePanel").innerHTML=`
    <div class="info-box">Pick trades affect the draft board \u2014 traded pick slots are marked in the pick log.</div>
    ${trades.map(tr=>{
      const fromName=teamNames[tr.fromTeam]||"Team "+(tr.fromTeam+1);
      const toName=teamNames[tr.toTeam]||"Team "+(tr.toTeam+1);
      const rd=["1st","2nd","3rd","4th","5th","6th","7th","8th","9th","10th","11th","12th","13th","14th","15th","16th","17th","18th"][tr.round-1];
      return `<div style="background:#252836;border-radius:6px;padding:8px 10px;margin-bottom:6px;font-size:12px">
        <span style="color:#fca5a5">${fromName}</span>
        <span style="color:#6b7280"> traded their </span>
        <span style="color:#fbbf24">${rd}-round pick</span>
        <span style="color:#6b7280"> to </span>
        <span style="color:#4ade80">${toName}</span>
      </div>`;
    }).join("")}`;
}

function switchTab(t){
  document.querySelectorAll(".tab").forEach((el,i)=>el.classList.toggle("on",["roster","teams","qbs","trades"][i]===t));
  document.querySelectorAll(".tc").forEach(el=>el.classList.remove("on"));
  document.getElementById("tc-"+t).classList.add("on");
  if(t==="teams") renderAllTeams();
  if(t==="qbs") renderQBPanel();
  if(t==="trades") renderTradePanel();
}

function renderAll(){
  renderClock();renderBA();renderLog();renderRoster();
  const at=document.querySelector(".tc.on");
  if(at){
    const id=at.id.replace("tc-","");
    if(id==="teams") renderAllTeams();
    if(id==="qbs") renderQBPanel();
    if(id==="trades") renderTradePanel();
  }
}

// Init without setup
const PLAYER_INTEL = {
  'Josh Allen': {ol_grade:'A',ol_rank:3,ol_label:'PB',sos:9,sos_label:'pSoS',pass_pct:56,tendency:'Balanced',aggression:'High',usage:'Starter (99% snaps)',hc:'Brady',oc:'Brady'},
  'Lamar Jackson': {ol_grade:'B+',ol_rank:7,ol_label:'PB',sos:5,sos_label:'pSoS',pass_pct:58,tendency:'Pass-First',aggression:'High',usage:'Starter (97% snaps)',hc:'Minter',oc:'Doyle'},
  'Jayden Daniels': {ol_grade:'B',ol_rank:21,ol_label:'PB',sos:1,sos_label:'pSoS',pass_pct:55,tendency:'Balanced',aggression:'Med',usage:'Starter (98% snaps)',hc:'Quinn',oc:'Blough'},
  'Drake Maye': {ol_grade:'C',ol_rank:25,ol_label:'PB',sos:10,sos_label:'pSoS',pass_pct:51,tendency:'Run-Heavy',aggression:'Med',usage:'Starter (97% snaps)',hc:'Vrabel',oc:'McDaniels'},
  'Jalen Hurts': {ol_grade:'A+',ol_rank:1,ol_label:'PB',sos:6,sos_label:'pSoS',pass_pct:55,tendency:'Balanced',aggression:'Med',usage:'Starter (96% snaps)',hc:'Sirianni',oc:'Patullo'},
  'Joe Burrow': {ol_grade:'C+',ol_rank:20,ol_label:'PB',sos:11,sos_label:'pSoS',pass_pct:62,tendency:'Pass-Heavy',aggression:'Low',usage:'Starter (94% snaps)',hc:'Taylor',oc:'Pitcher'},
  'Jaxson Dart': {ol_grade:'B',ol_rank:22,ol_label:'PB',sos:16,sos_label:'pSoS',pass_pct:54,tendency:'Balanced',aggression:'Med',usage:'Starter (90% snaps)',hc:'J.Harbaugh',oc:'Nagy'},
  'Brock Purdy': {ol_grade:'B',ol_rank:11,ol_label:'PB',sos:7,sos_label:'pSoS',pass_pct:54,tendency:'Balanced',aggression:'Med',usage:'Starter (95% snaps)',hc:'Shanahan',oc:'Kubiak'},
  'Trevor Lawrence': {ol_grade:'C+',ol_rank:16,ol_label:'PB',sos:26,sos_label:'pSoS',pass_pct:57,tendency:'Pass-First',aggression:'High',usage:'Starter (96% snaps)',hc:'Coen',oc:'Coen'},
  'Bo Nix': {ol_grade:'A',ol_rank:2,ol_label:'PB',sos:17,sos_label:'pSoS',pass_pct:61,tendency:'Pass-Heavy',aggression:'Med',usage:'Starter (98% snaps)',hc:'Payton',oc:'Lombardi'},
  'Caleb Williams': {ol_grade:'B',ol_rank:32,ol_label:'PB',sos:1,sos_label:'pSoS',pass_pct:58,tendency:'Pass-First',aggression:'High',usage:'Starter (97% snaps)',hc:'B.Johnson',oc:'Taylor'},
  'Patrick Mahomes': {ol_grade:'B',ol_rank:10,ol_label:'PB',sos:12,sos_label:'pSoS',pass_pct:60,tendency:'Pass-Heavy',aggression:'Med',usage:'Starter (99% snaps)',hc:'Reid',oc:'Reid'},
  'Dak Prescott': {ol_grade:'B',ol_rank:13,ol_label:'PB',sos:3,sos_label:'pSoS',pass_pct:59,tendency:'Pass-Heavy',aggression:'Low',usage:'Starter (96% snaps)',hc:'Schottenheimer',oc:'Adams'},
  'Kyler Murray': {ol_grade:'A-',ol_rank:4,ol_label:'PB',sos:8,sos_label:'pSoS',pass_pct:54,tendency:'Balanced',aggression:'Med',usage:'Starter (95% snaps)',hc:'O’Connell',oc:'Phillips'},
  'Jordan Love': {ol_grade:'B',ol_rank:9,ol_label:'PB',sos:14,sos_label:'pSoS',pass_pct:52,tendency:'Balanced',aggression:'Med',usage:'Starter (94% snaps)',hc:'LaFleur',oc:'Stenavich'},
  'Justin Herbert': {ol_grade:'B',ol_rank:14,ol_label:'PB',sos:30,sos_label:'pSoS',pass_pct:54,tendency:'Balanced',aggression:'Med',usage:'Starter (97% snaps)',hc:'Harbaugh',oc:'McDaniel'},
  'Baker Mayfield': {ol_grade:'A-',ol_rank:5,ol_label:'PB',sos:29,sos_label:'pSoS',pass_pct:55,tendency:'Balanced',aggression:'Med',usage:'Starter (97% snaps)',hc:'Bowles',oc:'Robinson'},
  'Bijan Robinson': {ol_grade:'C+',ol_rank:17,ol_label:'RB',sos:25,sos_label:'rSoS',pass_pct:54,tendency:'Balanced',aggression:'Med',usage:'Carry 68% · Tgt 14%',hc:'Stefanski',oc:'Rees'},
  'Jahmyr Gibbs': {ol_grade:'B+',ol_rank:5,ol_label:'RB',sos:7,sos_label:'rSoS',pass_pct:62,tendency:'Pass-Heavy',aggression:'High',usage:'Carry 58% · Tgt 16%',hc:'Campbell',oc:'Morton'},
  'Christian McCaffrey': {ol_grade:'B+',ol_rank:9,ol_label:'RB',sos:10,sos_label:'rSoS',pass_pct:54,tendency:'Balanced',aggression:'Med',usage:'Carry 72% · Tgt 18%',hc:'Shanahan',oc:'Kubiak'},
  'Jonathan Taylor': {ol_grade:'A',ol_rank:3,ol_label:'RB',sos:21,sos_label:'rSoS',pass_pct:53,tendency:'Balanced',aggression:'Med',usage:'Carry 74% · Tgt 10%',hc:'Steichen',oc:'Cooter'},
  'De’Von Achane': {ol_grade:'C-',ol_rank:27,ol_label:'RB',sos:23,sos_label:'rSoS',pass_pct:64,tendency:'Pass-Heavy',aggression:'Med',usage:'Carry 60% · Tgt 18%',hc:'Hafley',oc:'Slowik'},
  'James Cook': {ol_grade:'B+',ol_rank:7,ol_label:'RB',sos:14,sos_label:'rSoS',pass_pct:56,tendency:'Balanced',aggression:'High',usage:'Carry 65% · Tgt 15%',hc:'Brady',oc:'Brady'},
  'Ashton Jeanty': {ol_grade:'C',ol_rank:29,ol_label:'RB',sos:31,sos_label:'rSoS',pass_pct:45,tendency:'Run-Heavy',aggression:'Low',usage:'Carry 72% · Tgt 8%',hc:'Carroll',oc:'Turner'},
  'Saquon Barkley': {ol_grade:'A+',ol_rank:1,ol_label:'RB',sos:12,sos_label:'rSoS',pass_pct:55,tendency:'Balanced',aggression:'Med',usage:'Carry 70% · Tgt 14%',hc:'Sirianni',oc:'Patullo'},
  'Chase Brown': {ol_grade:'C',ol_rank:21,ol_label:'RB',sos:16,sos_label:'rSoS',pass_pct:62,tendency:'Pass-Heavy',aggression:'Low',usage:'Carry 62% · Tgt 12%',hc:'Taylor',oc:'Pitcher'},
  'Kenneth Walker III': {ol_grade:'B',ol_rank:13,ol_label:'RB',sos:18,sos_label:'rSoS',pass_pct:60,tendency:'Pass-Heavy',aggression:'Med',usage:'Carry 64% · Tgt 11%',hc:'Reid',oc:'Reid'},
  'Derrick Henry': {ol_grade:'B+',ol_rank:4,ol_label:'RB',sos:9,sos_label:'rSoS',pass_pct:58,tendency:'Pass-First',aggression:'High',usage:'Carry 70% · Tgt 7%',hc:'Minter',oc:'Doyle'},
  'Breece Hall': {ol_grade:'C',ol_rank:24,ol_label:'RB',sos:17,sos_label:'rSoS',pass_pct:58,tendency:'Pass-First',aggression:'Med',usage:'Carry 60% · Tgt 16%',hc:'Glenn',oc:'Engstrand'},
  'Travis Etienne': {ol_grade:'C+',ol_rank:25,ol_label:'RB',sos:26,sos_label:'rSoS',pass_pct:56,tendency:'Balanced',aggression:'Med',usage:'Carry 58% · Tgt 18%',hc:'Moore',oc:'Nussmeier'},
  'Omarion Hampton': {ol_grade:'B',ol_rank:15,ol_label:'RB',sos:32,sos_label:'rSoS',pass_pct:54,tendency:'Balanced',aggression:'Med',usage:'Carry 62% · Tgt 10%',hc:'Harbaugh',oc:'McDaniel'},
  'Javonte Williams': {ol_grade:'B',ol_rank:14,ol_label:'RB',sos:8,sos_label:'rSoS',pass_pct:59,tendency:'Pass-Heavy',aggression:'Low',usage:'Carry 60% · Tgt 12%',hc:'Schottenheimer',oc:'Adams'},
  'Quinshon Judkins': {ol_grade:'C',ol_rank:30,ol_label:'RB',sos:29,sos_label:'rSoS',pass_pct:52,tendency:'Balanced',aggression:'Med',usage:'Carry 58% · Tgt 10%',hc:'Monken',oc:'Switzer'},
  'Kyren Williams': {ol_grade:'B',ol_rank:18,ol_label:'RB',sos:19,sos_label:'rSoS',pass_pct:58,tendency:'Pass-First',aggression:'Med',usage:'Carry 65% · Tgt 14%',hc:'McVay',oc:'Scheelhaase'},
  'Cam Skattebo': {ol_grade:'B',ol_rank:23,ol_label:'RB',sos:22,sos_label:'rSoS',pass_pct:54,tendency:'Balanced',aggression:'Med',usage:'Carry 60% · Tgt 11%',hc:'J.Harbaugh',oc:'Nagy'},
  'Bucky Irving': {ol_grade:'B',ol_rank:10,ol_label:'RB',sos:31,sos_label:'rSoS',pass_pct:55,tendency:'Balanced',aggression:'Med',usage:'Carry 64% · Tgt 13%',hc:'Bowles',oc:'Robinson'},
  'Chuba Hubbard': {ol_grade:'C',ol_rank:20,ol_label:'RB',sos:32,sos_label:'rSoS',pass_pct:52,tendency:'Balanced',aggression:'Low',usage:'Carry 62% · Tgt 12%',hc:'Canales',oc:'Idzik'},
  'Ja’Marr Chase': {ol_grade:'C+',ol_rank:20,ol_label:'PB',sos:11,sos_label:'pSoS',pass_pct:62,tendency:'Pass-Heavy',aggression:'Low',usage:'Tgt 31% · AY 38% · Rte 92%',hc:'Taylor',oc:'Pitcher'},
  'Puka Nacua': {ol_grade:'B',ol_rank:17,ol_label:'PB',sos:13,sos_label:'pSoS',pass_pct:58,tendency:'Pass-First',aggression:'Med',usage:'Tgt 28% · AY 30% · Rte 88%',hc:'McVay',oc:'Scheelhaase'},
  'Jaxon Smith-Njigba': {ol_grade:'C+',ol_rank:18,ol_label:'PB',sos:19,sos_label:'pSoS',pass_pct:52,tendency:'Balanced',aggression:'Low',usage:'Tgt 26% · AY 28% · Rte 87%',hc:'Macdonald',oc:'Grubb'},
  'Amon-Ra St. Brown': {ol_grade:'B+',ol_rank:6,ol_label:'PB',sos:2,sos_label:'pSoS',pass_pct:62,tendency:'Pass-Heavy',aggression:'High',usage:'Tgt 29% · AY 26% · Rte 90%',hc:'Campbell',oc:'Morton'},
  'CeeDee Lamb': {ol_grade:'B',ol_rank:13,ol_label:'PB',sos:3,sos_label:'pSoS',pass_pct:59,tendency:'Pass-Heavy',aggression:'Low',usage:'Tgt 30% · AY 35% · Rte 91%',hc:'Schottenheimer',oc:'Adams'},
  'Justin Jefferson': {ol_grade:'A-',ol_rank:4,ol_label:'PB',sos:8,sos_label:'pSoS',pass_pct:54,tendency:'Balanced',aggression:'Med',usage:'Tgt 27% · AY 34% · Rte 90%',hc:'O’Connell',oc:'Phillips'},
  'Drake London': {ol_grade:'C+',ol_rank:15,ol_label:'PB',sos:20,sos_label:'pSoS',pass_pct:54,tendency:'Balanced',aggression:'Med',usage:'Tgt 22% · AY 24% · Rte 85%',hc:'Stefanski',oc:'Rees'},
  'Malik Nabers': {ol_grade:'B',ol_rank:22,ol_label:'PB',sos:16,sos_label:'pSoS',pass_pct:54,tendency:'Balanced',aggression:'Med',usage:'Tgt 25% · AY 29% · Rte 87%',hc:'J.Harbaugh',oc:'Nagy'},
  'Rashee Rice': {ol_grade:'B',ol_rank:10,ol_label:'PB',sos:12,sos_label:'pSoS',pass_pct:60,tendency:'Pass-Heavy',aggression:'Med',usage:'Tgt 24% · AY 28% · Rte 86%',hc:'Reid',oc:'Reid'},
  'Chris Olave': {ol_grade:'C+',ol_rank:24,ol_label:'PB',sos:21,sos_label:'pSoS',pass_pct:56,tendency:'Balanced',aggression:'Med',usage:'Tgt 22% · AY 26% · Rte 84%',hc:'Moore',oc:'Nussmeier'},
  'George Pickens': {ol_grade:'B',ol_rank:13,ol_label:'PB',sos:3,sos_label:'pSoS',pass_pct:59,tendency:'Pass-Heavy',aggression:'Low',usage:'Tgt 23% · AY 32% · Rte 85%',hc:'Schottenheimer',oc:'Adams'},
  'A.J. Brown': {ol_grade:'C',ol_rank:25,ol_label:'PB',sos:10,sos_label:'pSoS',pass_pct:51,tendency:'Run-Heavy',aggression:'Med',usage:'Tgt 24% · AY 30% · Rte 86%',hc:'Vrabel',oc:'McDaniels'},
  'Nico Collins': {ol_grade:'C-',ol_rank:27,ol_label:'PB',sos:4,sos_label:'pSoS',pass_pct:57,tendency:'Pass-First',aggression:'Med',usage:'Tgt 26% · AY 31% · Rte 88%',hc:'Ryans',oc:'Caley'},
  'Garrett Wilson': {ol_grade:'C',ol_rank:23,ol_label:'PB',sos:11,sos_label:'pSoS',pass_pct:58,tendency:'Pass-First',aggression:'Med',usage:'Tgt 24% · AY 27% · Rte 86%',hc:'Glenn',oc:'Engstrand'},
  'DeVonta Smith': {ol_grade:'A+',ol_rank:1,ol_label:'PB',sos:6,sos_label:'pSoS',pass_pct:55,tendency:'Balanced',aggression:'Med',usage:'Tgt 25% · AY 28% · Rte 88%',hc:'Sirianni',oc:'Patullo'},
  'Jaylen Waddle': {ol_grade:'A',ol_rank:2,ol_label:'PB',sos:17,sos_label:'pSoS',pass_pct:61,tendency:'Pass-Heavy',aggression:'Med',usage:'Tgt 23% · AY 24% · Rte 87%',hc:'Payton',oc:'Lombardi'},
  'Rome Odunze': {ol_grade:'B',ol_rank:32,ol_label:'PB',sos:1,sos_label:'pSoS',pass_pct:58,tendency:'Pass-First',aggression:'High',usage:'Tgt 22% · AY 26% · Rte 85%',hc:'B.Johnson',oc:'Taylor'},
  'Zay Flowers': {ol_grade:'B+',ol_rank:7,ol_label:'PB',sos:5,sos_label:'pSoS',pass_pct:58,tendency:'Pass-First',aggression:'High',usage:'Tgt 22% · AY 25% · Rte 84%',hc:'Minter',oc:'Doyle'},
  'Davante Adams': {ol_grade:'B',ol_rank:17,ol_label:'PB',sos:13,sos_label:'pSoS',pass_pct:58,tendency:'Pass-First',aggression:'Med',usage:'Tgt 24% · AY 28% · Rte 86%',hc:'McVay',oc:'Scheelhaase'},
  'Brock Bowers': {ol_grade:'C-',ol_rank:28,ol_label:'PB',sos:27,sos_label:'pSoS',pass_pct:45,tendency:'Run-Heavy',aggression:'Low',usage:'Tgt 22% · AY 18% · Rte 85%',hc:'Carroll',oc:'Turner'},
  'Harold Fannin Jr.': {ol_grade:'C',ol_rank:29,ol_label:'PB',sos:25,sos_label:'pSoS',pass_pct:52,tendency:'Balanced',aggression:'Med',usage:'Tgt 20% · AY 15% · Rte 80%',hc:'Monken',oc:'Switzer'},
  'Tyler Warren': {ol_grade:'B+',ol_rank:8,ol_label:'PB',sos:15,sos_label:'pSoS',pass_pct:53,tendency:'Balanced',aggression:'Med',usage:'Tgt 19% · AY 14% · Rte 78%',hc:'Steichen',oc:'Cooter'},
  'Sam LaPorta': {ol_grade:'B+',ol_rank:6,ol_label:'PB',sos:2,sos_label:'pSoS',pass_pct:62,tendency:'Pass-Heavy',aggression:'High',usage:'Tgt 18% · AY 13% · Rte 76%',hc:'Campbell',oc:'Morton'},
  'Trey McBride': {ol_grade:'C',ol_rank:30,ol_label:'PB',sos:24,sos_label:'pSoS',pass_pct:54,tendency:'Balanced',aggression:'Med',usage:'Tgt 21% · AY 16% · Rte 82%',hc:'M.LaFleur',oc:'Hackett'},
  'Travis Kelce': {ol_grade:'B',ol_rank:10,ol_label:'PB',sos:12,sos_label:'pSoS',pass_pct:60,tendency:'Pass-Heavy',aggression:'Med',usage:'Tgt 20% · AY 17% · Rte 80%',hc:'Reid',oc:'Reid'},
  'Isaiah Likely': {ol_grade:'B+',ol_rank:7,ol_label:'PB',sos:5,sos_label:'pSoS',pass_pct:58,tendency:'Pass-First',aggression:'High',usage:'Tgt 16% · AY 12% · Rte 72%',hc:'Minter',oc:'Doyle'},
  'Jake Ferguson': {ol_grade:'B',ol_rank:13,ol_label:'PB',sos:3,sos_label:'pSoS',pass_pct:59,tendency:'Pass-Heavy',aggression:'Low',usage:'Tgt 16% · AY 12% · Rte 74%',hc:'Schottenheimer',oc:'Adams'},
};


function olColor(grade) {
  const c={'A+':'#4ade80','A':'#4ade80','B+':'#86efac','B':'#fbbf24','C+':'#fb923c','C':'#f87171','C-':'#f87171','D+':'#ef4444'};
  const b={'A+':'#14532d','A':'#14532d','B+':'#1a3a2a','B':'#2d2a0a','C+':'#3d1f0a','C':'#3d1515','C-':'#3d1515','D+':'#3d1515'};
  return {color:c[grade]||'#9ca3af',bg:b[grade]||'#252836'};
}
function sosColor(rank) {
  if(rank<=10) return {color:'#4ade80',bg:'#14532d'};
  if(rank<=20) return {color:'#fbbf24',bg:'#2d2a0a'};
  return {color:'#f87171',bg:'#3d1515'};
}
function tendencyColor(t) {
  if(t==='Pass-Heavy'||t==='Pass-First') return {color:'#60a5fa',bg:'#1e3a5f'};
  if(t==='Run-Heavy') return {color:'#4ade80',bg:'#14532d'};
  return {color:'#9ca3af',bg:'#252836'};
}



// Roster slot definitions with positional eligibility
const ROSTER_SLOTS = [
  {label:'QB',         key:'QB',   eligible:['QB'],              starter:true,  sf:false},
  {label:'RB',         key:'RB',   eligible:['RB'],              starter:true,  sf:false},
  {label:'WR',         key:'WR1',  eligible:['WR'],              starter:true,  sf:false},
  {label:'WR',         key:'WR2',  eligible:['WR'],              starter:true,  sf:false},
  {label:'TE',         key:'TE',   eligible:['TE'],              starter:true,  sf:false},
  {label:'W/R/T Flex', key:'FLX1', eligible:['WR','RB','TE'],   starter:true,  sf:false},
  {label:'W/R Flex',   key:'FLX2', eligible:['WR','RB'],        starter:true,  sf:false},
  {label:'W/R/T/Q SF', key:'SF',   eligible:['WR','RB','TE','QB'],starter:true,sf:true},
  {label:'K',          key:'K',    eligible:['K'],               starter:true,  sf:false},
  {label:'DEF',        key:'DEF',  eligible:['DEF'],             starter:true,  sf:false},
  {label:'BN 1',       key:'BN1',  eligible:['QB','RB','WR','TE','K','DEF'], starter:false, sf:false},
  {label:'BN 2',       key:'BN2',  eligible:['QB','RB','WR','TE','K','DEF'], starter:false, sf:false},
  {label:'BN 3',       key:'BN3',  eligible:['QB','RB','WR','TE','K','DEF'], starter:false, sf:false},
  {label:'BN 4',       key:'BN4',  eligible:['QB','RB','WR','TE','K','DEF'], starter:false, sf:false},
  {label:'BN 5',       key:'BN5',  eligible:['QB','RB','WR','TE','K','DEF'], starter:false, sf:false},
  {label:'BN 6',       key:'BN6',  eligible:['QB','RB','WR','TE','K','DEF'], starter:false, sf:false},
  {label:'BN 7',       key:'BN7',  eligible:['QB','RB','WR','TE','K','DEF'], starter:false, sf:false},
  {label:'BN 8',       key:'BN8',  eligible:['QB','RB','WR','TE','K','DEF'], starter:false, sf:false},
];

// myRosterSlots[i] = player object or null
let myRosterSlots = Array(18).fill(null);

function smartAssign(player) {
  // Priority order for slot assignment
  const pos = player.pos;
  const priority = [
    // 1. Exact position match (starter slots only)
    (s,i) => s.starter && s.eligible.length === 1 && s.eligible[0] === pos,
    // 2. Flex slots (non-superflex) 
    (s,i) => s.starter && !s.sf && s.eligible.includes(pos) && s.eligible.length > 1,
    // 3. Superflex slot
    (s,i) => s.starter && s.sf && s.eligible.includes(pos),
    // 4. Bench
    (s,i) => !s.starter && s.eligible.includes(pos),
  ];

  for (const test of priority) {
    for (let i = 0; i < ROSTER_SLOTS.length; i++) {
      if (test(ROSTER_SLOTS[i], i) && !myRosterSlots[i]) {
        myRosterSlots[i] = player;
        return {slotIdx: i, slotLabel: ROSTER_SLOTS[i].label, success: true};
      }
    }
  }
  return {success: false, message: 'Roster Full — all eligible slots taken'};
}

function removeFromRoster(playerId) {
  for (let i = 0; i < myRosterSlots.length; i++) {
    if (myRosterSlots[i] && myRosterSlots[i].id === playerId) {
      myRosterSlots[i] = null;
      return;
    }
  }
}

function isOnMyRoster(playerId) {
  return myRosterSlots.some(s => s && s.id === playerId);
}

function getPositionNeeds() {
  const needs = [];
  const myTi = myTeamIdx >= 0 ? parseInt(myTeamIdx) : -1;
  if (myTi < 0) return needs;

  // Check which starter slots are empty
  for (let i = 0; i < 10; i++) { // first 10 are starters
    if (!myRosterSlots[i]) {
      const slot = ROSTER_SLOTS[i];
      // Check if we have bench players who could fill this
      const canFill = myRosterSlots.slice(10).some(p => p && slot.eligible.includes(p.pos));
      needs.push({
        slot: slot.label,
        key: slot.key,
        sf: slot.sf,
        hasBenchOption: canFill,
        urgent: !canFill,
      });
    }
  }
  return needs;
}

function showDraftTab()   { showMainTab('draft'); }
function showAIChatTab()  { showMainTab('aiChat'); }
function showMainTab(tab) {
  // Hide all main sections
  document.querySelector('.main').style.display = tab === 'draft' ? 'grid' : 'none';
  const aiChat = document.getElementById('aiChatTab');
  if (aiChat) aiChat.style.display = tab === 'aiChat' ? 'flex' : 'none';
  
  // Update tab button styles
  ['draft','aiChat'].forEach(t => {
    const btn = document.getElementById('tab-'+t);
    if (!btn) return;
    if (t === tab) {
      btn.style.background = '#1e3a5f';
      btn.style.color = '#60a5fa';
      btn.style.borderColor = '#1565c0';
    } else {
      btn.style.background = '#252836';
      btn.style.color = '#9ca3af';
      btn.style.borderColor = '#374151';
    }
  });
}


// ── AI Functions ──

function showKeyActive() {
  var entry = document.getElementById('aiKeyEntry');
  var tag = document.getElementById('aiActiveTag');
  var btns = document.getElementById('aiActionBtns');
  var chips = document.getElementById('aiChipsRow');
  var inputRow = document.getElementById('aiInputRow');
  if (entry) entry.style.display = 'none';
  if (tag) tag.style.display = 'inline';
  if (btns) { btns.style.display = 'flex'; }
  if (chips) chips.style.display = 'block';
  if (inputRow) { inputRow.style.display = 'flex'; }
  var resp = document.getElementById('aiResponse');
  if (resp) resp.innerHTML = '<span style="color:#4b5563;font-style:italic">Click ⚡ for pick advice.</span>';
}

function initAIPanel() {
  var chipsRow = document.getElementById('aiChipsRow');
  var chips = ['Who should I draft?','Am I QB heavy?','What position do I need?','Is my team balanced?'];
  if (chipsRow) {
    chipsRow.innerHTML = chips.map(function(c) {
      return '<button onclick="askAICustom(this.getAttribute(\"data-c\"))" data-c="' + c + '" ' +
        'style="font-size:10px;background:#1f2937;color:#9ca3af;border:1px solid #374151;border-radius:12px;padding:2px 8px;margin-right:4px;cursor:pointer">' + c + '</button>';
    }).join('');
  }
  if (apiKey) showKeyActive();
}

function buildDraftContext() {
  var myTi = myTeamIdx >= 0 ? myTeamIdx : -1;
  var roster = myTi >= 0 ? (teamRosters[myTi] || []) : [];
  var rl = roster.map(function(p) { return p.pos + ' ' + p.name + ' (' + (p.team||'?') + ')'; }).join('\n') || 'No picks yet';
  var avail = players.filter(function(p) { return !p.drafted && p.customScore > 0; })
    .sort(function(a,b) { return (b.customScore||0)-(a.customScore||0); })
    .slice(0,15)
    .map(function(p) { return p.pos + ' ' + p.name + ' (' + p.team + ', ' + (p.customScore||0).toFixed(0) + 'pts, VORP:' + (p.vorp||0).toFixed(1) + ')'; })
    .join('\n');
  var rd = Math.ceil(currentPick / TEAMS);
  var onClock = pickOwners ? pickOwners[currentPick-1] : -1;
  var isMyPick = myTeamIdx >= 0 && onClock === myTeamIdx;
  return [
    'LEAGUE: ' + TEAMS + '-team Superflex PPR, ' + ROUNDS + ' rounds',
    'SCORING: Pass 0.05/yd 4TD -2INT | Rush 0.1/yd 6TD | PPR +1 0.1/yd 6TD | Fumble -2',
    'ROSTER: QB RB WR WR TE W/R/T W/R SUPERFLEX K DEF + 8 bench. MAX 3 QBs.',
    '',
    'Pick: #' + currentPick + ' (Rd ' + rd + ') ' + (isMyPick ? 'YOUR PICK' : ''),
    'QBs gone: ' + players.filter(function(p){return p.pos==='QB'&&p.drafted;}).length,
    'My roster: QB:' + roster.filter(function(p){return p.pos==='QB';}).length +
      ' RB:' + roster.filter(function(p){return p.pos==='RB';}).length +
      ' WR:' + roster.filter(function(p){return p.pos==='WR';}).length +
      ' TE:' + roster.filter(function(p){return p.pos==='TE';}).length,
    '',
    'MY ROSTER (' + roster.length + '/' + ROUNDS + '):',
    rl,
    '',
    'TOP 15 AVAILABLE:',
    avail
  ].join('\n');
}

async function askAI(type) {
  if (!apiKey || aiLoading) return;
  var rd = Math.ceil(currentPick / TEAMS);
  var onClock = pickOwners ? pickOwners[currentPick-1] : -1;
  var isMyPick = myTeamIdx >= 0 && onClock === myTeamIdx;
  var prompt = type === 'quick'
    ? (isMyPick
        ? "It's my pick (#" + currentPick + ", Round " + rd + "). Who should I draft? Name 1-2 players, cite VORP, mention position urgency."
        : "Not my pick (Pick #" + currentPick + ", Rd " + rd + "). What should I target next?")
    : "Full team analysis: strengths, weaknesses, urgent positions, strategy for remaining " + (ROUNDS - (teamRosters[myTeamIdx]||[]).length) + " picks.";
  await sendToAI(prompt);
}

async function askAICustom(prompt) {
  if (!apiKey || aiLoading || !prompt) return;
  await sendToAI(prompt);
}

async function sendToAI(userMessage) {
  if (!apiKey) return;
  aiLoading = true;
  var btn = document.getElementById('quickBtn');
  if (btn) btn.textContent = '⏳...';
  var resp = document.getElementById('aiResponse');
  if (resp) resp.innerHTML = '<div style="color:#6b7280;font-size:10px">Analyzing...</div>';
  var sys = 'You are an expert fantasy football draft advisor. ' + buildDraftContext() + ' Give sharp, specific advice. Reference player names and VORP. Account for Superflex (QBs worth more) and custom scoring.';
  try {
    var res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {'Content-Type':'application/json','x-api-key':apiKey,'anthropic-version':'2023-06-01','anthropic-dangerous-direct-browser-access':'true'},
      body: JSON.stringify({model:'claude-sonnet-4-20250514',max_tokens:500,system:sys,messages:[{role:'user',content:userMessage}]})
    });
    var data = await res.json();
    var reply = (data.content && data.content[0]) ? data.content[0].text : 'No response.';
    if (resp) resp.innerHTML = reply.split('\n').join('<br>');
  } catch(e) {
    var msg = e.message || 'Error';
    if (msg.includes('401')) msg = 'Invalid API key.';
    if (msg.includes('429')) msg = 'Rate limited — wait a moment.';
    if (resp) resp.innerHTML = '<span style="color:#f87171">❌ ' + msg + '</span>';
  } finally {
    aiLoading = false;
    if (btn) btn.textContent = '⚡ My pick';
  }
}

function saveApiKey() {
  var input = document.getElementById('apiKeyInputEl');
  var key = input ? input.value.trim() : '';
  if (!key.startsWith('sk-')) { alert('Key should start with sk-'); return; }
  apiKey = key;
  localStorage.setItem('ff26_apiKey', apiKey);
  showKeyActive();
}

function sendStrip() {
  var el = document.getElementById('aiStripInputEl');
  if (el && el.value.trim()) { askAICustom(el.value); el.value = ''; }
}

function askAIChip(el){askAICustom(el.getAttribute("data-c"));}
function doAskAIQuick() { askAI('quick'); }
function doAskAIFull()  { askAI('full'); }
function switchRoster() { switchTab('roster'); }
function switchTeams()  { switchTab('teams'); }
function switchQBs()    { switchTab('qbs'); }
function switchTrades() { switchTab('trades'); }


(function init(){
  try {
  const sel=document.getElementById("myTeamSel");
  // Populate with generic team names until Sleeper is connected
  sel.innerHTML='<option value="-1">— Select your team —</option>';
  teamNames.forEach((n,i)=>{const o=document.createElement("option");o.value=i;o.text=n;sel.appendChild(o);});
  teamSlots=Array(TEAMS).fill(0);
  pickOwners=[];
  for(let pick=1;pick<=TOTAL;pick++){
    const rd=Math.ceil(pick/TEAMS),pos=pick-(rd-1)*TEAMS;
    pickOwners.push(rd%2===1?pos-1:TEAMS-pos);
  }
  initPlayers();
  calcVORP();
  renderAll();
  // Check Supabase session — shows auth modal or loads saved settings
  checkSession();
  } catch(e) {
    console.error('[Init error]', e);
    // Show auth modal even if init fails
    var am = document.getElementById('authModal');
    if (am) am.style.display = 'flex';
  }
})();






// ── Sleeper API Functions ──
function sleeperMsg(msg, isError) {
  console.log('[Sleeper]', msg);
  const el = document.getElementById('sleeperMsg');
  if (!el) return;
  el.style.display = 'block';
  el.style.background = isError ? '#3d1515' : '#14532d';
  el.style.color = isError ? '#fca5a5' : '#4ade80';
  el.style.border = `1px solid ${isError ? '#7f1d1d' : '#166534'}`;
  el.textContent = msg;
}

async function sleeperFetch(url) {
  // Direct call with 15s timeout — no proxy needed, Sleeper API supports CORS
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);
  try {
    const r = await fetch(url, { signal: controller.signal });
    clearTimeout(timer);
    if (!r.ok) throw new Error(`Sleeper API returned ${r.status} — check your League ID`);
    return r.json();
  } catch(e) {
    clearTimeout(timer);
    if (e.name === 'AbortError') throw new Error('Request timed out after 15s — check internet connection');
    throw e;
  }
}

async function fetchSleeperLeague() {
  const leagueId = document.getElementById('sleeperLeagueInput').value.trim();
  if (!leagueId) { sleeperMsg('Enter your League ID first', true); return; }
  sleeperLeagueId = leagueId;
  localStorage.setItem('ff26_leagueId', leagueId);

  try {
    const BASE = 'https://api.sleeper.app/v1';

    sleeperMsg('⏳ Step 1/5 — Loading league info...', false);
    const league = await sleeperFetch(`${BASE}/league/${leagueId}`);

    sleeperMsg('⏳ Step 2/5 — Loading team rosters...', false);
    const [users, rosters] = await Promise.all([
      sleeperFetch(`${BASE}/league/${leagueId}/users`),
      sleeperFetch(`${BASE}/league/${leagueId}/rosters`),
    ]);

    sleeperMsg('⏳ Step 3/5 — Loading traded picks...', false);
    const tradedPicks = await sleeperFetch(`${BASE}/league/${leagueId}/traded_picks`);

    sleeperMsg('⏳ Step 4/5 — Loading draft info...', false);
    const drafts = await sleeperFetch(`${BASE}/league/${leagueId}/drafts`);

    // ── Process users ──
    const umap = {};
    users.forEach(u => {
      umap[u.user_id] = u.metadata?.team_name || u.display_name || u.username;
    });

    // ── Update league size from Sleeper ──
    const numTeams = league.total_rosters || rosters.length || 12;
    const numRounds = (league.settings && league.settings.rounds) || 18;
    const numRosters = rosters.length || numTeams;

    if (numTeams !== TEAMS || numRounds !== ROUNDS) {
      TEAMS = numTeams;
      ROUNDS = numRounds;
      TOTAL = TEAMS * ROUNDS;
      console.log('[Sleeper] League size updated:', TEAMS, 'teams,', ROUNDS, 'rounds,', TOTAL, 'total picks');
    }

    // Resize teamNames, teamSlots, teamRosters to match
    while (teamNames.length < TEAMS) teamNames.push('Team ' + (teamNames.length + 1));
    teamNames = teamNames.slice(0, TEAMS);
    teamSlots = Array(TEAMS).fill(0);
    teamRosters = Array.from({length: TEAMS}, () => []);
    myRosterSlots = Array(ROUNDS + 8).fill(null); // starters + bench

    // ── Process rosters — sorted by roster_id = draft slot ──
    rosters.sort((a,b) => (a.roster_id||0) - (b.roster_id||0));
    const rosterMap = {}; // roster_id → teamIdx
    rosters.forEach((roster, i) => {
      if (i < teamNames.length) {
        teamNames[i] = umap[roster.owner_id] || ('Team ' + (i+1));
        rosterMap[roster.roster_id] = i;
      }
    });

    // ── Process draft + slot assignments ──
    let draftData = null;
    let slotMap = {}; // teamIdx → slot number
    if (drafts && drafts.length > 0) {
      // Use most recent non-complete draft, or latest
      draftData = drafts.find(d => d.status === 'predraft' || d.status === 'drafting') || drafts[drafts.length-1];
      sleeperDraftId = draftData.draft_id;
      localStorage.setItem('ff26_draftId', sleeperDraftId);

      // Draft order: slot_to_roster_id maps slot → roster_id
      if (draftData.slot_to_roster_id) {
        Object.entries(draftData.slot_to_roster_id).forEach(([slot, rosterId]) => {
          const ti = rosterMap[rosterId];
          if (ti !== undefined) {
            teamSlots[ti] = parseInt(slot);
            slotMap[ti] = parseInt(slot);
          }
        });
      }
      // Update draft input field
      const di = document.getElementById('sleeperDraftInput');
      if (di) di.value = sleeperDraftId;
    }

    // ── Rebuild pick ownership with real slots ──
    buildPickOwners();

    // ── Process traded picks ──
    trades = []; // reset
    if (tradedPicks && tradedPicks.length > 0) {
      // Filter to current season only
      const season = (league.season || '2026');
      const currentTrades = tradedPicks.filter(tp => tp.season === season);

      currentTrades.forEach(tp => {
        // tp.roster_id = who NOW owns it, tp.previous_owner_id = who traded it away
        // tp.owner_id = current owner, tp.round = round number
        const fromTi = rosterMap[tp.previous_owner_id];
        const toTi = rosterMap[tp.owner_id || tp.roster_id];
        if (fromTi !== undefined && toTi !== undefined && fromTi !== toTi) {
          trades.push({
            fromTeam: fromTi,
            toTeam: toTi,
            round: tp.round,
            season: tp.season,
          });
        }
      });
      // Rebuild pick owners with traded picks applied
      buildPickOwners();
    }

    // ── Process keepers from rosters ──
    // Sleeper marks keepers in roster.metadata.keeper_deadline or similar
    // More reliably: if draft exists and has keepers, they show as picks with is_keeper=true
    // We'll pull those when syncing the draft

    sleeperMsg('⏳ Step 5/5 — Rebuilding draft board...', false);

    // ── Rebuild team dropdown ──
    const sel = document.getElementById('myTeamSel');
    if (sel) {
      sel.innerHTML = '<option value="-1">— Select your team —</option>';
      teamNames.forEach((n,i) => {
        const o = document.createElement('option');
        o.value = i; o.text = n;
        sel.appendChild(o);
      });
    }

    renderAll();

    // Build summary message
    const slotsAssigned = Object.values(slotMap).length;
    const tradesFound = trades.length;
    const draftStatus = draftData ? ` · Draft ${draftData.status}` : ' · No draft created yet';
    const draftIdMsg = draftData ? ` · Draft ID saved` : '';

    // Auto-pull my team's players if myTeamIdx is set
    if (myTeamIdx >= 0 && rosters[myTeamIdx]) {
      const myRoster = rosters[myTeamIdx];
      if (myRoster.players && myRoster.players.length > 0) {
        sleeperMsg('⏳ Loading your roster from Sleeper...', false);
        try {
          const allPlayers = await sleeperFetch('https://api.sleeper.app/v1/players/nfl');
          const myPlayers = myRoster.players.map(pid => {
            const pd = allPlayers[pid];
            if (!pd) return null;
            return {
              name: ((pd.first_name||'') + ' ' + (pd.last_name||'')).trim(),
              pos: (pd.fantasy_positions && pd.fantasy_positions[0]) || '?',
              team: pd.team || 'FA',
              sleeperId: pid
            };
          }).filter(Boolean);

          // Populate the keeper rows with my roster
          manualKeepers = [];
          myPlayers.forEach(function(p) {
            manualKeepers.push({ name: p.name, team: p.team, pos: p.pos, round: 9 });
          });

          // Auto-select my team in the owner dropdown
          const ownerSel = document.getElementById('kpTeamOwner');
          if (ownerSel) {
            ownerSel.innerHTML = '<option value="-1">— Select team —</option>';
            teamNames.forEach((n,i) => {
              const o = document.createElement('option');
              o.value = i; o.text = n;
              if (i === myTeamIdx) o.selected = true;
              ownerSel.appendChild(o);
            });
          }

          renderKeeperRows();
          sleeperMsg(`✅ Imported! ${rosters.length} teams · ${myPlayers.length} players on your roster loaded as keepers — adjust rounds then click Apply`, false);
        } catch(e) {
          sleeperMsg(`✅ Imported! ${rosters.length} teams · ${slotsAssigned} slots assigned · ${tradesFound} pick trades${draftStatus}`, false);
        }
      } else {
        sleeperMsg(
          `✅ Imported! ${rosters.length} teams · ${slotsAssigned} slots assigned · ${tradesFound} pick trades${draftStatus}${draftIdMsg}`,
          false
        );
      }
    } else {
      sleeperMsg(
        `✅ Imported! ${rosters.length} teams · ${slotsAssigned} slots assigned · ${tradesFound} pick trades${draftStatus}${draftIdMsg}`,
        false
      );
    }

  } catch(e) {
    console.error('Sleeper import error:', e);
    sleeperMsg('❌ ' + (e.message || 'Network error'), true);
  }
}


async function syncSleeperDraft() {
  const draftId = document.getElementById('sleeperDraftInput').value.trim() || sleeperDraftId;
  if (!draftId) { sleeperMsg('No Draft ID — import your league first, or enter Draft ID manually', true); return; }
  sleeperDraftId = draftId;
  localStorage.setItem('ff26_draftId', draftId);

  const btn = document.getElementById('syncBtn');
  if (btn) { btn.textContent = '⏳ Syncing...'; btn.disabled = true; }
  sleeperMsg('⏳ Syncing draft picks...', false);

  try {
    const BASE = 'https://api.sleeper.app/v1';

    // Fetch picks and traded picks simultaneously
    const [picks, tradedPicks] = await Promise.all([
      sleeperFetch(`${BASE}/draft/${draftId}/picks`),
      sleeperLeagueId ? sleeperFetch(`${BASE}/league/${sleeperLeagueId}/traded_picks`) : Promise.resolve([]),
    ]);

    // Re-apply traded picks (draft may have new trades since last import)
    if (tradedPicks.length > 0 && sleeperLeagueId) {
      trades = [];
      const league = await sleeperFetch(`${BASE}/league/${sleeperLeagueId}`);
      const rosters = await sleeperFetch(`${BASE}/league/${sleeperLeagueId}/rosters`);
      const rosterMap = {};
      rosters.forEach((r,i) => { rosterMap[r.roster_id] = i; });
      const season = league.season || '2026';
      tradedPicks.filter(tp => tp.season === season).forEach(tp => {
        const fromTi = rosterMap[tp.previous_owner_id];
        const toTi = rosterMap[tp.owner_id || tp.roster_id];
        if (fromTi !== undefined && toTi !== undefined && fromTi !== toTi) {
          trades.push({ fromTeam: fromTi, toTeam: toTi, round: tp.round });
        }
      });
      buildPickOwners();
    }

    // Reset drafted state for non-keeper picks
    players.forEach(p => { if (!p.isKeeper) p.drafted = false; });
    pickLog = pickLog.filter(l => l.isKeeper);
    teamRosters = teamRosters.map(r => r.filter(p => p.isKeeper));
    myRosterSlots = myRosterSlots.map(s => (s && s.isKeeper) ? s : null);

    let matched = 0, keepers = 0, unmatched = [];

    picks.forEach(pick => {
      const pickNum = (pick.round - 1) * TEAMS + pick.pick_no;
      const ti = (pick.roster_id || 1) - 1;
      const isKeeper = pick.is_keeper || false;
      const playerName = pick.metadata?.first_name && pick.metadata?.last_name
        ? `${pick.metadata.first_name} ${pick.metadata.last_name}`
        : (pick.metadata?.player_id || '');
      const pos = pick.metadata?.position || '?';
      const nflTeam = pick.metadata?.team || '?';

      if (pickLog.find(l => l.pick === pickNum)) return; // already logged

      // Match to our player pool
      const match = players.find(p =>
        p.name.toLowerCase() === playerName.toLowerCase()
      );

      const entry = match
        ? { ...match, pickNum, rd: pick.round, isKeeper }
        : { id: 99000 + pickNum, name: playerName, pos, team: nflTeam, pickNum, rd: pick.round, customScore: 0, vorp: 0, isKeeper };

      if (match) {
        match.drafted = true;
        if (isKeeper) { match.isKeeper = true; }
        matched++;
      } else if (playerName) {
        unmatched.push(playerName);
      }

      if (!teamRosters[ti]) teamRosters[ti] = [];
      teamRosters[ti].push(entry);
      pickLog.push({ pick: pickNum, rd: pick.round, teamIdx: ti, team: teamNames[ti] || '?', player: playerName, pos, nfl: nflTeam, isKeeper });

      if (ti === myTeamIdx) smartAssign(entry);
      if (isKeeper) keepers++;
    });

    // Advance currentPick
    currentPick = 1;
    while (currentPick <= TOTAL && pickLog.find(l => l.pick === currentPick)) currentPick++;

    calcVORP();
    renderAll();

    const unmatchedNote = unmatched.length ? ` · ${unmatched.length} unmatched (custom players)` : '';
    sleeperMsg(`✅ Synced ${picks.length} picks · ${matched} matched · ${keepers} keepers${unmatchedNote}`, false);

    // Auto-sync every 30s if draft is in progress
    if (picks.length > 0 && currentPick <= TOTAL) {
      clearInterval(window._autoSync);
      window._autoSync = setInterval(() => {
        if (currentPick <= TOTAL) syncSleeperDraft();
        else clearInterval(window._autoSync);
      }, 30000);
      console.log('[Sleeper] Auto-sync started — every 30s');
    }

  } catch(e) {
    console.error('Sync error:', e);
    sleeperMsg('❌ ' + e.message, true);
  } finally {
    if (btn) { btn.textContent = '🔄 Sync Picks'; btn.disabled = false; }
  }
}



// ── Manual Keeper Entry ──
var manualKeepers = []; // [{name, team, pos, round, teamIdx}]


function searchKeeperPlayer(q) {
  var dd = document.getElementById('kpDropdown');
  if (!q || q.length < 2) { dd.style.display = 'none'; return; }
  var matches = players.filter(function(p) {
    return p.name.toLowerCase().includes(q.toLowerCase()) && p.customScore > 0;
  }).slice(0, 8);
  if (!matches.length) { dd.style.display = 'none'; return; }
  var posColors = {QB:'#60a5fa',RB:'#4ade80',WR:'#fb923c',TE:'#c084fc'};
  dd.innerHTML = matches.map(function(p) {
    var safeN = p.name.replace(/'/g, "&#39;");
    var safeT = (p.team||'').replace(/'/g, "&#39;");
    var safeP = p.pos;
    return '<div class="kp-dd-item" onclick="selectKeeperPlayer(' +
      "'" + safeN + "','" + safeT + "','" + safeP + "'" +
      ')" style="padding:6px 10px;cursor:pointer;display:flex;gap:8px;align-items:center;border-bottom:1px solid #1e2130">' +
      '<span style="font-weight:700;font-size:10px;color:' + (posColors[p.pos]||'#9ca3af') + ';width:24px">' + p.pos + '</span>' +
      '<span style="flex:1;font-size:12px;color:#e8eaf0">' + p.name + '</span>' +
      '<span style="font-size:10px;color:#6b7280">' + (p.team||'') + '</span>' +
      '</div>';
  }).join('');
  dd.style.display = 'block';
}

function selectKeeperPlayer(name, team, pos) {
  document.getElementById('kpName').value = name;
  document.getElementById('kpTeam').value = team;
  document.getElementById('kpDropdown').style.display = 'none';

  // Auto-set position dropdown
  var posEl = document.getElementById('kpPos');
  if (posEl) {
    for (var i = 0; i < posEl.options.length; i++) {
      if (posEl.options[i].value === pos) { posEl.selectedIndex = i; break; }
    }
    posEl.style.color = '#e8eaf0';
  }
  // Show team
  var teamEl = document.getElementById('kpTeam');
  if (teamEl) teamEl.style.color = '#e8eaf0';
}

// Close dropdown when clicking outside
document.addEventListener('click', function(e) {
  var dd = document.getElementById('kpDropdown');
  if (dd && !dd.contains(e.target) && e.target.id !== 'kpName') {
    dd.style.display = 'none';
  }
});


var pendingPickTrades = []; // {fromTi, toTi, round}

async function loadTeamRosterForKeepers() {
  var ownerTi = parseInt(document.getElementById('kpTeamOwner').value);
  if (ownerTi < 0) return;
  if (!sleeperLeagueId) { setKeeperMsg('Import your league first', true); return; }

  var listEl = document.getElementById('keeperRosterList');
  listEl.innerHTML = '<div style="color:#9ca3af;font-size:11px;padding:8px">Loading roster from Sleeper...</div>';

  // Also populate pick trade dropdowns
  populateTradeDropdowns();

  try {
    const BASE = 'https://api.sleeper.app/v1';
    const [rosters, allPlayers] = await Promise.all([
      sleeperFetch(BASE + '/league/' + sleeperLeagueId + '/rosters'),
      sleeperFetch(BASE + '/players/nfl')
    ]);
    rosters.sort(function(a,b){ return (a.roster_id||0)-(b.roster_id||0); });
    const myRosterData = rosters[ownerTi];
    if (!myRosterData || !myRosterData.players || !myRosterData.players.length) {
      listEl.innerHTML = '<div style="color:#f87171;font-size:11px;padding:8px">No players on this roster in Sleeper</div>';
      return;
    }

    const posColors = {QB:'#60a5fa',RB:'#4ade80',WR:'#fb923c',TE:'#c084fc',K:'#fbbf24',DEF:'#94a3b8'};
    const validPos = ['QB','RB','WR','TE','K','DEF'];
    const rosterPlayers = myRosterData.players.map(function(pid) {
      const pd = allPlayers[pid];
      if (!pd) return null;
      const pos = (pd.fantasy_positions && pd.fantasy_positions[0]) || '?';
      if (validPos.indexOf(pos) < 0) return null;
      return {
        name: ((pd.first_name||'') + ' ' + (pd.last_name||'')).trim(),
        pos: pos, team: pd.team || 'FA'
      };
    }).filter(Boolean).sort(function(a,b){
      return validPos.indexOf(a.pos) - validPos.indexOf(b.pos);
    });

    listEl.innerHTML = rosterPlayers.map(function(p, i) {
      var color = posColors[p.pos] || '#9ca3af';
      return '<div style="display:flex;align-items:center;gap:8px;padding:5px 8px;border-bottom:1px solid #1a1d27">' +
        '<input type="checkbox" id="kp_' + i + '" onchange="keeperCheckChange()" style="cursor:pointer;width:14px;height:14px">' +
        '<span style="font-weight:700;font-size:10px;color:' + color + ';width:24px">' + p.pos + '</span>' +
        '<span style="flex:1;font-size:12px;color:#e8eaf0">' + p.name + '</span>' +
        '<span style="font-size:10px;color:#6b7280;width:30px">' + p.team + '</span>' +
        '<span style="font-size:10px;color:#6b7280;margin-right:2px">Rd</span>' +
        '<input type="number" id="kpr_' + i + '" min="1" max="18" placeholder="—" disabled ' +
          'style="width:40px;background:#252836;border:1px solid #374151;color:#fbbf24;border-radius:4px;padding:2px 4px;font-size:12px;text-align:center;outline:none" ' +
          'data-name="' + p.name + '" data-pos="' + p.pos + '" data-team="' + p.team + '">' +
      '</div>';
    }).join('');

    setKeeperMsg('Loaded ' + rosterPlayers.length + ' players — check up to 2 keepers and enter cost round', false);
  } catch(e) {
    listEl.innerHTML = '<div style="color:#f87171;font-size:11px;padding:8px">Error: ' + e.message + '</div>';
  }
}

function keeperCheckChange() {
  // Max 2 keepers — disable other checkboxes if 2 checked
  var allChecks = document.querySelectorAll('#keeperRosterList input[type=checkbox]');
  var checked = Array.from(allChecks).filter(function(c){ return c.checked; });
  allChecks.forEach(function(c) {
    var i = c.id.replace('kp_','');
    var rdInput = document.getElementById('kpr_' + i);
    if (c.checked) {
      c.disabled = false;
      if (rdInput) { rdInput.disabled = false; rdInput.style.borderColor = '#fbbf24'; }
    } else {
      c.disabled = checked.length >= 2;
      if (rdInput) { rdInput.disabled = true; rdInput.value = ''; rdInput.style.borderColor = '#374151'; }
    }
  });
}

function clearKeeperChecks() {
  var allChecks = document.querySelectorAll('#keeperRosterList input[type=checkbox]');
  allChecks.forEach(function(c) {
    c.checked = false; c.disabled = false;
    var rdInput = document.getElementById('kpr_' + c.id.replace('kp_',''));
    if (rdInput) { rdInput.disabled = true; rdInput.value = ''; }
  });
  setKeeperMsg('Cleared', false);
}

function setKeeperMsg(msg, isError) {
  var el = document.getElementById('keeperMsg');
  if (!el) return;
  el.style.display = 'block';
  el.style.color = isError ? '#f87171' : '#4ade80';
  el.textContent = msg;
}

function populateTradeDropdowns() {
  ['ptFrom','ptTo'].forEach(function(id) {
    var sel = document.getElementById(id);
    if (!sel) return;
    sel.innerHTML = '<option value="-1">' + (id==='ptFrom'?'From team...':'To team...') + '</option>';
    teamNames.forEach(function(n,i){
      var o = document.createElement('option');
      o.value = i; o.text = n; sel.appendChild(o);
    });
  });
  renderPickTradesList();
}

function addPickTrade() {
  var fromTi = parseInt(document.getElementById('ptFrom').value);
  var toTi   = parseInt(document.getElementById('ptTo').value);
  var round  = parseInt(document.getElementById('ptRound').value);
  if (fromTi < 0 || toTi < 0) { setKeeperMsg('Select both teams for the trade', true); return; }
  if (fromTi === toTi) { setKeeperMsg('From and To teams must be different', true); return; }
  pendingPickTrades.push({ fromTi: fromTi, toTi: toTi, round: round });
  renderPickTradesList();
  setKeeperMsg('Trade added — click Apply trades when done', false);
}

function renderPickTradesList() {
  var el = document.getElementById('pickTradesList');
  if (!el) return;
  if (!pendingPickTrades.length) {
    el.innerHTML = '<div style="color:#4b5563;font-size:11px;padding:4px">No trades recorded yet</div>';
    return;
  }
  el.innerHTML = pendingPickTrades.map(function(t, i) {
    return '<div style="display:flex;align-items:center;gap:6px;padding:3px 4px;font-size:11px;border-bottom:1px solid #1a1d27">' +
      '<span style="color:#9ca3af;flex:1">' + (teamNames[t.fromTi]||'?') + '</span>' +
      '<span style="color:#c084fc">→ Rd ' + t.round + ' →</span>' +
      '<span style="color:#9ca3af;flex:1;text-align:right">' + (teamNames[t.toTi]||'?') + '</span>' +
      '<button onclick="removePickTrade(' + i + ')" style="background:transparent;border:none;color:#4b5563;cursor:pointer;font-size:14px;padding:0 4px">×</button>' +
    '</div>';
  }).join('');
}

function removePickTrade(i) {
  pendingPickTrades.splice(i, 1);
  renderPickTradesList();
}

function applyPickTrades() {
  if (!pendingPickTrades.length) { setKeeperMsg('No trades to apply', true); return; }
  pendingPickTrades.forEach(function(t) {
    trades.push({ fromTeam: t.fromTi, toTeam: t.toTi, round: t.round });
  });
  buildPickOwners();
  renderAll();
  setKeeperMsg('Applied ' + pendingPickTrades.length + ' pick trade(s) to board', false);
  pendingPickTrades = [];
  renderPickTradesList();
}


function renderKeeperRows() {
  // Legacy - no longer used. Keeper roster loaded via loadTeamRosterForKeepers
}

function removeKeeper(i) {
  manualKeepers.splice(i, 1);
  renderKeeperRows();
}

function addManualKeeper() {
  var name  = document.getElementById('kpName').value.trim();
  var team  = document.getElementById('kpTeam').value.trim() || '?';
  var pos   = document.getElementById('kpPos').value;
  var round = parseInt(document.getElementById('kpRound').value);
  if (!name) { alert('Search and select a player first'); return; }

  // Verify player exists in pool
  var p = players.find(function(x){ return x.name.toLowerCase() === name.toLowerCase(); });
  if (!p) { alert(name + ' not found in player pool. Load players from Sleeper first, or check spelling.'); return; }

  manualKeepers.push({ name: p.name, team: p.team || team, pos: p.pos || pos, round: round });
  document.getElementById('kpName').value = '';
  document.getElementById('kpTeam').value = '';
  document.getElementById('kpDropdown').style.display = 'none';
  // Reset pos to dimmed
  var posEl = document.getElementById('kpPos');
  if (posEl) posEl.style.color = '#6b7280';
  renderKeeperRows();
}

function openSleeperModal() {
  var li = document.getElementById('sleeperLeagueInput');
  var di = document.getElementById('sleeperDraftInput');
  if (li) li.value = localStorage.getItem('ff26_leagueId') || '';
  if (di) di.value = localStorage.getItem('ff26_draftId') || '';
  // Populate team owner dropdown
  var sel = document.getElementById('kpTeamOwner');
  if (sel) {
    sel.innerHTML = '<option value="-1">— Select team that owns keeper —</option>';
    teamNames.forEach(function(n, i) {
      var o = document.createElement('option');
      o.value = i; o.text = n;
      sel.appendChild(o);
    });
  }
  renderKeeperRows();
  document.getElementById('sleeperModal').style.display = 'flex';
}

function applyManualKeepers() {
  var ownerTi = parseInt(document.getElementById('kpTeamOwner').value);
  if (ownerTi < 0) { setKeeperMsg('Select a team first', true); return; }

  // Sync myTeamIdx from dropdown if needed
  if (myTeamIdx < 0) {
    var sel = document.getElementById('myTeamSel');
    if (sel && parseInt(sel.value) >= 0) myTeamIdx = parseInt(sel.value);
  }

  // Only process CHECKED checkboxes with a filled round number
  var keepersToApply = [];
  var allChecks = document.querySelectorAll('#keeperRosterList input[type=checkbox]');
  for (var ci = 0; ci < allChecks.length; ci++) {
    var cb = allChecks[ci];
    if (!cb.checked) continue; // skip unchecked
    var idx = cb.id.replace('kp_', '');
    var rdInput = document.getElementById('kpr_' + idx);
    var roundVal = rdInput ? rdInput.value.trim() : '';
    if (!roundVal || isNaN(parseInt(roundVal))) {
      setKeeperMsg('Enter a round number for ' + (rdInput ? rdInput.getAttribute('data-name') : 'checked player'), true);
      return;
    }
    keepersToApply.push({
      name:  rdInput.getAttribute('data-name'),
      pos:   rdInput.getAttribute('data-pos'),
      team:  rdInput.getAttribute('data-team'),
      round: parseInt(roundVal)
    });
  }

  if (keepersToApply.length === 0) { setKeeperMsg('Check up to 2 players and enter their cost round', true); return; }
  if (keepersToApply.length > 2)   { setKeeperMsg('Max 2 keepers per team', true); return; }

  var applied = 0;
  keepersToApply.forEach(function(k) {
    var p = players.find(function(x){ return x.name.toLowerCase() === k.name.toLowerCase(); });
    if (!p) {
      var maxId = Math.max.apply(null, players.map(function(x){ return x.id||0; })) + 1;
      p = { id:maxId, rank:maxId, name:k.name, pos:k.pos, team:k.team, bye:'TBD',
            customScore:0, customRank:9999, vorp:null, adp:999, sf:999,
            drafted:false, isKeeper:false };
      players.push(p);
    }

    p.drafted  = true;
    p.isKeeper = true;
    p.rd = k.round;

    var slot    = (teamSlots[ownerTi] && teamSlots[ownerTi] > 0) ? teamSlots[ownerTi] : (ownerTi + 1);
    var pickNum = (k.round - 1) * TEAMS + slot;

    // Only add to pickLog if slot not already taken
    if (!pickLog.find(function(l){ return l.pick === pickNum; })) {
      pickLog.push({ pick:pickNum, rd:k.round, teamIdx:ownerTi,
        team:teamNames[ownerTi]||('Team '+(ownerTi+1)),
        player:k.name, pos:k.pos, nfl:k.team, isKeeper:true });
    }

    if (!teamRosters[ownerTi]) teamRosters[ownerTi] = [];
    var entry = Object.assign({}, p, { pickNum:pickNum, rd:k.round, isKeeper:true });
    if (!teamRosters[ownerTi].find(function(r){ return r.name === k.name; })) {
      teamRosters[ownerTi].push(entry);
    }

    // If my team, slot into roster panel
    if (ownerTi === myTeamIdx) {
      smartAssign(entry);
    }
    applied++;
  });

  // Advance currentPick past keeper slots
  while (currentPick <= TOTAL && pickLog.find(function(l){ return l.pick === currentPick; })) {
    currentPick++;
  }

  calcVORP();
  renderAll();
  if (ownerTi === myTeamIdx) renderRoster();
  setKeeperMsg('Applied ' + applied + ' keeper(s) for ' + (teamNames[ownerTi]||('Team '+(ownerTi+1))), false);
  clearKeeperChecks();
}

async function loadTeamRosterForKeepers() {
  var ownerTi = parseInt(document.getElementById('kpTeamOwner').value);
  if (ownerTi < 0) return;
  if (!sleeperLeagueId) { setKeeperMsg('Import your league first', true); return; }

  var listEl = document.getElementById('keeperRosterList');
  listEl.innerHTML = '<div style="color:#9ca3af;font-size:11px;padding:8px">Loading roster from Sleeper...</div>';
  populateTradeDropdowns();

  try {
    var BASE = 'https://api.sleeper.app/v1';
    var results = await Promise.all([
      sleeperFetch(BASE + '/league/' + sleeperLeagueId + '/rosters'),
      sleeperFetch(BASE + '/players/nfl')
    ]);
    var rosters = results[0];
    var allPlayers = results[1];
    rosters.sort(function(a,b){ return (a.roster_id||0)-(b.roster_id||0); });
    var myRosterData = rosters[ownerTi];
    if (!myRosterData || !myRosterData.players || !myRosterData.players.length) {
      listEl.innerHTML = '<div style="color:#f87171;font-size:11px;padding:8px">No players on this roster in Sleeper</div>';
      return;
    }
    var posColors = {QB:'#60a5fa',RB:'#4ade80',WR:'#fb923c',TE:'#c084fc',K:'#fbbf24',DEF:'#94a3b8'};
    var validPos = ['QB','RB','WR','TE','K','DEF'];
    var rosterPlayers = myRosterData.players.map(function(pid) {
      var pd = allPlayers[pid];
      if (!pd) return null;
      var pos = (pd.fantasy_positions && pd.fantasy_positions[0]) || '?';
      if (validPos.indexOf(pos) < 0) return null;
      return { name: ((pd.first_name||'') + ' ' + (pd.last_name||'')).trim(), pos: pos, team: pd.team || 'FA' };
    }).filter(Boolean).sort(function(a,b){ return validPos.indexOf(a.pos) - validPos.indexOf(b.pos); });

    listEl.innerHTML = rosterPlayers.map(function(p, i) {
      var color = posColors[p.pos] || '#9ca3af';
      return '<div style="display:flex;align-items:center;gap:8px;padding:5px 8px;border-bottom:1px solid #1a1d27">' +
        '<input type="checkbox" id="kp_' + i + '" onchange="keeperCheckChange()" style="cursor:pointer;width:14px;height:14px">' +
        '<span style="font-weight:700;font-size:10px;color:' + color + ';width:24px">' + p.pos + '</span>' +
        '<span style="flex:1;font-size:12px;color:#e8eaf0">' + p.name + '</span>' +
        '<span style="font-size:10px;color:#6b7280;width:30px">' + p.team + '</span>' +
        '<span style="font-size:10px;color:#6b7280;margin-right:2px">Rd</span>' +
        '<input type="number" id="kpr_' + i + '" min="1" max="18" placeholder="—" disabled ' +
          'style="width:40px;background:#252836;border:1px solid #374151;color:#fbbf24;border-radius:4px;padding:2px 4px;font-size:12px;text-align:center;outline:none" ' +
          'data-name="' + p.name + '" data-pos="' + p.pos + '" data-team="' + p.team + '">' +
      '</div>';
    }).join('');
    setKeeperMsg('Loaded ' + rosterPlayers.length + ' players — check up to 2 and enter cost round', false);
  } catch(e) {
    listEl.innerHTML = '<div style="color:#f87171;font-size:11px;padding:8px">Error: ' + e.message + '</div>';
  }
}

function keeperCheckChange() {
  var allChecks = document.querySelectorAll('#keeperRosterList input[type=checkbox]');
  var checked = Array.from(allChecks).filter(function(c){ return c.checked; });
  allChecks.forEach(function(c) {
    var i = c.id.replace('kp_','');
    var rdInput = document.getElementById('kpr_' + i);
    if (c.checked) {
      c.disabled = false;
      if (rdInput) { rdInput.disabled = false; rdInput.style.borderColor = '#fbbf24'; }
    } else {
      c.disabled = checked.length >= 2;
      if (rdInput) { rdInput.disabled = true; rdInput.value = ''; rdInput.style.borderColor = '#374151'; }
    }
  });
}

function clearKeeperChecks() {
  var allChecks = document.querySelectorAll('#keeperRosterList input[type=checkbox]');
  allChecks.forEach(function(c) {
    c.checked = false; c.disabled = false;
    var rdInput = document.getElementById('kpr_' + c.id.replace('kp_',''));
    if (rdInput) { rdInput.disabled = true; rdInput.value = ''; }
  });
}

function setKeeperMsg(msg, isError) {
  var el = document.getElementById('keeperMsg');
  if (!el) return;
  el.style.display = 'block';
  el.style.color = isError ? '#f87171' : '#4ade80';
  el.textContent = msg;
}

var pendingPickTrades = [];

function populateTradeDropdowns() {
  ['ptFrom','ptTo'].forEach(function(id) {
    var sel = document.getElementById(id);
    if (!sel) return;
    sel.innerHTML = '<option value="-1">' + (id==='ptFrom'?'From team...':'To team...') + '</option>';
    teamNames.forEach(function(n,i){ var o=document.createElement('option'); o.value=i; o.text=n; sel.appendChild(o); });
  });
  renderPickTradesList();
}

function addPickTrade() {
  var fromTi = parseInt(document.getElementById('ptFrom').value);
  var toTi   = parseInt(document.getElementById('ptTo').value);
  var round  = parseInt(document.getElementById('ptRound').value);
  if (fromTi < 0 || toTi < 0) { setKeeperMsg('Select both teams', true); return; }
  if (fromTi === toTi) { setKeeperMsg('Teams must be different', true); return; }
  pendingPickTrades.push({ fromTi: fromTi, toTi: toTi, round: round });
  renderPickTradesList();
  setKeeperMsg('Trade added — click Apply when done', false);
}

function renderPickTradesList() {
  var el = document.getElementById('pickTradesList');
  if (!el) return;
  if (!pendingPickTrades.length) { el.innerHTML = '<div style="color:#4b5563;font-size:11px;padding:4px">No trades recorded yet</div>'; return; }
  el.innerHTML = pendingPickTrades.map(function(t, i) {
    return '<div style="display:flex;align-items:center;gap:6px;padding:3px 4px;font-size:11px;border-bottom:1px solid #1a1d27">' +
      '<span style="color:#9ca3af;flex:1">' + (teamNames[t.fromTi]||'?') + '</span>' +
      '<span style="color:#c084fc">Rd ' + t.round + '</span>' +
      '<span style="color:#9ca3af;flex:1;text-align:right">' + (teamNames[t.toTi]||'?') + '</span>' +
      '<button onclick="removePickTrade(' + i + ')" style="background:transparent;border:none;color:#4b5563;cursor:pointer;font-size:14px;padding:0 4px">x</button>' +
    '</div>';
  }).join('');
}

function removePickTrade(i) { pendingPickTrades.splice(i,1); renderPickTradesList(); }

function applyPickTrades() {
  if (!pendingPickTrades.length) { setKeeperMsg('No trades to apply', true); return; }
  pendingPickTrades.forEach(function(t) {
    trades.push({ fromTeam: t.fromTi, toTeam: t.toTi, round: t.round });
    console.log('[Trade] Rd ' + t.round + ': ' + (teamNames[t.fromTi]||'T'+(t.fromTi+1)) + ' -> ' + (teamNames[t.toTi]||'T'+(t.toTi+1)));
  });
  buildPickOwners(); // rebuilds all 216 pick owners with traded picks applied
  renderAll();
  setKeeperMsg('Applied ' + pendingPickTrades.length + ' pick trade(s) to board', false);
  pendingPickTrades = []; renderPickTradesList();
}

function showKeyActive() {
  var entry = document.getElementById('aiKeyEntry');
  var tag = document.getElementById('aiActiveTag');
  var btns = document.getElementById('aiActionBtns');
  var chips = document.getElementById('aiChipsRow');
  var inputRow = document.getElementById('aiInputRow');
  if (entry) entry.style.display = 'none';
  if (tag) tag.style.display = 'inline';
  if (btns) btns.style.display = 'flex';
  if (chips) chips.style.display = 'block';
  if (inputRow) inputRow.style.display = 'flex';
  var resp = document.getElementById('aiResponse');
  if (resp) resp.innerHTML = '<span style="color:#4b5563;font-style:italic">Click ⚡ for pick advice.</span>';
}

function initAIPanel() {
  var chipsRow = document.getElementById('aiChipsRow');
  var chips = ['Who should I draft?','Am I QB heavy?','What position do I need?','Is my team balanced?'];
  if (chipsRow) {
    chipsRow.innerHTML = chips.map(function(c) {
      return '<button onclick="askAIChip(this)" data-c="' + c + '" style="font-size:10px;background:#1f2937;color:#9ca3af;border:1px solid #374151;border-radius:12px;padding:2px 8px;margin-right:4px;cursor:pointer">' + c + '</button>';
    }).join('');
  }
  if (apiKey) showKeyActive();
}

function buildDraftContext() {
  var myTi = myTeamIdx >= 0 ? myTeamIdx : -1;
  var roster = myTi >= 0 ? (teamRosters[myTi] || []) : [];
  var rl = roster.map(function(p){ return p.pos+' '+p.name+' ('+(p.team||'?')+')'; }).join('\n') || 'No picks yet';
  var avail = players.filter(function(p){ return !p.drafted && p.customScore>0; })
    .sort(function(a,b){ return (b.customScore||0)-(a.customScore||0); }).slice(0,15)
    .map(function(p){ return p.pos+' '+p.name+' ('+p.team+', '+(p.customScore||0).toFixed(0)+'pts, VORP:'+(p.vorp||0).toFixed(1)+')'; }).join('\n');
  var rd = Math.ceil(currentPick/TEAMS);
  var onClock = pickOwners ? pickOwners[currentPick-1] : -1;
  var isMyPick = myTeamIdx>=0 && onClock===myTeamIdx;
  return ['LEAGUE: '+TEAMS+'-team Superflex PPR, '+ROUNDS+' rounds',
    'SCORING: Pass 0.05/yd 4TD -2INT | Rush 0.1/yd 6TD | PPR +1 0.1/yd | Fumble -2',
    'ROSTER: QB RB WR WR TE W/R/T W/R SUPERFLEX K DEF + 8 bench. MAX 3 QBs.','',
    'Pick: #'+currentPick+' (Rd '+rd+') '+(isMyPick?'YOUR PICK':''),
    'QBs gone: '+players.filter(function(p){return p.pos==='QB'&&p.drafted;}).length,
    'My roster: QB:'+roster.filter(function(p){return p.pos==='QB';}).length+
      ' RB:'+roster.filter(function(p){return p.pos==='RB';}).length+
      ' WR:'+roster.filter(function(p){return p.pos==='WR';}).length+
      ' TE:'+roster.filter(function(p){return p.pos==='TE';}).length,'',
    'MY ROSTER ('+roster.length+'/'+ROUNDS+'):',rl,'','TOP 15 AVAILABLE:',avail].join('\n');
}

async function askAI(type) {
  if (!apiKey || aiLoading) return;
  var rd = Math.ceil(currentPick/TEAMS);
  var onClock = pickOwners ? pickOwners[currentPick-1] : -1;
  var isMyPick = myTeamIdx>=0 && onClock===myTeamIdx;
  var prompt = type==='quick'
    ? (isMyPick ? "It's my pick (#"+currentPick+", Round "+rd+"). Who should I draft? Name 1-2 players, cite VORP, mention position urgency."
                : "Not my pick (Pick #"+currentPick+", Rd "+rd+"). What should I target next?")
    : "Full team analysis: strengths, weaknesses, urgent positions, strategy for remaining "+(ROUNDS-(teamRosters[myTeamIdx]||[]).length)+" picks.";
  await sendToAI(prompt);
}

async function askAICustom(prompt) { if(!apiKey||aiLoading||!prompt) return; await sendToAI(prompt); }

async function sendToAI(userMessage) {
  if (!apiKey) return;
  aiLoading = true;
  var btn = document.getElementById('quickBtn');
  if (btn) btn.textContent = '⏳...';
  var resp = document.getElementById('aiResponse');
  if (resp) resp.innerHTML = '<div style="color:#6b7280;font-size:10px">Analyzing...</div>';
  var sys = 'You are an expert fantasy football draft advisor. '+buildDraftContext()+' Give sharp specific advice. Reference player names and VORP. Account for Superflex and custom scoring.';
  try {
    var res = await fetch('https://api.anthropic.com/v1/messages', {
      method:'POST',
      headers:{'Content-Type':'application/json','x-api-key':apiKey,'anthropic-version':'2023-06-01','anthropic-dangerous-direct-browser-access':'true'},
      body:JSON.stringify({model:'claude-sonnet-4-20250514',max_tokens:500,system:sys,messages:[{role:'user',content:userMessage}]})
    });
    var data = await res.json();
    var reply = (data.content&&data.content[0]) ? data.content[0].text : 'No response.';
    if (resp) resp.innerHTML = reply.split('\n').join('<br>');
  } catch(e) {
    var msg = e.message||'Error';
    if (msg.includes('401')) msg='Invalid API key.';
    if (msg.includes('429')) msg='Rate limited.';
    if (resp) resp.innerHTML = '<span style="color:#f87171">❌ '+msg+'</span>';
  } finally {
    aiLoading = false;
    if (btn) btn.textContent = '⚡ My pick';
  }
}

function saveApiKey() {
  var input = document.getElementById('apiKeyInputEl');
  var key = input ? input.value.trim() : '';
  if (!key.startsWith('sk-')) { alert('Key should start with sk-'); return; }
  apiKey = key;
  localStorage.setItem('ff26_apiKey', apiKey);
  showKeyActive();
}

function sendStrip() {
  var el = document.getElementById('aiStripInputEl');
  if (el && el.value.trim()) { askAICustom(el.value); el.value = ''; }
}

function doAskAIQuick() { askAI('quick'); }
function doAskAIFull()  { askAI('full'); }
function switchRoster() { switchTab('roster'); }
function switchTeams()  { switchTab('teams'); }
function switchQBs()    { switchTab('qbs'); }
function switchTrades() { switchTab('trades'); }
function showDraftTab()  { showMainTab('draft'); }
function showAIChatTab() { showMainTab('aiChat'); }

// ── Init ──
(function init() {
  try {
    var sel = document.getElementById('myTeamSel');
    if (sel) {
      sel.innerHTML = '<option value="-1">— Select your team —</option>';
      teamNames.forEach(function(n, i) { var o=document.createElement('option'); o.value=i; o.text=n; sel.appendChild(o); });
    }
    teamSlots = Array(TEAMS).fill(0);
    pickOwners = [];
    for (var pick = 1; pick <= TOTAL; pick++) {
      var rd = Math.ceil(pick/TEAMS), pos = pick-(rd-1)*TEAMS;
      pickOwners.push(rd%2===1 ? pos-1 : TEAMS-pos);
    }
    initPlayers();
    calcVORP();
    renderAll();
    initAIPanel();
    var savedKey = localStorage.getItem('ff26_apiKey');
    if (savedKey) { apiKey = savedKey; showKeyActive(); }
    checkSession();
  } catch(e) {
    console.error('[Init error]', e);
    var am = document.getElementById('authModal');
    if (am) am.style.display = 'flex';
  }
})();


// ── Load All Players from Sleeper ──
async function loadAllPlayersFromSleeper() {
  const btn = document.getElementById('loadAllPlayersBtn');
  const status = document.getElementById('playerLoadStatus');
  if (btn) { btn.disabled = true; btn.textContent = '⏳ Loading...'; }
  if (status) { status.style.display = 'inline'; status.textContent = 'Fetching from Sleeper...'; }
  try {
    const playerMap = await sleeperFetch('https://api.sleeper.app/v1/players/nfl');
    const VALID_POS = ['QB','RB','WR','TE','K','DEF'];
    const normalize = n => n.toLowerCase().replace(/[''`']/g,"'").replace(/\s+/g,' ').trim();
    const existing = new Set(players.map(p => normalize(p.name)));
    let added = 0;
    let maxId = Math.max(...players.map(p => p.id||0), 200);
    const playerList = Object.values(playerMap)
      .filter(p => {
        if (!p.active) return false;
        if (!p.team || p.team === 'FA') return false;
        const pos = p.fantasy_positions && p.fantasy_positions[0];
        if (!VALID_POS.includes(pos)) return false;
        if (!p.last_name) return false;
        if (p.search_rank && p.search_rank > 500) return false;
        return true;
      })
      .sort((a,b) => (a.search_rank||999) - (b.search_rank||999));
    playerList.forEach(p => {
      const fullName = ((p.first_name||'') + ' ' + (p.last_name||'')).trim();
      if (!fullName || existing.has(normalize(fullName))) return;
      const pos = (p.fantasy_positions && p.fantasy_positions[0]) || 'WR';
      maxId++;
      players.push({
        rank: maxId, name: fullName, pos, team: p.team, bye: 'TBD',
        adp: p.search_rank||999, sf: p.search_rank||999,
        note: p.college||'Sleeper import', fit: '?',
        drafted: false, isKeeper: false, customScore: 0,
        customRank: 9999, vorp: null, vorpRank: 9999,
        sleeperPlayerId: p.player_id,
      });
      existing.add(normalize(fullName));
      added++;
    });
    calcVORP(); renderBA();
    const total = players.length;
    if (status) status.textContent = `✅ ${added} players added — ${total} total in pool`;
    if (btn) btn.textContent = `✅ ${total} players loaded`;
  } catch(e) {
    if (status) status.textContent = '❌ ' + e.message;
    if (btn) { btn.disabled = false; btn.textContent = '📥 Load 500+ players from Sleeper'; }
  }
}


async function loadAllPlayersFromSleeper() {
  const btn = document.getElementById('loadAllPlayersBtn');
  const status = document.getElementById('playerLoadStatus');
  if (btn) { btn.disabled = true; btn.textContent = 'Loading...'; }
  if (status) { status.style.display = 'inline'; status.textContent = 'Fetching...'; }
  try {
    const playerMap = await sleeperFetch('https://api.sleeper.app/v1/players/nfl');
    const VALID_POS = ['QB','RB','WR','TE','K','DEF'];
    const norm = n => n.toLowerCase().replace(/[^a-z0-9 ]/g,' ').trim();
    const existing = new Set(players.map(p => norm(p.name)));
    let added = 0, maxId = Math.max(...players.map(p=>p.id||0), 200);
    Object.values(playerMap).filter(p=>{
      if(!p.active||!p.team||p.team==='FA') return false;
      const pos=p.fantasy_positions&&p.fantasy_positions[0];
      return VALID_POS.includes(pos)&&p.last_name&&(!p.search_rank||p.search_rank<=500);
    }).sort((a,b)=>(a.search_rank||999)-(b.search_rank||999)).forEach(p=>{
      const fn=((p.first_name||'')+' '+(p.last_name||'')).trim();
      if(!fn||existing.has(norm(fn))) return;
      maxId++;
      players.push({rank:maxId,name:fn,pos:p.fantasy_positions[0],team:p.team,bye:'TBD',
        adp:p.search_rank||999,sf:p.search_rank||999,note:p.college||'Sleeper',fit:'?',
        drafted:false,isKeeper:false,customScore:0,customRank:9999,vorp:null,vorpRank:9999});
      existing.add(norm(fn)); added++;
    });
    calcVORP(); renderBA();
    if(status) status.textContent = added+' added — '+players.length+' total';
    if(btn) btn.textContent = players.length+' players loaded';
  } catch(e) {
    if(status) status.textContent = 'Error: '+e.message;
    if(btn){btn.disabled=false;btn.textContent='Load 500+ players from Sleeper';}
  }
}

// ── MOCK DRAFT ──
var mockState = null;

function openMockDraft() {
  ['mockSettings','mockLive','mockResults'].forEach(function(id,i){
    var el=document.getElementById(id); if(el) el.style.display=i===0?'block':'none';
  });
  document.getElementById('mockModal').style.display='flex';
  var sel=document.getElementById('mockMySlot');
  if(sel){sel.innerHTML='<option value="">Select slot...</option>';
    for(var i=1;i<=TEAMS;i++){var o=document.createElement('option');o.value=i;o.text='Slot '+i;if(myTeamIdx>=0&&teamSlots[myTeamIdx]===i)o.selected=true;sel.appendChild(o);}
  }
  var keepers=myRosterSlots.filter(function(s){return s&&s.isKeeper;});
  var kd=document.getElementById('mockKeepersSummary');if(kd)kd.style.display=keepers.length?'block':'none';
  var kt=document.getElementById('mockKeepersText');if(kt)kt.textContent=keepers.map(function(p){return p.pos+' '+p.name;}).join(' · ');
}

function closeMockModal() {
  document.getElementById('mockModal').style.display='none';
  document.body.removeAttribute('data-mock');
  var b=document.getElementById('mockBanner');if(b)b.style.display='none';
  if(mockState&&mockState.timerInterval)clearInterval(mockState.timerInterval);
  if(mockState&&mockState.savedPickLog!==undefined){
    pickLog=mockState.savedPickLog;teamRosters=mockState.savedTeamRosters;
    currentPick=mockState.savedCurrentPick;myRosterSlots=mockState.savedMyRosterSlots;
    if(mockState.savedMyTeamIdx!==undefined)myTeamIdx=mockState.savedMyTeamIdx;
  }
  players.forEach(function(p){p.drafted=pickLog.some(function(l){return l.player===p.name;});p.mockDrafted=false;});
  mockState=null;calcVORP();renderAll();
}

function startMockDraft() {
  var mySlot=parseInt(document.getElementById('mockMySlot').value);
  if(!mySlot){alert('Select your draft slot');return;}
  var strategy=document.getElementById('mockStrategy').value;
  var myStrategy=document.getElementById('mockMyStrategy').value;
  var timerSecs=parseInt(document.getElementById('mockTimer').value);
  var po=[];
  for(var pick=1;pick<=TOTAL;pick++){var rd=Math.ceil(pick/TEAMS),pos=pick-(rd-1)*TEAMS;po.push(rd%2===1?pos:TEAMS+1-pos);}
  var myTi=mySlot-1;
  var mr=Array.from({length:TEAMS},function(){return [];});
  myRosterSlots.forEach(function(p){if(p&&p.isKeeper)mr[myTi].push(p);});
  mockState={players:players.map(function(p){return Object.assign({},p,{mockDrafted:p.isKeeper||false});}),
    pickOwners:po,rosters:mr,mySlot:mySlot,myTi:myTi,strategy:strategy,myStrategy:myStrategy,
    timerSecs:timerSecs,currentPick:1,totalPicks:TOTAL,log:[],timerInterval:null,timerLeft:timerSecs,waiting:false,
    savedPickLog:pickLog.slice(),savedTeamRosters:teamRosters.map(function(r){return r.slice();}),
    savedCurrentPick:currentPick,savedMyRosterSlots:myRosterSlots.slice(),savedMyTeamIdx:myTeamIdx};
  pickLog=[];teamRosters=Array.from({length:TEAMS},function(){return [];});currentPick=1;
  myRosterSlots=Array(ROUNDS+8).fill(null);
  mockState.savedMyRosterSlots.forEach(function(s){if(s&&s.isKeeper)smartAssign(s);});
  myTeamIdx=myTi;
  document.getElementById('mockModal').style.display='none';
  var bn=document.getElementById('mockBanner');if(bn)bn.style.display='flex';
  document.body.setAttribute('data-mock','1');
  runMockDraft();
}

function cpuPick(ti,strategy,mp,mr){
  var roster=mr[ti]||[],available=mp.filter(function(p){return !p.mockDrafted;});
  var qbs=roster.filter(function(p){return p.pos==='QB';}).length;
  var rbs=roster.filter(function(p){return p.pos==='RB';}).length;
  var wrs=roster.filter(function(p){return p.pos==='WR';}).length;
  var tes=roster.filter(function(p){return p.pos==='TE';}).length;
  var size=roster.length;
  if(strategy==='vorp'){
    var f=available.filter(function(p){if(!p.customScore||p.customScore<=0)return false;if(p.pos==='QB'&&qbs>=3)return false;if(p.pos==='QB'&&qbs>=2&&size<12)return false;if((p.pos==='K'||p.pos==='DEF')&&size<14)return false;return true;});
    f.sort(function(a,b){return (b.vorp||0)-(a.vorp||0);});return f[0]||available[0];
  }
  if(strategy==='adp'){available.sort(function(a,b){return (a.adp||999)-(b.adp||999);});for(var i=0;i<available.length;i++){if(available[i].pos==='QB'&&qbs>=2&&size<14)continue;return available[i];}return available[0];}
  var byPos={};['QB','RB','WR','TE','K','DEF'].forEach(function(p){byPos[p]=available.filter(function(x){return x.pos===p&&x.customScore>0;}).sort(function(a,b){return (b.customScore||0)-(a.customScore||0);});});
  var ps={QB:qbs===0?80:qbs===1&&size>7?50:qbs>=2?-999:0,RB:rbs===0?75:rbs===1?60:rbs===2?40:rbs===3?20:5,WR:wrs===0?70:wrs===1?55:wrs===2?35:wrs===3?15:5,TE:tes===0?65:tes===1?0:-20,K:size>=14?30:-999,DEF:size>=15?25:-999};
  var best=null,bs=-9999;
  ['QB','RB','WR','TE','K','DEF'].forEach(function(p){var ns=ps[p]||0;if(ns<=-999)return;var tp=byPos[p]&&byPos[p][0];if(!tp)return;var total=ns+Math.min((tp.customScore||0)/5,60);if(total>bs){bs=total;best=tp;}});
  if(best)return best;
  available.sort(function(a,b){return (b.customScore||0)-(a.customScore||0);});
  return available.find(function(p){return p.pos!=='K'&&p.pos!=='DEF';})||available[0];
}

function mockAutoPick(){if(!mockState||!mockState.waiting)return;var p=cpuPick(mockState.myTi,mockState.myStrategy||'vorp',mockState.players,mockState.rosters);if(p){var mp=mockState.players.find(function(x){return x.name===p.name;});executeMockPick(mp||p);}}

function executeMockPick(p){
  if(!mockState||p.drafted)return;
  var pick=mockState.currentPick,slot=mockState.pickOwners[pick-1],ti=slot-1,rd=Math.ceil(pick/TEAMS),isMe=slot===mockState.mySlot;
  p.drafted=true;p.mockDrafted=true;
  if(!mockState.rosters[ti])mockState.rosters[ti]=[];
  mockState.rosters[ti].push(p);
  var entry=Object.assign({},p,{pickNum:pick,rd:rd,isKeeper:false});
  if(!teamRosters[ti])teamRosters[ti]=[];
  teamRosters[ti].push(entry);
  pickLog.push({pick:pick,rd:rd,teamIdx:ti,team:teamNames[ti]||'T'+(ti+1),player:p.name,pos:p.pos,nfl:p.team,isKeeper:false});
  currentPick=pick+1;renderLog();
  if(isMe){smartAssign(entry);renderRoster();setTimeout(showPickSuggestions,100);}
  var mp=players.find(function(x){return x.name===p.name;});if(mp)mp.drafted=true;
  mockState.log.push({pick:pick,rd:rd,slot:slot,isMe:isMe,name:p.name,pos:p.pos,team:p.team,vorp:p.vorp||0});
  mockState.currentPick++;mockState.waiting=false;
  if(mockState.timerInterval){clearInterval(mockState.timerInterval);mockState.timerInterval=null;}
  var bt=document.getElementById('mockBannerTimer');if(bt)bt.textContent='';
  var bc=document.getElementById('mockBannerPick');if(bc)bc.textContent='Pick '+mockState.currentPick+'/'+mockState.totalPicks;
  renderBA();setTimeout(runMockDraft,isMe?300:60);
}

function executeMockPickSilent(p){if(!mockState)return;p.mockDrafted=true;var pick=mockState.currentPick,slot=mockState.pickOwners[pick-1],ti=slot-1,rd=Math.ceil(pick/TEAMS);if(!mockState.rosters[ti])mockState.rosters[ti]=[];mockState.rosters[ti].push(p);mockState.log.push({pick:pick,rd:rd,slot:slot,isMe:false,name:p.name,pos:p.pos,team:p.team,vorp:p.vorp||0});mockState.currentPick++;}

function runMockDraft(){
  if(!mockState)return;
  if(mockState.currentPick>mockState.totalPicks){showMockResults();return;}
  var slot=mockState.pickOwners[mockState.currentPick-1],ti=slot-1,rd=Math.ceil(mockState.currentPick/TEAMS),isMe=slot===mockState.mySlot;
  var clk=document.getElementById('clk');
  if(isMe){
    setTimeout(showPickSuggestions,50);
    if(clk){clk.textContent='MOCK — Pick #'+mockState.currentPick+' · Rd '+rd+' · YOUR PICK';clk.style.background='#1e3a5f';}
    var te=document.getElementById('mockBannerTimer');
    if(mockState.myStrategy!=='manual'){setTimeout(mockAutoPick,1200);return;}
    mockState.waiting=true;renderBA();
    if(mockState.timerSecs>0){mockState.timerLeft=mockState.timerSecs;if(te)te.textContent=mockState.timerLeft+'s';
      mockState.timerInterval=setInterval(function(){mockState.timerLeft--;if(te)te.textContent=mockState.timerLeft+'s';if(mockState.timerLeft<=0){clearInterval(mockState.timerInterval);mockState.timerInterval=null;if(te)te.textContent='';mockAutoPick();}},1000);}
  } else {
    var pp=cpuPick(ti,mockState.strategy,mockState.players,mockState.rosters);
    if(pp)setTimeout(function(){executeMockPick(pp);},120);else{mockState.currentPick++;setTimeout(runMockDraft,50);}
  }
}

function skipToMyPick(){if(!mockState)return;if(mockState.timerInterval){clearInterval(mockState.timerInterval);mockState.timerInterval=null;}mockState.waiting=false;function ff(){if(!mockState||mockState.currentPick>mockState.totalPicks){showMockResults();return;}var slot=mockState.pickOwners[mockState.currentPick-1];if(slot===mockState.mySlot){runMockDraft();return;}var p=cpuPick(slot-1,mockState.strategy,mockState.players,mockState.rosters);if(p)executeMockPickSilent(p);else mockState.currentPick++;setTimeout(ff,5);}ff();}

function finishMockDraft(){if(!mockState)return;if(mockState.timerInterval){clearInterval(mockState.timerInterval);mockState.timerInterval=null;}while(mockState.currentPick<=mockState.totalPicks){var slot=mockState.pickOwners[mockState.currentPick-1],ti=slot-1,isMe=slot===mockState.mySlot;var p=isMe?cpuPick(mockState.myTi,mockState.myStrategy||'vorp',mockState.players,mockState.rosters):cpuPick(ti,mockState.strategy,mockState.players,mockState.rosters);if(p)executeMockPickSilent(p);else mockState.currentPick++;}showMockResults();}

function showMockResults(){
  document.body.removeAttribute('data-mock');var b=document.getElementById('mockBanner');if(b)b.style.display='none';
  if(mockState&&mockState.savedPickLog!==undefined){pickLog=mockState.savedPickLog;teamRosters=mockState.savedTeamRosters;currentPick=mockState.savedCurrentPick;myRosterSlots=mockState.savedMyRosterSlots;if(mockState.savedMyTeamIdx!==undefined)myTeamIdx=mockState.savedMyTeamIdx;}
  players.forEach(function(p){p.drafted=pickLog.some(function(l){return l.player===p.name;});p.mockDrafted=false;});
  calcVORP();renderAll();
  document.getElementById('mockModal').style.display='flex';
  var ms=document.getElementById('mockSettings'),ml=document.getElementById('mockLive'),mr=document.getElementById('mockResults');
  if(ms)ms.style.display='none';if(ml)ml.style.display='none';if(mr)mr.style.display='block';
  var myRoster=mockState.rosters[mockState.myTi]||[];
  var proj=myRoster.slice(0,10).reduce(function(s,p){return s+(p.customScore||0);},0);
  var all=mockState.rosters.map(function(r){return r.slice(0,10).reduce(function(s,p){return s+(p.customScore||0);},0);});
  var avg=all.reduce(function(a,b){return a+b;},0)/TEAMS;
  var rank=all.filter(function(x){return x>proj;}).length+1;
  var grade=rank<=2?'A+':rank<=4?'A':rank<=6?'B+':rank<=8?'B':'C';
  var gc=grade.startsWith('A')?'#4ade80':grade.startsWith('B')?'#60a5fa':'#f87171';
  var picks=mockState.log.filter(function(e){return e.isMe;});
  var best=picks.reduce(function(b,e){return e.vorp>b.vorp?e:b;},picks[0]||{vorp:0,name:'—',rd:0});
  var worst=picks.reduce(function(w,e){return e.vorp<w.vorp?e:w;},picks[0]||{vorp:0,name:'—',rd:0});
  var rc=document.getElementById('mockResultsContent');if(!rc)return;
  rc.innerHTML='<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:14px">'+
    '<div style="background:#252836;border-radius:8px;padding:12px;text-align:center"><div style="font-size:36px;font-weight:700;color:'+gc+'">'+grade+'</div><div style="font-size:11px;color:#6b7280">Draft grade</div></div>'+
    '<div style="background:#252836;border-radius:8px;padding:12px;text-align:center"><div style="font-size:24px;font-weight:700;color:#4ade80">'+proj.toFixed(0)+'</div><div style="font-size:11px;color:#6b7280">Proj pts · Rank #'+rank+' of '+TEAMS+'</div></div></div>'+
    '<div style="background:#252836;border-radius:8px;padding:12px;font-size:11px;margin-bottom:10px"><div style="font-weight:600;color:#9ca3af;margin-bottom:6px">YOUR ROSTER ('+myRoster.length+' picks)</div>'+
    myRoster.map(function(p,i){var c=p.pos==='QB'?'#60a5fa':p.pos==='RB'?'#4ade80':p.pos==='WR'?'#fb923c':'#c084fc';return '<div style="display:flex;gap:8px;padding:3px 0;border-bottom:1px solid #1a1d27"><span style="width:18px;color:#4b5563;font-size:10px">'+(i+1)+'</span><span style="font-weight:700;width:24px;color:'+c+';font-size:10px">'+p.pos+'</span><span style="flex:1;color:#e8eaf0;font-size:11px">'+p.name+'</span><span style="color:#4ade80;font-size:10px">'+(p.vorp>0?'+':'')+(p.vorp||0).toFixed(0)+'V</span></div>';}).join('')+'</div>'+
    '<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;font-size:11px">'+
    '<div style="background:#1a3a2a;border-radius:6px;padding:10px"><div style="color:#6b7280;margin-bottom:4px">Best pick</div><div style="color:#4ade80;font-weight:600">'+best.name+'</div><div style="color:#6b7280">Rd '+(best.rd||'?')+' · VORP '+(best.vorp>0?'+':'')+best.vorp.toFixed(0)+'</div></div>'+
    '<div style="background:#2d1515;border-radius:6px;padding:10px"><div style="color:#6b7280;margin-bottom:4px">Biggest reach</div><div style="color:#fca5a5;font-weight:600">'+worst.name+'</div><div style="color:#6b7280">Rd '+(worst.rd||'?')+' · VORP '+(worst.vorp>0?'+':'')+worst.vorp.toFixed(0)+'</div></div></div>';
}
