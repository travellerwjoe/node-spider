const child_process = require('child_process');
const path = require('path');
const fs = require('fs');

const month = '201702';
fs.readdirSync(path.join('data', month)).forEach((item, index) => {
    const filePath = path.join('data', month, item);
    const cmd = `mongoimport -d football -c match${month} --file ${filePath} --jsonArray`

    child_process.exec(cmd, (err, stdout, stderr) => {
        err && console.log(err.message);
        console.log('-----------------------------------------------')
        console.log(`File ${filePath} has been imported to MongoDB.`)
        console.log('-----------------------------------------------')
        stdout && console.log(stdout);
        stderr && console.log(stderr);
    })
})