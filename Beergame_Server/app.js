/**
 * Description: "Beer distribution game" simulation, based on modern web
 * technologies
 *
 * A project by Christian Hollinger & Julian Hoernschemeyer Driven by a
 * uni-project @ Hochschule Osnabrück, Standort Lingen (Ems), Germany
 *
 * Project time: Nov. - Jan. 2014
 *
 * Used technologies: Client: jQuery 1.9.1, jQuery Mobile 1.4.0, jQuery Cookie,
 * flotr2
 *
 * Server: node.js, express 3.4.7, socket.io 0.9.16, node-http-proxy 0.10.4,
 * winston 0.7.2 Apache 2.4.7, mySQL, PHP 5.5.4 @ Debian 3.2.51-1 x86_64
 * GNU/Linux
 *
 * Contact: christian.hollinger@hs-osnabrueck.de / www.otter-in-a-suit.com
 * julian.hoernschemeyer@hs-osnabrueck.de
 *
 * LICENSING: This program is free software: you can redistribute it and/or
 * modify it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or (at your
 * option) any later version.
 *
 * This program is distributed in the hope that it will be useful, but WITHOUT
 * ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS
 * FOR A PARTICULAR PURPOSE. See the GNU General Public License for more
 * details.
 *
 * You should have received a copy of the GNU General Public License along with
 * this program. If not, see <http://www.gnu.org/licenses/>.
 */
/*
 * Usage information: - Callbacks are mandatory - This has been tested w/
 * reverse-proxy-configuration powered by node-http-proxy alongside w/ Apache
 * 2.4.7
 */
// /////////////////
// VAR
// /////////////////
var SESSION_KEY = 'sessionkey';
var REQUEST_KEY = 'requestkey';
var UNIQUE_KEY = 'uniquekey';
var LEVEL = {
    gamemaster: 0,
    retailer: 1,
    wholesailer: 2,
    distributor: 3,
    factory: 4,
    production: 5,
};
var MAX_LEVEL = 4;
var MAX_QUANTITY = 100;
var STARTING_STOCK = 5;

var KEY_STD_LENGTH = 6;
var GLOBAL_ERR = -1;

///////////////////
// CONFIG
///////////////////
var fs, configurationFile;

configurationFile = 'configuration.json';
fs = require('fs');

var config = JSON.parse(
    fs.readFileSync(configurationFile)
);

//logger
var winston = require('winston');
var customLog = {
    levels: {
        critical: 5,
        error: 4,
        warn: 3,
        info: 2,
        debug: 1,
        debugG: 0
    },
    colors: {
        debugG: 'blue',
        debug: 'blue',
        info: 'green',
        warn: 'yellow',
        error: 'red',
        critical: 'red'
    }
};
var logger = new(winston.Logger)({
    levels: customLog.levels
});
logger.add(winston.transports.File, {
    filename: './main.log',
    level: 'warn'
});
logger.add(winston.transports.Console, {
    level: 'debugG'
});

// Check
if (!config) {
    logger.log('critical', 'Config couldn\'t be read! Exiting!');
    process.exit(1);
}

// /////////////////
// START SERVER API
// /////////////////
// https://github.com/learnboost/socket.io is for version 1.0. will be released
// somewhat between 2014 and 2999. fuck this. (01/04/14 hollinger)
var express = require('express');
var app = express();
var http = require('http');
var server = app.listen(3000); // parseInt(conf.port,10)
var io = require('socket.io').listen(server);

// Use node.js instead of Apache2
app.use(express.static(__dirname + '/'));

// JSONP not required anymore? (01/04/14 hollinger)
app.enable("jsonp callback");

// /////////////////
// WEBSOCKETS
// /////////////////
io.set('log level', 2);
logger.log('info', 'Express server started on port ' + app);

io.sockets
    .on(
        'connection',
        function (socket) {
            // Receive wscFinishRound from Gamemaster and send the
            // message to everyone who
            // subscribed to wssRound except the actual gamemaster
            // 01/06/14 hollinger
            socket
                .on(
                    'wscFinishRound',
                    function (data) {
                        logger.log('info',
                            'wscFinishRound received...');
                        if (data) {
                            var _level = data.level;
                            _level = parseInt(_level, 10);
                            // var _round = data.round;
                            var _session = data.session;
                            var quantity = data.quantity;
                            if (_level === LEVEL.gamemaster) {
                                logger
                                    .log('info',
                                        'wscFinishRound for authorized user received!');
                                getAndCheckRound(
                                    _session,
                                    function (err, result) {
                                        logger
                                            .log(
                                                'info',
                                                'getAndCheckRound received!');
                                        logger.log('info',
                                            result);
                                        result.sessionid = _session;

                                        if (result && !result.err)
                                            placeOrder(
                                                null,
                                                null,
                                                _session,
                                                _level,
                                                quantity,
                                                false);

                                        logger
                                            .log(
                                                'info',
                                                'wssRound Broadcasting...');
                                        logger.log('info',
                                            result);
                                        socket.broadcast
                                            .emit(
                                                'wssRound',
                                                result);
                                    });
                            } else {
                                logger
                                    .log('info',
                                        'wscFinishRound not authorized!');
                            }
                        }
                    });

            socket.on('wscUpdate', function (data) {
                wsfGetUpdateFromDB(data);
            });

            function wsfGetUpdateFromDB(data) {
                logger.log('info', 'wscUpdate received ' + data);
                var res = {
                    msg: 'N/A',
                    data: null
                };
                var _session = data.session;
                if (!_session)
                    return;
                try {
                    var query = 'Select * from transaction where transactionid in (Select max(transactionid) from transaction where sessionid = \'' + _session + '\' Group by levelid) Order by levelid';
                    getSQL(
                        query,
                        false,
                        function (err, result) {
                            if (!result || result.length <= 0) {
                                logger
                                    .log('info',
                                        'ERROR: No Data available. Inserting dummy transaction...');
                                getSQL(
                                    'INSERT INTO transaction (sessionid, levelid, round, inorder, outorder, `in`, `out`, store, cost) VALUES (' + _session + ',' + LEVEL.retailer + ',0,0,0,0,0,' + STARTING_STOCK + ',0), (' + _session + ',' + LEVEL.wholesailer + ',0,0,0,0,0,' + STARTING_STOCK + ',0), (' + _session + ',' + LEVEL.distributor + ',0,0,0,0,0,' + STARTING_STOCK + ',0), (' + _session + ',' + LEVEL.factory + ',0,0,0,0,0,' + STARTING_STOCK + ',0), (' + _session + ', ' + LEVEL.production + ', 0, 0, 0, 0, 0, 0, 0)',
                                    false,
                                    function (err, result) {
                                        if (result) {
                                          logger.log('info ', 'Status:' + result);
                                            res.msg = 'Insert sucessful!';
                                        }
                                    });
                            } else if (result.length === 5) {
                                // logger.log('info','sent data:',
                                // result);
                                res.msg = 'Result!';
                                res.data = result;

                                broadcastUpdate(res);
                            } else {
                                logger.log('error',
                                    'Error in wscUpdate');
                            }
                        });
                } catch (e) {
                    logger.log('error', 'ERROR in function getData!');
                    logger.log('error', e);
                    res.msg = 'Critical error in function getData!';
                }
            }

            function broadcastUpdate(res) {
                logger.log('info', 'wssUpdate Broadcasting...');
                socket.broadcast.emit('wssUpdate', res);
                logger.log('info', 'wssUpdate Sending to socket...');
                io.sockets.emit('wssUpdate', res);
                logger.log('info', res);
            }
        });

// /////////////////
// GET SESSION
// /////////////////
// return a new or existing session
// if a valid _uniquekey is provided, return a new session
// if not, return a temporary session
// this prevents spamming the database w/ unauthorized requests, just like a
// voucher-system
// not implemented yet, just return a new session (hollinger 12/14/13)
app.get("/getSession", function (req, res) {
    logger.log('info', '----------- (/getSession) @' + new Date() + '-----------');
    logger.log('info', req.query);
    var _uniquekey = req.query.uniquekey;
    var _requestkey = req.query.requestkey;
    // var _level = req.query.level;
    if (_uniquekey)
        logger.log('info', "Session-request w/ unique-key:" + _uniquekey);
    if (_requestkey)
        logger.log('info', "Session-request w/ request-key:" + _requestkey);

    // var query = '';
    var success;
    _uniquekey = '';
    // TODO: ENABLE VALIDATION
    try {
        if ((_uniquekey || _requestkey)) {
            var key = (_uniquekey) ? generateSessionKey(KEY_STD_LENGTH) : _requestkey;

            function setSessionKeyCallback(err, result) {
                logger.log('info', 'INSERT INTO session(sessionid) VALUES (\'' + key + '\')');
                // TODO DEBUG
                if (result) { // if insertion of new session was successful
                    logger.log('info', 'Insert success, session created:' + result);
                    success = {
                        sessionkey: key,
                    };
                    sendResults(res, success, 'Insert success, session created:', false, false);
                } else {
                    // Insertion failed
                    logger.log('info', 'Insertion failed! Error:' + err + '' + result);
                    // returnStdErrorAsJSON('Insertion failed!');
                    throw 'Insertion failed!';
                }
            }

            function getSessionKeyCallback(err, result) { // get session
                if (err || !result) { // if session doesn't exist yet
                    logger.log('info', 'No session yet! Calling insert...');
                    getSQL('INSERT INTO session(sessionid) VALUES (\'' + key + '\');', false, setSessionKeyCallback);
                } else {
                    // session exists, return key
                    // TODO: logic to work w/ session
                    logger.log('info', 'Session exists:' + result);
                    success = {
                        sessionkey: key,
                    };
                    sendResults(res, success, 'Insert success, session created:', false, false);
                }
            }

            // Nested callbacks are terrible
            // Anonymous callback functions fuck shit up, hence the internal
            // functions
            try {
                logger.log('info', 'START');
                getSQL('SELECT sessionid FROM session WHERE sessionid = \'' + key + "\' ;", false, getSessionKeyCallback);
            } catch (e) {
                logger.log('info', 'Caught error @ getSession2: ' + e);
            }
        } else {
            // No parameter provided. Return error.
            throw 'No parameter provided!';
        }
    } catch (e) {
        logger.log('info', 'Caught error @ getSession: ' + e);
        success = returnStdErrorAsJSON(e);
        // sendResults(res, success);
    }
});

// /////////////////
// ORDERS
// /////////////////
/**
 * Places an order
 *
 * @param {Object}
 *            requestkey; session-id; must be checked in advance
 * @param {Object}
 *            level; player
 * @param {Object}
 *            quantity; quantity you'd like to order
 * @param {boolean}
 *            extcall: Called via /place order or internally?
 */
app.get("/placeOrder", function (req, res) {
    placeOrder(req, res, req.query.requestkey, req.query.level,
        req.query.quantity, true);
});

function placeOrder(req, res, session, level, quantity, extcall) {
    logger.log('info', '----------- /placeOrder @' + new Date() + ' (external: ' + extcall + ')-----------');
    var _session = session;
    var _level = level;
    _level = parseInt(_level, 10);
    var _nextlevel = _level + 1;
    var _quantity = quantity;
    var _round = 0;
    var _outorder = 0;
    var _in = 0;
    var _out = 0;
    var _store = 0;
    var _cost = 0;
    logger.log('info', '_session ' + _session + '; _level: ' + _level + '; _quantity: ' + _quantity);
    if (_level !== null && _level <= MAX_LEVEL && _level >= 0 && _level <= 4) {
        // We add an order to the following player which can be the factory at
        // max, since they are the end of the supply chain
    } else {
        throw 'Invalid level!';
    }

    if (!_quantity || _quantity > MAX_QUANTITY || _quantity <= 0) {
        throw 'Invalid quantity!';
    }

    function setvars(result, i) {
        _round = result[i].round;
        _round++;
        _in = 0;
        _out = result[i].out;
        _cost = result[i].cost;
        _store = result[i].store;
        _quantity = parseInt(_quantity, 10);
        // else if(_level == 0){
        // if (_store < 0) {
        // _cost = _cost + _store * back;
        // //_in = _in - _store
        // } else {
        // _cost = _cost + _store * inv;
        // }
        // }
        logger.log('info', 'start function setvats with round: ' + _round);
    }
    try {
        // Actually place the order
        // http://stackoverflow.com/questions/15383852/sql-if-exists-update-else-insert-into
        // First get the information of the last round
        var selectQuery = 'SELECT * FROM transaction WHERE sessionid = \'' + _session + '\'  AND round in(Select MAX(round) FROM transaction WHERE sessionid = \'' + _session + '\') ORDER BY levelid';
        getSQL(
            selectQuery,
            false,
            function (err, result) {

                if (!result || result.length <= 0) {
                    if (extcall) {
                        // res.jsonp(returnStdErrorAsJSON('ERROR: No Data
                        // found'));
                        sendResults(res, null, 'ERROR: No Data found', true, false);
                    }
                    return;
                }

                logger.log('info', result);
                var tryround = result[0].round;
                if ((_level == 4) || (_level !== 0 && result.length < 5) || (_level === 0 && result.length == 5 && result[0].levelid == 1)) {
                    console.log('start controlquery');
                    var controlQuery = 'Select * FROM transaction WHERE sessionid = \'' + _session + '\' AND round in(Select MAX(round) FROM transaction WHERE sessionid = \'' + _session + '\'  AND levelid = ' + _nextlevel + ') AND levelid = ' + _nextlevel + '';
                    logger.log('info', controlQuery);
                    getSQL(
                        controlQuery,
                        false,
                        function (err, result) {
                            if ((result && result[0].round != tryround) || _level === 0) {

                                _round = result[0].round;
                                _round++;
                                _in = 0;
                                _out = result[0].out;
                                _cost = result[0].cost;
                                _store = result[0].store;
                                _quantity = parseInt(_quantity, 10);

                                logger.log('info', 'END function setvars with round: ' + _round + 'and costs: ' + result[0].cost);

                                var insertQuery = 'INSERT INTO transaction (sessionid, levelid, round, inorder, outorder, `in`, `out`, store, cost) VALUES(' + _session + ',' + _nextlevel + ',' + _round + ',' + _quantity + ', ' + _outorder + ',' + _in + ',' + _out + ',' + _store + ',' + _cost + ')';
                                // TODO: set
                                getSQL(
                                    insertQuery,
                                    false,
                                    function (err, result) {
                                        logger
                                            .log('info',
                                                'Insert the new order in the new round');
                                        if (!result) {
                                            if (extcall) {
                                                // res.jsonp(returnStdErrorAsJSON('ERROR:
                                                // Insert
                                                // failed'));
                                                sendResults(
                                                    res,
                                                    null,
                                                    'ERROR: Insert failed',
                                                    true,
                                                    false);
                                            }
                                        } else {
                                            if (extcall) {
                                                // res.jsonp(result);
                                                sendResults(
                                                    res,
                                                    result,
                                                    '',
                                                    false,
                                                    false);
                                            }
                                        }
                                    });
                            } else {
                                if (extcall) {
                                    // res.jsonp(returnStdErrorAsJSON('ERROR:
                                    // Select failed'));
                                    sendResults(res, null,
                                        'ERROR: Select failed',
                                        true, false);
                                    logger.log('info', 'ERROR: Select failed!');
                                }
                            }
                        });
                } else {
                    if (extcall) {
                        // res.jsonp(returnStdErrorAsJSON('ERROR: placeOrder
                        // impossible atm'));
                        sendResults(res, null,
                            'ERROR: placeOrder impossible atm', true,
                            false);
                    }
                }
            });

    } catch (e) {
        if (extcall) {
            sendResults(null, e, true, false);
        }
    }

}

/**
 * Finishes the current round if all orders have been placed Should only be
 * called by the game-master
 *
 * @param {Object}
 *            requestkey; session-id; must be checked in advance
 * @return {Object} round
 */
app.get("/finishRound", function (req, res) {
    logger.log('info', '----------- /finishRound @' + new Date() + '-----------');
    var _session = req.query.requestkey;
    if (_session)
        logger.log('info', "Round-request w/ request-key:" + _session);

    getAndCheckRound(_session, sendResults);
});

app.get("/analyzeData", function (req, res) {
    analyzeData(req, res);
});

function analyzeData(req, res) {
    var _session = req.query.requestkey;
    if (_session && req && res) {
        var query = 'SELECT * FROM transaction WHERE sessionid = \'' + _session + '\'';
        getSQL(query, false, function (err, result) {
            // res.jsonp(result);
            if (result) sendResults(res, result, '', false, false);
            else sendResults(res, null, 'No data available!', true, false);
        });
    }
}

/**
 * Returns result
 *
 * @param data
 * @param message
 * @param sendAsError
 * @param sendAsJson
 * @depreciated
 */
function sendResults(res, data, message, sendAsError, sendAsJson) {
    sendAsError = (sendAsError) ? true : false;
    sendAsJson = (sendAsJson) ? false : false; // deactivated
    logger.log('debug', '-----------');
    logger.log('debug', 'SENDING REQUEST INPUT:');
    logger.log('debug', data);
    logger.log('debug', 'Message: ' + message);
    logger.log('debug', 'sendAsError: ' + sendAsError);
    logger.log('debug', 'sendAsJson: ' + sendAsJson);

    try {
        var result = {};
        var msg = message;
        var err = '';

        if (sendAsError) {
            data = GLOBAL_ERR;
            err = message;
        }
        if (sendAsJson) {
            result = data;
        } else {
            result = {
                data: data,
                msg: msg,
                err: err
            };
        }

        res.jsonp(result);

        logger.log('debug', 'Json sent:');
        logger.log('debug', result);
    } catch (e) {
        var result = {
            data: GLOBAL_ERR,
            msg: e,
            err: e
        };
        res.jsonp(result);
        logger.log('error', 'ERROR: Json sent:' + e);
    }

    logger.log('debug', '-----------');
}

// /////////////////
// END SERVER API
// /////////////////

// /////////////////
// START INTERNAL LOGIC
// /////////////////

/**
 * Checks whether the round can be closed
 *
 * @param {Object}
 *            sessionid; must be checked in advance
 * @param {Function}
 *            callback(err,result); result is either the current round + 1, the
 *            current round w/o increment if not all calls have been made or -1
 *            as error
 * @throws ERROR:
 *             Callback is no function!
 * @return {Object}
 */
var getAndCheckRoundCheck = true;

function getAndCheckRound(sessionid, callback) {
    logger.log('debug', 'START function getAndCheckRound');

    try {
        var query = 'SELECT sessionid, MAX(round) AS round, COUNT(*) AS roundcount FROM transaction WHERE sessionid = \'' + sessionid + '\' GROUP BY round ORDER BY MAX(round) DESC LIMIT 1';
        getSQL(query, false, checkRoundCallback);
    } catch (e) {
        logger.log('error', e);
        callback(null, {
            round: GLOBAL_ERR,
            msg: e
        });
    }

    function checkRoundCallback(err, result) {
        logger.log('debug', 'START function checkRoundCallback');
        if (result) {
            logger.log('debug', 'checkRoundCallback-result length: ' + result.length);
            logger.log('debug', result);
        }
        if (result && result.length > 0 && result[0].roundcount !== null && result[0].round !== null) {
            var _roundcount = result[0].roundcount;
            var _round = result[0].round;
            logger.log('debug', 'Callback-check passed; Rounds: ' + _roundcount + ', currently at ' + _round);
            if (_roundcount === 5) {
                _round++;
                res = {
                    round: _round,
                    msg: 'Incremented round!'
                };
                logger
                    .log('debug',
                        '_roundcount is 5! --> getAndCheckRound: START SELECT-Statement');
                var selectQuery = 'SELECT * FROM transaction WHERE sessionid = \'' + sessionid + '\'  AND round in(Select MAX(round) FROM transaction WHERE sessionid = \'' + sessionid + '\') ORDER BY levelid';
                getSQL(
                    selectQuery,
                    false,
                    function (err, result) {
                        logger.log('debug', 'checkRoundCallback-result 2 length' + result.length);
                        logger.log('debug', result);

                        var values = "";
                        var cost = [0.5, -1];
                        for (var i = result.length - 1; i >= 0; i--) {
                            logger.log('debug', 'Loop @ ------> ' + i);
                            // Order from next level
                            // _outorder = outgoing goods
                            // _in = incoming goods
                            // _inorder = incoming order
                            // _out = pending, outgoing orders

                            var _store = 0;
                            var _inorder = 0;
                            var _outorder = 0;
                            var _in = 0;
                            var _out = 0;
                            var _cost = 0;
                            if (result[i].levelid == 5) {
                                _outorder = result[i].inorder;
                            } else {
                                _store = result[i].store;
                                _inorder = result[i].inorder;
                                _in = result[i + 1].outorder;
                                _out = result[i].out;
                                _cost = result[i].cost;
                                if (_store < 0) {
                                    _store = 0;
                                }
                                _store = _store + _in;
                                _store = _store - (_inorder + _out);
                                if (_store < 0) {
                                    _outorder = _inorder + _out + _store;
                                    _out = _store * -1;
                                    _cost = _cost + (_store * cost[1]);
                                } else {
                                    _outorder = _inorder + _out;
                                    _cost = _cost + (_store * cost[0]);
                                }
                            }

                            values += '(\'' + result[i].sessionid + '\', ' + result[i].levelid + ',' + result[i].round + ', ' + _inorder + ',' + _outorder + ',' + _in + ',' + _out + ',' + _store + ',' + _cost + ',' + result[i].transactionid + '),';
                        }
                        values = values.substr(0, values.length - 1);
                        logger.log('debug', 'FINAL VALUES: ' + values);
                        var insertquery = 'INSERT INTO transaction (sessionid, levelid, round, inorder, outorder, `in`, `out`, store, cost, transactionid) VALUES ' + values + ' ON DUPLICATE KEY UPDATE outorder = VALUES(outorder), `in` = VALUES(`in`), `out` = VALUES(`out`), store = VAlUES(store), cost=VALUES(cost)';
                        getSQL(insertquery, false, function (result) {
                            logger.log('debug', 'Final result:');
                            logger.log('debug', result);
                            callback(null, res);
                            // logger.log('debug','Update Round before new
                            // round starts');
                        });
                    });
            } else {
                res = {
                  round: _round,
                  msg: 'Not all orders have taken place!',
                  err: GLOBAL_ERR
                }
                callback(null, res);
                logger.log('error', res.msg);
            }
        } else {
            res = {
              round: GLOBAL_ERR,
              msg: 'No round found!'
            }
            callback(null, res);
            logger.log('error', res.msg);
        }
    }
}
/**
 * function returnStdErrorAsJSON(msg) { msg = (msg) ? msg : '';
 * logger.log('error', 'Returning standard error. Message: ' + msg); return {
 * sessionkey : GLOBAL_ERR, err : msg }; }
 */

// generate a random session-key w/ standard length 6 as hex
// if the key is taken, you can use a different length. statistically, that
// should eradicate the chances of a key being taken twice.
// --> alphabetalphanumeric^(KEY_STD_LENGTH) --> 62^6 = 5.68E+10 combinations
// possible
// has to be dividible by 2
function generateSessionKey(length) {
    var key = '';
    logger.log('info', 'Requested key-length' + length);
    length = (length) ? length : KEY_STD_LENGTH;
    length = (length > 512) ? 512 : length;
    // max is 512
    if (length % 2 !== 0)
        length++;
    var alphabetalphanumeric = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

    for (var i = 0; i < length; i++) {
        key += alphabetalphanumeric.charAt(Math.floor(Math.random() * alphabetalphanumeric.length));
    }
    hexString = key.toString(16);
    logger.log('info', 'Generated key: ' + key);
    return key;
}

// /////////////////
// END INTERNAL LOGIC
// /////////////////

// /////////////////
// START VALIDATION
// /////////////////
function isCallback(callback) {
    if (callback !== null && callback instanceof Function) {
        // logger.log('info','Callback is function! Fuck yeah!');
        return true;
    } else {
        // throw 'ERROR: Callback is no function!';
        logger.log('error', 'ERROR: Callback is no function!');
        return false;
    }
}

function checkPar(req) {

}

// /////////////////
// END VALIDATION
// /////////////////

// /////////////////
// START SQL
// /////////////////

// Access MySQL via node-mysql
// https://github.com/felixge/node-mysql
var debug = false;

function getSQL(query, isJSON, callback) {
    if (!isCallback(callback))
        throw 'ERROR: Callback is no function!';

    // Run SQL
    var mysql = require('mysql');
    var connection = mysql.createConnection({
        host: config.dbhost,
        user: config.dbuser,
        password: config.dbpassword,
        database: config.database,
        socketPath: config.dbsocket, // socket for communication
        // from debian <-> client,
        // seems not to be set
        // correcly by default?
        // /var/run/mysqld/mysqld.sock
    });

    connection.connect();
    var res = '';

    connection.query(query, function (err, results, fields) {
        logger.log('debugG', 'Query:' + query);
        try {
            if (err) {
                logger.log('error', 'Error at getSQL' + err);
                return callback(err, null);
            }
            // logger.log('info','Result', results);

            // wrap result-set as json
            if (isJSON && results && results.length > 0) {
                res = JSON.stringify(results);
                // logger.log('info','JSON-result:', res);
            } else if (!results || results.length <= 0) {
                logger.log('error', 'Result = null');
                res = null;
            } else {
                res = results;
            }
        } catch (e) {
            logger.log('error', 'Caught error @getSQL', e);
        } finally {
            // close connection
            connection.end();
            callback(null, res);
        }
    });
}

// getSQL w/o callback. Used for internal operations w/o feedback or results
// only
function runSQL(query) {
    function callback(err, result) {
        // nothing
        logger.log('info', 'Callback of callback-free SQL returned:' + result);
    }
    getSQL(query, false, callback);
}