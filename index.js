var cheerio = require('cheerio');
var request = require('superagent');
var eventproxy = require('eventproxy');
var moment = require('moment');
var async = require('async');
var mongo = require('mongodb').MongoClient;
var url = require('url');
var path = require('path');
var fs = require('fs');



const date = new Date();
const momentObj = moment(date);
const dateYYYYMMDD = momentObj.format('YYYYMMDD');

let retry = 5;


const zgzcwUrl = 'http://live.zgzcw.com/ls/AllData.action';
const zgzcwData = {
    code: 'all',
    // code: '201',
    ajax: true,
    date: moment(date).format('YYYY-MM-DD'),
}

getMatches(dateYYYYMMDD)

function getMatches(date) {
    if (date < '20170201') return;

    if (isAlreadyRequest(zgzcwData.date)) {
        zgzcwData.date = moment(zgzcwData.date).subtract(1, 'd').format('YYYY-MM-DD');
        getMatches(moment(zgzcwData.date).format('YYYYMMDD'));
        return;
    }

    const monthMM_DD = moment(date).format('MM-DD');

    request
        .post(zgzcwUrl)
        .type('form')
        .send(zgzcwData)
        // .set('Content-Type', 'application/json')
        .end((err, res) => {
            if (err) {
                console.log(`请求日期为${zgzcwData.date}的比赛数据出错`);
                console.log(`错误信息：${err.message}`)
                retry--
                if (retry) {
                    console.log()
                    console.log(`===== 重新尝试，剩余次数：${retry} =====`)
                    console.log()
                    getMatches(date)
                } else {
                    console.log()
                    console.log('!!!!! 已多次尝试失败，请检查出错原因 !!!!!')
                    console.log()
                }
                return;
            }
            console.log('-------------------------------------')
            console.log(`正在请求日期为${zgzcwData.date}的比赛数据`);
            console.log('-------------------------------------')

            var ep = new eventproxy();

            var $ = cheerio.load(res.text);
            var tr = $('tr.matchTr').filter((index, item) => {
                const status = $(item).find('.matchStatus').text().trim();
                const date = $(item).find('.matchDate').text();
                const dateReg = new RegExp(monthMM_DD);
                return status === "完" && dateReg.test(date);
            });

            let matches = [];
            let finishedNum = 0;//已请求完成数
            let allNum = tr.length;//所有请求数

            /*ep.tail('match', (match) => {
                matches.push(match);
            })*/


            /*let queue = async.queue((task, callback) => {
                request
                    .post(`http://live.zgzcw.com/ls/EventData.action?id=${task.matchId}`)
                    .end((err, res) => {
                        res = res.text && JSON.parse(res.text) || []
                        // match.event = ;
                        // console.log(match)
                        callback(null, res)
                    })
    
            }, 5)
            queue.drain = () => { console.log('all over') };*/


            // queue.saturated = () => { console.log('a group over') }
            // queue.empty=()=>{console.log('empty')}

            // tr.each((index, item) => {

            async.mapLimit(tr, 20, (item, callback) => {
                // console.log(item)
                var match = {
                    id: $(item).attr('matchid'),
                    type: $(item).find('.matchType').text(),
                    round: $(item).find('td[name=ROUND_AND_GROUPING]').text(),
                    date: $(item).find('.matchDate').text(),
                    home: $(item).find('.sptl>a').text(),
                    guest: $(item).find('.sptr>a').text(),
                    score: $(item).find('td.boldbf').text(),
                    score_half: $(item).find('.bcbf').text(),
                    odds: {
                        european: $(item).find('.oupei span').map((index, item) => { return $(item).text() }).toArray(),
                        asian: $(item).find('.yapan span').map((index, item) => { return $(item).text() }).toArray(),
                    }
                }

                request
                    .post(`http://live.zgzcw.com/ls/EventData.action?id=${match.id}`)
                    .end((err, res) => {
                        res = res && res.text && JSON.parse(res.text) || [];
                        const event = res.map((item, index) => {
                            item.PLAYER_NAME = item.PLAYER_NAME_SIMPLY;
                            item.OCCUR_TIME = parseInt(item.OCCUR_TIME);
                            delete (item.CREATE_DATE);
                            delete (item.PLAYER_NAME_TRADITIONAL);
                            delete (item.PLAYER_NAME_SIMPLY);
                            return item;
                        })
                        match.event = event;

                        finishedNum++;
                        console.log(`${(finishedNum / allNum * 100).toFixed(2)}%`)
                        callback(null, match)
                    })

                /*queue.push({ matchId: match.id }, (err, res) => {
                    match.event = res;
                    ep.emit('match', match);
                })*/
            }, (err, res) => {
                // console.log(res)
                writeToFile(res)
                retry = 5
            })


            // ep.emit('list', matches);
        })
}
function writeToFile(data) {
    const storePath = path.join('data', moment(zgzcwData.date).format('YYYYMM'));
    const isExists = fs.existsSync(storePath);
    if (!isExists) {
        fs.mkdirSync(storePath);
    }
    fs.writeFile(path.join(storePath, `match-${zgzcwData.date}.json`), JSON.stringify(data, null, 4), 'utf8', (err, res) => {
        err && console.log(err);
        console.log('writed')
        zgzcwData.date = moment(zgzcwData.date).subtract(1, 'd').format('YYYY-MM-DD');
        getMatches(moment(zgzcwData.date).format('YYYYMMDD'));
    })
}

function isAlreadyRequest(date) {
    const storePath = path.join('data', moment(zgzcwData.date).format('YYYYMM'));
    const isExists = fs.existsSync(path.join(storePath, `match-${date}.json`));
    if (isExists) {
        return true
    }
    return false;
}

// ep.all('list', 'detail', (list, detail) => {

//     // console.log(matches)
// })
/*var ep=new eventproxy();

var arr = [1, 2, 3, 4, 5];


ep.after('test', 3, (test) => {
    console.log(test);
})
for (var i = 0; i < arr.length; i++) {
    ep.emit('test', arr[i])
}*/


function openDatabase(host = 'localhost', port = '27017', dbname) {
    const dbUrl = url.format({
        protocol: 'mongodb',
        hostname: host,
        port: port,
        pathname: dbname,
        slashes: true
    })
    const db = mongo.connect(dbUrl, (err, db) => {
        if (err) {
            console.log('Connect failed');
            return;
        }
        console.log('Connect success');

        insertDocuments(db, 'play', [{ t: 123 }], (res) => {
            console.log(res);

        })

        findDocumnets(db, 'play', { a: 1 }, (res) => {
            console.log(res);
        })

        updateOneDocument(db, 'play', { t: 123 }, { test: 123 }, (res) => {

        })

        deleteOneDocument(db, 'play', { b: 2 }, (res) => {

        })

        createIndex(db, 'play', { a: 1 }, (res) => {

        })
        db.close();
    })
}

function insertDocuments(db, collectionName, documents, callback) {
    const collection = db.collection(collectionName);

    collection.insertMany(documents, (err, res) => {
        if (err) {
            console.log('Insert documents failed');
            return;
        }
        console.log(`Insert ${res.insertedCount} rows documents`);
        callback(res);
    })
}


function findDocumnets(db, collectionName, condition, callback) {
    const collection = db.collection(collectionName);

    collection.find(condition).toArray((err, docs) => {
        if (err) {
            console.log('Find documents failed');
            return;
        }
        console.log(`Find ${docs.length} documents`);
        callback(docs);
    })
}

function updateOneDocument(db, collectionName, condition, newValue, callback) {
    const collection = db.collection(collectionName);

    collection.updateOne(condition, { $set: newValue }, (err, res) => {
        if (err) {
            console.log('Update document failed');
            return;
        }
        console.log(`Update one document success`)
        callback(res)
    })
}

function deleteOneDocument(db, collectionName, condition, callback) {
    const collection = db.collection(collectionName);

    collection.deleteOne(condition, (err, res) => {
        if (err) {
            console.log('Remove document failed');
            return;
        }
        console.log('Remove one document success');
        callback(res);
    })
}

function createIndex(db, collectionName, condition, callback) {
    db.collection(collectionName).createIndex(condition, null, (err, res) => {
        if (err) {
            console.log('Create index failed');
            return;
        }
        console.log('Create index success');
        callback(res);
    })
}

// openDatabase('localhost', '27017', 'testdb')