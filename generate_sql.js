const fs = require('fs');
const md = fs.readFileSync('TESTING_RESULTS.md', 'utf8');
const lines = md.split('\n');

const updates = [];

for (const line of lines) {
  if (line.trim().startsWith('|')) {
    const parts = line.split('|').map(p => p.trim());
    if (parts.length >= 4) {
      const code = parts[1];
      const statusRaw = parts[2];
      const note = parts[3].replace(/'/g, "''");

      let status = '';
      let isFail = false;
      let isWarn = false;

      if (statusRaw.includes('PASS')) {
        status = 'نجح';
      } else if (statusRaw.includes('FAIL')) {
        status = 'فشل';
        isFail = true;
      } else if (statusRaw.includes('WARN')) {
        status = 'تخطي';
        isWarn = true;
      }

      if (status && code.match(/^[A-Z]+-\d+/)) {
        updates.push({ code, status, note, isFail, isWarn });
      }
    }
  }
}

let sql = `UPDATE test_items AS t SET
  status = v.status,
  notes = CASE WHEN v.is_fail OR v.is_warn THEN v.note ELSE t.notes END,
  tester_name = CASE WHEN v.is_fail THEN 'سيد' ELSE t.tester_name END
FROM (VALUES
`;

sql += updates.map(u => `  ('${u.code}', '${u.status}', '${u.isFail || u.isWarn ? u.note : ''}', ${u.isFail})`).join(',\n');

sql += `\n) AS v(code, status, note, is_fail)
WHERE t.code = v.code;`;

fs.writeFileSync('update.sql', sql);
console.log('Done writing update.sql');
