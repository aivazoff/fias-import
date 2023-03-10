#!/usr/bin/env node --max-old-space-size=1500

'use strict'

const StreamZip = require('node-stream-zip');
const readline = require('readline');
const path = require('path');
const sax = require("sax");
const fs = require('fs');
const pg = require('pg');

function exit(code) {
  process.exit(code);
}

const db = new pg.Client({
  host: 'localhost',
  port: 5432,
  database: 'fias',
  user: 'fias',
  password: '12345',
  connectionTimeoutMillis: 5000,
  ssl: false
});

function valueProcessor(value, name) {
  switch(name) {
    case 'isactual':
    case 'isactive':
      return Boolean(JSON.parse(value)) ? 'TRUE' : 'FALSE';
    case 'level':
      return Number(value)
    default:
      return `'${value.replace(/'/g, "''")}'`;
  }
}

function consoleAlert(msg) {
  readline.clearLine(process.stdout, 0);
  readline.cursorTo(process.stdout, 0, null);
  process.stdout.write(`\r${msg}`);
}

// БД ФИАС от 24.01.2023
const zip = new StreamZip.async({
  file: path.join(__dirname, 'gar_xml.zip'),
  storeEntries: true
});

const readFile = (f) => fs.readFileSync(path.join(__dirname, f)).toString('utf-8');

const historyFile = 'history.txt';
const history = readFile(historyFile).split(/\r?\n/).filter(Boolean);


(async function() {

  await db.connect();

  const getPK = (function() {

  const pkList = {};
  
    return async function(tbName) {

      if(tbName in pkList) {
        return pkList[tbName];
      }

      const result = await db.query(`
        SELECT a.attname
          FROM pg_index i
          JOIN pg_attribute a 
            ON a.attrelid = i.indrelid
           AND a.attnum = ANY(i.indkey)
         WHERE i.indrelid = '${tbName}'::regclass
           AND i.indisprimary;
      `);

      pkList[tbName] = result.rowCount ? result.rows[0].attname : null;
      return pkList[tbName];
    }

  })();

  async function tableExists(tbName) {
    const result = await db.query(`SELECT EXISTS (
      SELECT FROM information_schema.tables 
       WHERE table_schema = 'public'
         AND table_name = $1
    )`, [tbName]);
  
    return result.rows[0].exists;
  }

  async function columnExists(tbName, colName) {
    const result = await db.query(`SELECT EXISTS (
       SELECT FROM information_schema.columns 
        WHERE table_schema = 'public'
          AND table_name = $1
          AND column_name = $2
    )`, [tbName, colName]);
  
    return result.rows[0].exists;
  }

  async function dbClear() {
    db.query('BEGIN');
  
    try {
      await db.query(`DROP SCHEMA public CASCADE; CREATE SCHEMA public;`);
      await db.query(readFile('structur.sql'));
      await db.query('COMMIT');
    } catch(e) {
      await db.query('ROLLBACK');
      throw e;
    }
  }

  const exludes = ['house_types', 'houses'];

  const entries = await zip.entries();

  for (const entry of Object.values(entries)) {
      const tableName = path.basename(entry.name).toLowerCase().replace(/^as_([a-z_]+)_\d+_.+$/, '$1');

      if(!(await tableExists(tableName)) || exludes.includes(tableName)) {
        continue;
      }

      const region = /^\d+\//.test(entry.name) && entry.name.split('/')[0];
      const prefix = region ? region + ':' : '';
      const name = prefix + tableName;
      const pk = await getPK(tableName);

      if(history.includes(name)) {
        continue;
      }

      await new Promise(async (resulve, reject) => {

        const saxStream = sax.createStream(true);

        saxStream.on("error", function (e) {
          // unhandled errors will throw, since this is a proper node
          // event emitter.
          console.error("error!", e)
          // clear the error
          this._parser.error = null
          this._parser.resume()
        });

        let queryList = [];
        let i = 0;

        async function insertRows() {
          //db.query('BEGIN');

          try {
            await db.query(queryList.join(';') + ';');
            //await db.query('COMMIT');
            consoleAlert(`Insert: ${name} (${i} rows)`);
          } catch(e) {
            //await db.query('ROLLBACK');
            console.error('\nInsert error: ' + e);
            reject(e);
          } finally {
            queryList = [];
          }
        }

        saxStream.on("opentag", async (node) => {

          const attrs = Object.entries(node.attributes).map(([n ,v]) => [n.toLowerCase(), v]);

          if(!node.isSelfClosing || !attrs.length) {
            return;
          }

          const row = {};

          for(const [name, value] of attrs) {
            row[name] = valueProcessor(value, name);
          }

          if(row['isactual'] === 'FALSE' || row['isactive'] === 'FALSE') {
            // return
          }

          if(region) {
            row.region = region;
          }

          const cols = Object.keys(row).map(c => `"${c}"`).join(', ');
          const values = Object.values(row).join(', ');
          let query = `INSERT INTO "${tableName}" (${cols}) VALUES (${values})`;

          if(pk) {
            // query += ` ON CONFLICT ("${pk}") DO NOTHING`;
            const upCols = Object.keys(row).filter(c => c !== pk);
            const cols = upCols.map(c => `"${c}"=EXCLUDED."${c}"`).join(', ');
            query += ` ON CONFLICT ("${pk}") DO UPDATE SET ${cols}`;
          }

          queryList.push(query);

          if(queryList.length === 20000) {
            await insertRows();
          }

          ++i;

        });

        saxStream.on("end", async () => {
          if(queryList.length > 0) {
            await insertRows();
          }
          
          consoleAlert(`End: ${name} (${i} rows)\n`);
          fs.appendFileSync(historyFile, name + '\n');
          resulve();
        });

        const stream = await zip.stream(entry);
        stream.pipe(saxStream);

      });
  }

  db.end();
  await zip.close();

})()
