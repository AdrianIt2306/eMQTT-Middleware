// routes/router.js
const express = require('express');
const router = express.Router();

const bcrypt = require('bcryptjs');
const uuid = require('uuid');
const jwt = require('jsonwebtoken');

const db = require('../lib/db.js');
const logger = require('./../lib/logger');
const userMiddleware = require('../middleware/users.js');

// routes/router.js

router.post('/create-sensor', userMiddleware.isLoggedIn, (req, res, next) => {
    logger.debug(JSON.stringify(req.body.data.alias));
    let uuid = Math.random().toString(36).slice(-6);
    let tokenSensor = req.body.data.type + '$' + uuid
    let sensorType = 0
    switch (req.body.data.type) {
        case "A":
            sensorType = 1
            break;
        case "B":
            sensorType = 2
            break;
        case "C":
            sensorType = 3
            break;
        case "D":
            sensorType = 4
            break;
        default:
    }

    db.query(
        `INSERT INTO sensor(name, sensoralias, token, type, owner, status, running, topic,frequency, ip) VALUES ('${req.body.data.sensorname}', '${req.body.data.alias}' ,${db.escape(tokenSensor)}, ${sensorType},${db.escape(req.userData.userId)},${1},${0}, '${req.body.data.topic}',${(req.body.data.frequency)*1000},'${req.body.data.ip}' )`,
        (err, result) => {
            if (err) {
                throw err;
            }
            }
    );
    db.query(
        `INSERT INTO iot_temperature(sensor_parent, adc, voltage, randomness) VALUES ((SELECT sensor.id FROM sensor WHERE sensor.token = ${db.escape(tokenSensor)}), ${0} ,${0}, '${"Low"}' )`,
        (err, result) => {
            if (err) {
                throw err;
                return res.status(400).send({
                    msg: err
                });
            }
            return res.status(201).send({
                msg: 'Registered!'
            });
        }
    );
});
router.post('/change-sensor-status', userMiddleware.isLoggedIn, (req, res, next) => {
    logger.debug(JSON.stringify(req.body.data));

    if ((req.body.data.sensortoken == null || req.body.data.sensortoken == undefined) && req.body.data.status == true) {
        logger.debug("Token not informed, applying query to all sensor");
        db.query(`UPDATE sensor SET status = 1, running = 0  WHERE sensor.owner = ${db.escape(req.userData.userId)};`, function(err, result, fields) {
            if (err) throw err;

            return res.status(200).send({
                id: req.userData.userId,
                username: req.userData.username,
                msg: "Status updated correctly",
                sensors: result.message
            });
        });
    } else {
        logger.debug("Token informed, applying query to sensor");
        let finalStatus;
        switch (req.body.data.status) {
            case true:
                finalStatus = 1
                db.query(`UPDATE sensor SET status = ${finalStatus} WHERE sensor.owner = ${db.escape(req.userData.userId)} and sensor.token= ${db.escape(req.body.data.sensortoken)} ;`, function(err, result, fields) {
                    if (err) throw err;
        
                    return res.status(200).send({
                        id: req.userData.userId,
                        username: req.userData.username,
                        msg: "Status updated correctly",
                        sensors: result.message
                    });
                });
                break;
            case false:
                finalStatus = 0
                db.query(`UPDATE sensor SET status = ${finalStatus} WHERE sensor.owner = ${db.escape(req.userData.userId)} and sensor.token= ${db.escape(req.body.data.sensortoken)} ;`, function(err, result, fields) {
                    if (err) throw err;
        
                    return res.status(200).send({
                        id: req.userData.userId,
                        username: req.userData.username,
                        msg: "Status updated correctly",
                        sensors: result.message
                    });
                });
                break;
            default:
        }

    }
});
router.get('/sensor-info', userMiddleware.isLoggedIn, (req, res, next) => {
    logger.debug(JSON.stringify(req.userData));

    db.query(`SELECT * FROM sensor WHERE sensor.owner = ${db.escape(req.userData.userId)};`, function(err, result, fields) {
        if (err) throw err;

        return res.status(200).send({
            id: req.userData.userId,
            username: req.userData.username,
            role: "User",
            sensors: result
        });

    });
});
router.post('/executions', userMiddleware.isLoggedIn, (req, res, next) => {
    logger.debug(JSON.stringify(req.userData));
    logger.debug(JSON.stringify(req.body));

    let uuid = Math.random().toString(36).slice(-6);
    let token_execution = "S" + '$' + uuid
    logger.debug(token_execution);
    db.query(`INSERT INTO simulation (name, token , owner, status, start_timestamp, end_timestamp) VALUES ('${req.body.data.execution_name}','${token_execution}',${db.escape(req.userData.userId)},${3},${db.escape(req.body.data.simulation_start_time)},${db.escape(req.body.data.simulation_end_time)});`, function(err, result, fields) {
        if (err) throw err;

    });

    let sensor_relation = req.body.data.simulation_sensor;
    logger.debug(sensor_relation.length);
    for (let index = 0; index < sensor_relation.length; index++) {
        const element = sensor_relation[index];
        logger.debug(element);

        db.query(`INSERT INTO execution (execution, sensor_id) VALUES ((SELECT simulation.id FROM simulation WHERE simulation.token='${token_execution}'),(SELECT sensor.id FROM sensor WHERE sensor.token='${element}'));`, function(err, result, fields) {
            if (err) throw err;
        });

    }
    return res.status(201).send({
        id: req.userData.userId,
        username: req.userData.username,
    });

});
router.get('/executions', userMiddleware.isLoggedIn, (req, res, next) => {
    logger.debug(JSON.stringify(req.userData.userId));

    db.query(`SELECT * FROM simulation WHERE simulation.owner = ${db.escape(req.userData.userId)};`, function(err, result, fields) {
        if (err) throw err;

        return res.status(200).send({
            id: req.userData.userId,
            username: req.userData.username,
            role: "User",
            executions: result
        });

    });
});
router.post('/sign-up', userMiddleware.validateRegister, (req, res, next) => {
    logger.debug(req.body)
    db.query(
        `SELECT * FROM user WHERE LOWER(username) = LOWER(${db.escape(
        req.body.username
      )});`,
        (err, result) => {
            if (result.length) {
                return res.status(409).send({
                    msg: 'This username is already in use!'
                });
            } else {
                // username is available
                bcrypt.hash(req.body.password, 10, (err, hash) => {
                    if (err) {
                        return res.status(500).send({
                            msg: err
                        });
                    } else {
                        // has hashed pw => add to database
                        // db.query(
                        //     `INSERT INTO user (id, username, name ,password) VALUES ('${uuid.v4()}', ${db.escape(req.body.username)} ,${db.escape(req.body.name)}, ${db.escape(hash)})`,
                        //     (err, result) => {
                        //         if (err) {
                        //             throw err;
                        //             return res.status(400).send({
                        //                 msg: err
                        //             });
                        //         }
                        //         return res.status(201).send({
                        //             msg: 'Registered!'
                        //         });
                        //     }
                        // );
                        db.query("call emqtt_create_user(?,?,?,?,?,?,?)", [uuid.v4(), req.body.name,req.body.username,hash,req.body.role,req.body.email,req.body.occupation], function (err, result) {
                            if (err) {
                                logger.debug("err:", err);
                            } else {
                                logger.debug("results:", result);
                                return res.status(201).send({
                                    msg: 'Registered!'
                                });
                            }
                        
                        });                        
                    }
                });
            }
        }
    );
});
router.post('/login', (req, res, next) => {
    db.query(
        `SELECT * FROM user WHERE username = ${db.escape(req.body.username)};`,
        (err, result) => {
            // user does not exists
            if (err) {
                throw err;
                return res.status(400).send({
                    msg: err
                });
            }

            if (!result.length) {
                return res.status(401).send({
                    msg: 'Username or password is incorrect!'
                });
            }

            // check password
            bcrypt.compare(
                req.body.password,
                result[0]['password'],
                (bErr, bResult) => {
                    // wrong password
                    if (bErr) {
                        throw bErr;
                        return res.status(401).send({
                            msg: 'Username or password is incorrect!'
                        });
                    }

                    if (bResult) {
                        const token = jwt.sign({
                                username: result[0].username,
                                userId: result[0].id
                            },
                            'SECRETKEY', {
                                expiresIn: '900000'
                            }
                        );

                        db.query(
                            `UPDATE user SET last_login = now() WHERE id = '${result[0].id}'`
                        );
                        return res.status(200).send({
                            msg: 'Logged in!',
                            token,
                            user: result[0]
                        });
                    }
                    return res.status(401).send({
                        msg: 'Username or password is incorrect!'
                    });
                }
            );
        }
    );
});





router.get('/profile', userMiddleware.isLoggedIn, (req, res, next) => {
    logger.debug(JSON.stringify(req.userData));

    db.query(`SELECT id,name,username,role,status,email,occupation,last_login,created FROM user WHERE user.id = ${db.escape(req.userData.userId)};`, function(err, result, fields) {
        if (err) throw err;

        db.query(`SELECT catalog.name,catalog.description,authz.status FROM authz INNER JOIN user ON authz.owner = user.id INNER JOIN catalog ON catalog.id = authz.sku WHERE user.id = ${db.escape(req.userData.userId)};`, function(err, resultc, fields) {
            if (err) throw err;

            db.query(`SELECT * from api_key WHERE api_key.owner =  ${db.escape(req.userData.userId)};`, function(err, result_keys, fields) {
                console.log(result_keys)
                if (err) throw err;
                return res.status(200).send({
                    data: result,
                    authz:resultc,
                    keys: result_keys
                });
            });

        });

    });
});

module.exports = router;