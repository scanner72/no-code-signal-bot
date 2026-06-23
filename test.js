fetch("http://localhost:3000/api/auth/sign-up/email", {
  method: "POST",
  headers: { "Content-Type": "application/json", "Origin": "http://localhost" },
  body: JSON.stringify({name: "test", email: "test2@example.com", password: "password"})
}).then(r => r.text().then(t => console.log(r.status, t))).catch(console.error);
