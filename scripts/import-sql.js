/**
 * Santa Radio SQL Import Script
 * 
 * Parses a MySQL .sql dump file (mysqldump format) and extracts rows from the
 * `messages2` table, then writes out src/data/songs.ts with the populated data.
 * 
 * No MySQL server is needed — this is pure text parsing of the dump file.
 * 
 * Usage:
 *   node scripts/import-sql.js path/to/dump.sql
 * 
 * The script handles:
 *   - Multi-row INSERT INTO statements
 *   - SQL string escaping (both backslash and doubled-quote styles)
 *   - Semicolons inside string literals
 *   - Special characters and unicode
 *   - Explicit column lists in INSERT statements (maps by column name)
 * 
 * Expected table schema (messages2):
 *   id (int), artist (varchar), song (varchar), info (text), image (varchar), lyrics (text)
 * 
 * To re-run with a newer SQL export, simply run this script again with the new file path.
 * The existing src/data/songs.ts will be overwritten with the new data.
 */

import { readFileSync, writeFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const EXPECTED_COLUMNS = ['id', 'artist', 'song', 'info', 'image', 'lyrics'];

function unescapeSql(str) {
  if (str === 'NULL' || str === 'null') return '';
  str = str.replace(/^'(.*)'$/s, '$1');
  str = str.replace(/''/g, "'");
  str = str.replace(/\\'/g, "'");
  str = str.replace(/\\"/g, '"');
  str = str.replace(/\\\\/g, '\\');
  str = str.replace(/\\n/g, '\n');
  str = str.replace(/\\r/g, '\r');
  str = str.replace(/\\t/g, '\t');
  str = str.replace(/\\0/g, '\0');
  return str;
}

function extractInsertStatements(sql) {
  const results = [];
  const pattern = /INSERT\s+INTO\s+[`"]?messages2[`"]?\s*/gi;
  let match;

  while ((match = pattern.exec(sql)) !== null) {
    let pos = match.index + match[0].length;
    let columnList = null;

    while (pos < sql.length && /\s/.test(sql[pos])) pos++;

    if (sql[pos] === '(') {
      const colStart = pos;
      pos++;
      let depth = 1;
      while (pos < sql.length && depth > 0) {
        if (sql[pos] === '(') depth++;
        else if (sql[pos] === ')') depth--;
        pos++;
      }
      const colStr = sql.substring(colStart + 1, pos - 1);
      if (!/'/.test(colStr)) {
        columnList = colStr.split(',').map(c => c.trim().replace(/[`"]/g, '').toLowerCase());
      }
    }

    while (pos < sql.length && /\s/.test(sql[pos])) pos++;

    const valuesKeyword = sql.substring(pos, pos + 6).toUpperCase();
    if (valuesKeyword !== 'VALUES') continue;
    pos += 6;

    let inString = false;
    let escaped = false;
    const start = pos;

    while (pos < sql.length) {
      const ch = sql[pos];
      if (escaped) {
        escaped = false;
        pos++;
        continue;
      }
      if (ch === '\\' && inString) {
        escaped = true;
        pos++;
        continue;
      }
      if (ch === "'" && !inString) {
        inString = true;
        pos++;
        continue;
      }
      if (ch === "'" && inString) {
        if (pos + 1 < sql.length && sql[pos + 1] === "'") {
          pos += 2;
          continue;
        }
        inString = false;
        pos++;
        continue;
      }
      if (!inString && ch === ';') {
        break;
      }
      pos++;
    }

    const valuesStr = sql.substring(start, pos);
    results.push({ valuesStr, columnList });
  }

  return results;
}

function parseSqlValues(valuesStr) {
  const rows = [];
  let i = 0;

  while (i < valuesStr.length) {
    while (i < valuesStr.length && valuesStr[i] !== '(') i++;
    if (i >= valuesStr.length) break;
    i++;

    const fields = [];
    let current = '';
    let inString = false;
    let escaped = false;
    let depth = 0;

    while (i < valuesStr.length) {
      const ch = valuesStr[i];

      if (escaped) {
        current += ch;
        escaped = false;
        i++;
        continue;
      }

      if (ch === '\\' && inString) {
        current += ch;
        escaped = true;
        i++;
        continue;
      }

      if (ch === "'" && !inString) {
        inString = true;
        current += ch;
        i++;
        continue;
      }

      if (ch === "'" && inString) {
        if (i + 1 < valuesStr.length && valuesStr[i + 1] === "'") {
          current += "''";
          i += 2;
          continue;
        }
        inString = false;
        current += ch;
        i++;
        continue;
      }

      if (!inString) {
        if (ch === ',' && depth === 0) {
          fields.push(current.trim());
          current = '';
          i++;
          continue;
        }
        if (ch === ')' && depth === 0) {
          fields.push(current.trim());
          i++;
          break;
        }
        if (ch === '(') depth++;
        if (ch === ')') depth--;
      }

      current += ch;
      i++;
    }

    if (fields.length > 0) {
      rows.push(fields);
    }
  }

  return rows;
}

function mapRowToSong(fields, columnList, fallbackIndex) {
  if (columnList) {
    const obj = {};
    for (let i = 0; i < columnList.length && i < fields.length; i++) {
      obj[columnList[i]] = fields[i];
    }

    const missing = EXPECTED_COLUMNS.filter(c => !(c in obj));
    if (missing.length > 0) {
      console.warn(`Warning: Missing columns in INSERT column list: ${missing.join(', ')}. Row skipped.`);
      return null;
    }

    return {
      id: parseInt(obj.id, 10) || fallbackIndex,
      artist: unescapeSql(obj.artist),
      song: unescapeSql(obj.song),
      info: unescapeSql(obj.info),
      image: unescapeSql(obj.image),
      lyrics: unescapeSql(obj.lyrics),
    };
  }

  if (fields.length < 6) return null;

  return {
    id: parseInt(fields[0], 10) || fallbackIndex,
    artist: unescapeSql(fields[1]),
    song: unescapeSql(fields[2]),
    info: unescapeSql(fields[3]),
    image: unescapeSql(fields[4]),
    lyrics: unescapeSql(fields[5]),
  };
}

function escapeTs(str) {
  return str
    .replace(/\\/g, '\\\\')
    .replace(/'/g, "\\'")
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '\\r');
}

function main() {
  const args = process.argv.slice(2);
  if (args.length === 0) {
    console.error('Usage: node scripts/import-sql.js <path-to-sql-dump>');
    console.error('');
    console.error('Parses a MySQL dump file and generates src/data/songs.ts');
    process.exit(1);
  }

  const sqlPath = resolve(args[0]);
  console.log(`Reading SQL dump from: ${sqlPath}`);

  let sql;
  try {
    sql = readFileSync(sqlPath, 'utf-8');
  } catch (err) {
    console.error(`Error reading file: ${err.message}`);
    process.exit(1);
  }

  const insertStatements = extractInsertStatements(sql);
  const allRows = [];

  for (const { valuesStr, columnList } of insertStatements) {
    const parsed = parseSqlValues(valuesStr);
    for (const fields of parsed) {
      const song = mapRowToSong(fields, columnList, allRows.length + 1);
      if (song) allRows.push(song);
    }
  }

  if (allRows.length === 0) {
    console.warn('Warning: No rows found in messages2 table. Check the SQL dump format.');
    const tableCheck = /messages2/i.test(sql);
    if (!tableCheck) {
      console.warn('The table "messages2" was not found in the dump file.');
    }
    process.exit(1);
  }

  console.log(`Found ${allRows.length} songs in the SQL dump.`);

  const songsEntries = allRows.map(row => {
    return `  { id: ${row.id}, artist: '${escapeTs(row.artist)}', song: '${escapeTs(row.song)}', info: '${escapeTs(row.info)}', image: '${escapeTs(row.image)}', lyrics: '${escapeTs(row.lyrics)}' }`;
  });

  const output = `export interface Song {
  id: number;
  artist: string;
  song: string;
  info: string;
  image: string;
  lyrics: string;
}

const songs: Song[] = [
${songsEntries.join(',\n')},
];

export default songs;
`;

  const outPath = resolve(__dirname, '..', 'src', 'data', 'songs.ts');
  writeFileSync(outPath, output, 'utf-8');
  console.log(`Written ${allRows.length} songs to ${outPath}`);
}

main();
