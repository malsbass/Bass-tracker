const SHEET_ID = import.meta.env.VITE_SHEET_ID;
const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID;
const SCOPES = "https://www.googleapis.com/auth/spreadsheets";
const RANGE = "Sheet1!A2:B2";

let tokenClient;
let accessToken = null;
let onAuthSuccess = null;
let onAuthFailure = null;

export function initGoogleAuth(onSuccess, onFailure) {
  onAuthSuccess = onSuccess;
  onAuthFailure = onFailure;
  tokenClient = window.google.accounts.oauth2.initTokenClient({
    client_id: CLIENT_ID,
    scope: SCOPES,
    callback: (response) => {
      if (response.error) {
        if (onAuthFailure) onAuthFailure();
        return;
      }
      accessToken = response.access_token;
      if (onAuthSuccess) onAuthSuccess();
    },
  });
}

export function signIn(silent = false) {
  tokenClient.requestAccessToken({ prompt: silent ? "" : "consent" });
}

export function signOut() {
  if (accessToken) {
    window.google.accounts.oauth2.revoke(accessToken);
    accessToken = null;
  }
}

function refreshToken() {
  return new Promise((resolve) => {
    const prev = onAuthSuccess;
    onAuthSuccess = () => {
      onAuthSuccess = prev;
      resolve();
    };
    tokenClient.requestAccessToken({ prompt: "" });
  });
}

async function fetchWithAuth(url, options = {}) {
  let res = await fetch(url, {
    ...options,
    headers: { ...options.headers, Authorization: `Bearer ${accessToken}` },
  });
  if (res.status === 401) {
    await refreshToken();
    res = await fetch(url, {
      ...options,
      headers: { ...options.headers, Authorization: `Bearer ${accessToken}` },
    });
  }
  return res;
}

export async function readData() {
  const res = await fetchWithAuth(
    `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/${RANGE}`
  );
  const json = await res.json();
  const values = json.values;
  if (!values?.[0]?.[0]) return { data: {}, updatedAt: null };
  try {
    return { data: JSON.parse(values[0][0]), updatedAt: values[0][1] || null };
  } catch {
    return { data: {}, updatedAt: null };
  }
}

export async function writeData(data) {
  const now = new Date().toISOString();
  await fetchWithAuth(
    `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/${RANGE}?valueInputOption=RAW`,
    {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        range: RANGE,
        majorDimension: "ROWS",
        values: [[JSON.stringify(data), now]],
      }),
    }
  );
  return now;
}
