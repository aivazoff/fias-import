const StreamZip = require('node-stream-zip');
const xml2js = require('xml2js');
const path = require('path');
const fs = require('fs');
const { Client } = require('pg');
const { stdout, stderr } = require('process');
const proc = require('child_process');
const { Readable, Duplex } = require('stream');
const sax = require("sax");
const { async } = require('node-stream-zip');

const client = new Client({
  host: 'localhost',
  port: 5432,
  database: 'fias',
  user: 'fias',
  password: '12345',
  connectionTimeoutMillis: 5000,
  ssl: false
});

function runSqlFile(sqlFile) {
  return new Promise((resolve, reject) => {

    const child = proc.spawnSync(`docker exec -i fias-db psql -U fias -d fias -a -f /${sqlFile} > /dev/null`);

    child.stdout.on('data', data => {
      resolve();
    });

    child.stderr.on('data', data => {
      reject(data.slice(0, 100));
    });

    child.on('error', (error) => {
      reject(error.message.slice(0, 100));
    });
    
    child.on('close', (code) => {
      console.log(`child process exited with code ${code}`);
    });

  })
}

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

const zip = new StreamZip.async({
  file: path.join(__dirname, 'gar_xml.zip'),
  storeEntries: true
});

(async function(){

  await client.connect();

  const parser = new xml2js.Parser({
    attrValueProcessors: [valueProcessor]
  });

  async function getData(file) {
    const data = await zip.entryData(file);
    const xml = data.toString('utf-8');
    let result = await parser.parseStringPromise(xml);
    while(!Array.isArray(result)) {
      result = Object.values(result).pop();
    }
    return result.map(it => it.$);
  }

  const entries = await zip.entries();
  const tables = [];
  
  for (const entry of Object.values(entries)) {
      const tableName = path.basename(entry.name).toLowerCase().replace(/^as_([a-z_]+)_\d+_.+$/, '$1');

      if(!['addr_obj', 'carplaces', 'houses', 'adm_hierarchy', ''].includes(tableName)) {
        continue;
      }

      if(!tables.includes(tableName)) {
        tables.push(tableName);
        // console.log(tableName);
      }

      if(/^\d+\//.test(entry.name)) {

        const region = entry.name.split('/')[0];

        const sqlFile = `data/${region}_${tableName}.sql`;
        const sqlFilePath = path.join(__dirname, sqlFile);

        if(fs.existsSync(sqlFilePath)) {
          continue;
        }

        const saxStream = sax.createStream(true, {});

          saxStream.on("error", function (e) {
            // unhandled errors will throw, since this is a proper node
            // event emitter.
            console.error("error!", e)
            // clear the error
            this._parser.error = null
            this._parser.resume()
          });

          saxStream.on("opentag", async function (node) {

            if(!node.isSelfClosing) {
              return;
            }

            const row = {};

            for(const [name, value] of Object.entries(node.attributes)) {
              row[name] = valueProcessor(value, name);
            }

            // console.log(row);

            if(row['ISACTUAL'] === 'FALSE' || row['ISACTIVE'] === 'FALSE') {
              return
            }
  
            const cols = Object.keys(row).map(c => `"${c}"`).join(', ');
            const values = Object.values(row).join(', ');
            const query = `INSERT INTO "${tableName}" (${cols}) VALUES (${values})`;

            try {
              const result = await client.query(query);
            } catch(e) {
              console.error('Insert error: ' + e);
            }

          })

          const stream = await zip.stream(entry);
          stream.pipe(saxStream);

          break;

        const rows = await getData(entry.name);
        fs.appendFileSync(sqlFilePath, 'BEGIN;\n');
        let queryList = [];

        for(const row of rows) {

          if(row['ISACTUAL'] === 'FALSE' || row['ISACTIVE'] === 'FALSE') {
            continue
          }

          const cols = Object.keys(row).map(c => `"${c}"`).join(', ');
          const values = Object.values(row).join(', ');
          queryList.push(`INSERT INTO "${tableName}" (${cols}) VALUES (${values})`);

          if(queryList.length === 1000) {
            fs.appendFileSync(sqlFilePath, queryList.join(';\n') + ';\n');
            queryList = [];
          }
        }

        queryList.push('COMMIT', '');
        fs.appendFileSync(sqlFilePath, queryList.join(';\n'));

        // await runSqlFile(sqlFile);

        /* try {
          const child = proc.spawnSync(`docker exec -i fias-db psql -U fias -d fias -a -f /${sqlFile}`, {
            stdio: [ 'ignore', process.stdout, process.stderr ],
          });
  
          if(child.error) {
            throw child.error;
          }
  
          if(child.stderr.length) {
            throw new Error(child.stderr.toString('utf-8'));
          }
          
          console.log(`Loaded: ${region}_${tableName}`);
        } catch(e) {
          console.error(e);
          process.exit();
        } */

        console.log(`Converted: ${region}_${tableName}`);
        
      } else {
        // console.log(tableName);

        
      }
  }


  // client.close();

  // Do not forget to close the file once you're done
  // await zip.close();

})()

// console.log(fs.existsSync(path.join()))