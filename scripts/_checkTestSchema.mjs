const base = process.env.API_BASE_URL;
const email = process.env.API_EMAIL;
const password = process.env.API_PASSWORD;

const loginRes = await fetch(`${base}/auth/login`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ email, password }),
});
const loginData = await loginRes.json();
const token = loginData.token;

const res = await fetch(`${base}/appraisal/form-schema?academic_year=2026-2027`, {
  headers: { Authorization: `Bearer ${token}` },
});
const records = await res.json();
console.log("record count:", records.length);
console.log(JSON.stringify(records, null, 2));
