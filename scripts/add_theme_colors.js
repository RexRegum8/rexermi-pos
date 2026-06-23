const Database = require('better-sqlite3');
const path = require('path');
const db = new Database(path.join(process.cwd(), 'src', 'data', 'database.sqlite'));

const newSettings = [
  { key: 'text_color_dark',  value: '#F0EFE8', label: 'Color del texto (oscuro)', grp: 'theme' },
  { key: 'text_color_light', value: '#1A1A22', label: 'Color del texto (claro)',  grp: 'theme' },
  { key: 'bg_color_dark',    value: '#0A0A0F', label: 'Fondo principal (oscuro)', grp: 'theme' },
  { key: 'bg_color_light',   value: '#F5F4EF', label: 'Fondo principal (claro)',  grp: 'theme' },
  { key: 'accent_dark',      value: '#D4AF37', label: 'Color acento (oscuro)',    grp: 'theme' },
  { key: 'accent_light',     value: '#A88C1E', label: 'Color acento (claro)',     grp: 'theme' },
];

const del  = db.prepare("DELETE FROM settings WHERE key = ?");
const ins  = db.prepare("INSERT INTO settings (key, value, label, [group]) VALUES (?, ?, ?, ?)");

for (const s of newSettings) {
  del.run(s.key);
  ins.run(s.key, s.value, s.label, s.grp);
  console.log('OK:', s.key);
}
db.close();
console.log('Done!');
