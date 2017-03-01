const child_process = require('child_process');
const path = require('path');
const fs = require('fs');
const async = require('async');

const month = '201702';
const files = fs.readdirSync(path.join('data', month))

async.map(files, (item, callback) => {
    const filePath = path.join('data', month, item);
    const cmd = `mongoimport -d football -c match${month} --file ${filePath} --jsonArray`

    child_process.execSync(cmd, (err, stdout, stderr) => {
        const flat = true;
        if (err) {
            console.log(err.message)
            flag = false;
        }
        console.log('-----------------------------------------------')
        console.log(`File ${filePath} has been imported to MongoDB.`)
        console.log('-----------------------------------------------')
        stdout && console.log(stdout);
        stderr && console.log(stderr);
        callback(null, flag);
    })
}, (err, res) => {
    err && console.log(err);
    if (res) {
        console.log('Import finished')
    }
})