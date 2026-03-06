const fs = require('fs');
let content = fs.readFileSync('src/index.ts', 'utf8');
content = content.replace(
    `<form onsubmit="handleDelete(event, '\\${e.uid}')">\n                      <button type="submit" class="btn-delete">Delete</button>\n                    </form>`,
    `<form onsubmit="handleDelete(event, '\\${e.uid}')" style="display: flex; gap: 0.5rem; flex-shrink: 0;">\n                      <input type="password" id="del-pass-\\${e.uid}" placeholder="Password to delete" required style="width: 140px; padding: 0.4rem; font-size: 0.8rem; border-radius: 6px; border: 1px solid var(--border-dark); background: var(--bg-void); color: var(--text-primary);">\n                      <button type="submit" class="btn-delete">Delete</button>\n                    </form>`
);
fs.writeFileSync('src/index.ts', content);
