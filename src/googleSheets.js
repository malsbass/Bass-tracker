const SHEET_ID = import.meta.env.VITE_SHEET_ID;
const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID;
const SCOPES = "https://www.googleapis.com/auth/spreadsheets";
const RANGE = "Sheet1!A2:B2";

let tokenClient;
let accessToken = null;

export function initGoogleAuth(onSuccess) {
  tokenClient = window.google.accounts.oauth2.initTokenClient({
    client_id: CLIENT_ID,
    scope: SCOPES,
    callback: (response) => {
      if (response.error) return;
      accessToken = response.access_token;
      onSuccess();
    },
  });
}

export function signIn() {
  tokenClient.requestAccessToken({ prompt: "consent" });
}

export function signOut() {
  if (accessToken) {
    window.google.accounts.oauth2.revoke(accessToken);
    accessToken = null;
  }
}

export async function readData() {
  const res = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/${RANGE}`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
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
  await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/${RANGE}?valueInputOption=RAW`,
    {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        range: RANGE,
        majorDimension: "ROWS",
        values: [[JSON.stringify(data), now]],
      }),
    }
  );
  return now;
}

