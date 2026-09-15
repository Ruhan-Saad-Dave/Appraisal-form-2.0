const base = process.env.API_BASE_URL;
const email = process.env.API_EMAIL;
const password = process.env.API_PASSWORD;

const loginRes = await fetch(`${base}/auth/login`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ email, password }),
});
const loginData = await loginRes.json();
console.log("login response:", JSON.stringify(loginData, null, 2).slice(0, 800));
const token = loginData.access_token || loginData.token;
if (!token) process.exit(1);

const res = await fetch(`${base}/appraisal/snapshot?academic_year=2026-2027`, {
  headers: { Authorization: `Bearer ${token}` },
});
console.log("\nsnapshot status:", res.status);
const text = await res.text();
console.log(text.slice(0, 2000));
