const fs = require('fs');
const path = require('path');

function list(dir, depth = 0, maxDepth = 2) {
  const entries = fs.readdirSync(dir, { withFileTypes: true })
    .sort((a, b) => a.name.localeCompare(b.name, 'en'));
  for (const entry of entries) {
    const prefix = '  '.repeat(depth);
    console.log(`${prefix}${entry.isDirectory() ? '[D]' : '[F]'} ${entry.name}`);
    if (entry.isDirectory() && depth < maxDepth) {
      list(path.join(dir, entry.name), depth + 1, maxDepth);
    }
  }
}

console.log(process.cwd());
list(process.cwd());
