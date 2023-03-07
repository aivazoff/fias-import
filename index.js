#!/usr/bin/env node --max-old-space-size=1500

const StreamZip = require('node-stream-zip');
const readline = require('readline');
const path = require('path');
const sax = require("sax");
const fs = require('fs');
const pg = require('pg');

const db = new pg.Client({
  host: 'localhost',
  port: 5432,
  database: 'fias',
  user: 'fias',
  password: '12345',
  connectionTimeoutMillis: 5000,
  ssl: false
});

const excludes = [
  'reestr_objects', 'addr_obj_division', 'change_history', 'normative_docs', 'normative_docs_kinds',
  'normative_docs_types', 'operation_types', 'param', 'param_types', 'steads',
  
  // Tables not exists
  'addr_obj_params', 'steads_params', 'houses_params', 'apartments_params', 
  'rooms_params', 'carplaces_params'
];

function valueProcessor(value, name) {
  switch(name) {
    case 'ISACTUAL':
    case 'ISACTIVE':
      return Boolean(JSON.parse(value)) ? 'TRUE' : 'FALSE';
    case 'LEVEL':
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

// addr_obj count: 1491891

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

  const entries = await zip.entries();

  db.query('BEGIN');
  
  try {
    await db.query(`DROP SCHEMA public CASCADE; CREATE SCHEMA public;`);
    await db.query(readFile('structur.sql'));
    await db.query('COMMIT');
  } catch(e) {
    await db.query('ROLLBACK');
    throw e;
  }

  for (const entry of Object.values(entries)) {
      const tableName = path.basename(entry.name).toLowerCase().replace(/^as_([a-z_]+)_\d+_.+$/, '$1');

      if(excludes.includes(tableName)) {
        continue;
      }

      const prefix = /^\d+\//.test(entry.name) ? entry.name.split('/')[0] + '_' : '';
      const name = prefix + tableName;
      const pk = await getPK(tableName);

      await new Promise(async (resulve, reject) => {

        const saxStream = sax.createStream(true, {});

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
            consoleAlert(`Insert: ${name} (${i})`);
          } catch(e) {
            //await db.query('ROLLBACK');
            console.error('\nInsert error: ' + e);
            reject(e);
          } finally {
            queryList = [];
          }
        }

        saxStream.on("opentag", async function (node) {

          const attrs = Object.entries(node.attributes);

          if(!node.isSelfClosing || !attrs.length) {
            return;
          }

          const row = {};

          for(const [name, value] of attrs) {
            row[name] = valueProcessor(value, name);
          }

          if(row['ISACTUAL'] === 'FALSE' || row['ISACTIVE'] === 'FALSE') {
            return
          }

          const cols = Object.keys(row).map(c => `"${c}"`).join(', ');
          const values = Object.values(row).join(', ');
          let query = `INSERT INTO "${tableName}" (${cols}) VALUES (${values})`;

          if(pk) {
            query += ` ON CONFLICT ("${pk}") DO NOTHING`;
          }

          queryList.push(query);

          if(queryList.length === 10000) {
            await insertRows();
          }

          ++i;

        });

        saxStream.on("end", async () => {
          if(queryList.length > 0) {
            await insertRows();
          }
          
          consoleAlert(`End: ${name} (${i} rows)\n`);
          resulve();
        });

        const stream = await zip.stream(entry);
        stream.pipe(saxStream);

      });
  }


  // client.close();

  // Do not forget to close the file once you're done
  // await zip.close();

})()

// console.log(fs.existsSync(path.join()))
