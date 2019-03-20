const request = require('request');
const Config = require('../polis-config');
const pg = require('../db/pg-query');
const Log = require('../log');
const Session = require('../session');
const Cookies = require('../utils/cookies');

function signIn(req, res) {
  let url = Config.get('JOIN_SERVER');
  let apiKey = Config.get('JOIN_API_KEY');
  requireToken(req, res, url, apiKey)
    .then(token => {
      return getUserInfo(req, res, url, apiKey, token)
    })
    .then(user => {
      return createJoinUser(req, res, user);
    })
    .catch(error => res.send(error));
}

function requireToken(req, res, url, apiKey) {
  return new Promise((resolve, reject) => {
    if ('code' in req.query && !!req.query.code) {
      let code = req.query.code;
      if (!url) {
        console.log('Error: JOIN_SERVER is not set.');
        return null;
      }
      if (!apiKey) {
        console.log('Error: JOIN_API_KEY is not set.');
        return null;
      }
      request({
          url: `${url}/portal/api/user/token?code=${code}`,
          headers: {
            'x-api-key': apiKey
          }
        },
        (error, response, body) => {
          if (!error && response.statusCode === 200) {
            let data = JSON.parse(body);
            let token = data.result.accessToken;
            resolve(token);
          } else {
            console.log('Join get token error: ' + response.statusCode);
            console.log(error);
            reject(error);
          }
        });
    } else {
      console.log('Error: No code in join signin request.');
      reject('No code in request.');
    }
  });
}

function getUserInfo(req, res, url, apiKey, token) {
  return new Promise((resolve, reject) => {
    request({
        url: `${url}/portal/api/user/info`,
        headers: {
          'x-api-key': apiKey,
          'Authorization': `Bearer ${token}`
        }
      },
      (error, response, body) => {
        if (!error && response.statusCode === 200) {
          let data = JSON.parse(body);
          let user = {
            uid: data.result.userUid,
            nickname: data.result.name,
            isValid: data.result.isValid,
            picture: data.result.picture
          };
          if (!user.uid) {
            reject('Lacking uid');
          } else if (!user.nickname) {
            reject('Lacking nickname');
          } else {
            resolve(user);
          }
        } else {
          console.log('Get user info error: ' + response.statusCode);
          console.log(error);
          reject(`Error ${response.statusCode}\n${token}`);
        }
      }
    );
  });
}

function createJoinUser(req, res, user) {
  pg.queryP("INSERT INTO users " +
    "(hname, site_id, is_owner) VALUES ($1, $2, $3)" +
    "returning uid;",
    [user.nickname, `JOIN_${user.uid}`, true])
    .then(rows => {
      let uid = rows[0].uid;
      return pg.queryP("INSERT INTO join_users" +
        "(uid, join_user_id, nickname, picture, valid) VALUES ($1, $2, $3, $4, $5)" +
        "RETURNING uid;",
        [uid, user.uid, user.nickname, user.picture, user.isValid])
    })
    .then(rows => {
      let uid = rows[0].uid;
      startSession(req, res, uid);
    })
    .catch(err => {
      console.log('Error when creating join user');
      console.log(err);
      res.send(err);
    });
}

function startSession(req, res, uid) {
  Session.startSession(uid, function (err, token) {
    if (err) {
      Log.fail(res, 500, "polis_err_reg_failed_to_start_session", err);
      return;
    }
    Cookies.addCookies(req, res, token, uid).then(() => {
      res.send(`UID ${uid} logged in.`);
    });
  });
}

module.exports = {
  signIn
};
