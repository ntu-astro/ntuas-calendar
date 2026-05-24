export const LOGIN_HTML = (error: boolean) => `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Admin Login — NTUAS Calendar</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
  <style>
    :root {
      /* Notion blue primary (DESIGN.md link-blue token) */
      --color-primary: #0075de;
      --color-primary-pressed: #005bab;
      --on-primary: #ffffff;
      --color-canvas: #ffffff;
      --color-surface: #f6f5f4;
      --color-hairline: #e5e3df;
      --color-hairline-strong: #c8c4be;
      --color-ink: #1a1a1a;
      --color-charcoal: #37352f;
      --color-steel: #787671;
      --color-error: #e03131;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: 'Notion Sans', 'Inter', -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif;
      background: var(--color-surface);
      color: var(--color-charcoal);
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      -webkit-font-smoothing: antialiased;
      font-size: 14px;
    }
    /* DESIGN.md card-feature — 12px rounded canvas card with subtle elevation */
    .login-card {
      background: var(--color-canvas);
      border: 1px solid var(--color-hairline);
      border-radius: 12px;
      padding: 40px 32px;
      width: 90%;
      max-width: 380px;
      box-shadow: rgba(15, 15, 15, 0.08) 0px 4px 12px 0px;
      text-align: center;
    }
    /* DESIGN.md heading-4 */
    .login-card h1 {
      font-size: 22px;
      font-weight: 600;
      letter-spacing: -0.01em;
      margin-bottom: 6px;
      color: var(--color-ink);
      line-height: 1.3;
    }
    .login-card p {
      color: var(--color-steel);
      font-size: 14px;
      margin-bottom: 24px;
    }
    /* DESIGN.md text-input — 44px height, 8px rounded, hairline-strong border */
    .login-card input {
      width: 100%;
      padding: 10px 14px;
      border-radius: 8px;
      border: 1px solid var(--color-hairline-strong);
      background: var(--color-canvas);
      color: var(--color-ink);
      font-family: inherit;
      font-size: 14px;
      transition: border-color 0.15s, box-shadow 0.15s;
      text-align: center;
      height: 44px;
    }
    /* text-input-focused — blue ring */
    .login-card input:focus {
      outline: none;
      border-color: var(--color-primary);
      box-shadow: 0 0 0 3px rgba(0, 117, 222, 0.18);
    }
    /* DESIGN.md button-primary — signature purple rectangular CTA */
    .login-card button {
      width: 100%;
      padding: 10px 18px;
      margin-top: 14px;
      border: none;
      border-radius: 8px;
      background: var(--color-primary);
      color: var(--on-primary);
      font-family: inherit;
      font-size: 14px;
      font-weight: 500;
      line-height: 1.3;
      cursor: pointer;
      transition: background 0.15s;
    }
    .login-card button:hover {
      background: var(--color-primary-pressed);
    }
    .error-msg {
      color: var(--color-error);
      font-size: 13px;
      font-weight: 500;
      margin-top: 14px;
    }
  </style>
</head>
<body>
  <div class="login-card">
    <h1>NTUAS Admin</h1>
    <p>Enter the admin password to continue.</p>
    <form method="POST" action="/admin/login">
      <input type="password" name="password" placeholder="Password" required autofocus>
      <button type="submit">Sign In</button>
    </form>
    ${error ? '<p class="error-msg">Incorrect password. Please try again.</p>' : ''}
  </div>
</body>
</html>`;
