const pg = require('./db/pg-query');
const Config = require('./polis-config');
const Conversation = require('./conversation');
const Log = require('./log');
const Utils = require('./utils/common');
const _ = require('underscore');
const MPromise = require('./utils/metered').MPromise;
const LruCache = require("lru-cache");

function getUserInfoForUid(uid, callback) {
  pg.query_readOnly("SELECT email, hname from users where uid = $1", [uid], function(err, results) {
    if (err) {
      return callback(err);
    }
    if (!results.rows || !results.rows.length) {
      return callback(null);
    }
    callback(null, results.rows[0]);
  });
}

function getUserInfoForUid2(uid) {
  return new MPromise("getUserInfoForUid2", function(resolve, reject) {
    pg.query_readOnly("SELECT * from users where uid = $1", [uid], function(err, results) {
      if (err) {
        return reject(err);
      }
      if (!results.rows || !results.rows.length) {
        return reject(null);
      }
      let o = results.rows[0];
      resolve(o);
    });
  });
}

function addLtiUserIfNeeded(uid, lti_user_id, tool_consumer_instance_guid, lti_user_image) {
  lti_user_image = lti_user_image || null;
  return pg.queryP("select * from lti_users where lti_user_id = ($1) and tool_consumer_instance_guid = ($2);", [lti_user_id, tool_consumer_instance_guid]).then(function(rows) {
    if (!rows || !rows.length) {
      return pg.queryP("insert into lti_users (uid, lti_user_id, tool_consumer_instance_guid, lti_user_image) values ($1, $2, $3, $4);", [uid, lti_user_id, tool_consumer_instance_guid, lti_user_image]);
    }
  });
}

function addLtiContextMembership(uid, lti_context_id, tool_consumer_instance_guid) {
  return pg.queryP("select * from lti_context_memberships where uid = $1 and lti_context_id = $2 and tool_consumer_instance_guid = $3;", [uid, lti_context_id, tool_consumer_instance_guid]).then(function(rows) {
    if (!rows || !rows.length) {
      return pg.queryP("insert into lti_context_memberships (uid, lti_context_id, tool_consumer_instance_guid) values ($1, $2, $3);", [uid, lti_context_id, tool_consumer_instance_guid]);
    }
  });
}

function renderLtiLinkageSuccessPage(req, res, o) {
  res.set({
    'Content-Type': 'text/html',
  });
  let html = "" +
    "<!DOCTYPE html><html lang='en'>" +
    '<head>' +
    '<meta name="viewport" content="width=device-width, initial-scale=1;">' +
    '</head>' +
    "<body style='max-width:320px'>" +
    "<p>You are signed in as polis user " + o.email + "</p>" +
    // "<p><a href='https://pol.is/user/logout'>Change pol.is users</a></p>" +
    // "<p><a href='https://preprod.pol.is/inbox/context="+ o.context_id +"'>inbox</a></p>" +
    // "<p><a href='https://preprod.pol.is/2demo' target='_blank'>2demo</a></p>" +
    // "<p><a href='https://preprod.pol.is/conversation/create/context="+ o.context_id +"'>create</a></p>" +

    // form for sign out
    '<p><form role="form" class="FormVertical" action="' + Config.get('SERVICE_URL') + '/api/v3/auth/deregister" method="POST">' +
    '<input type="hidden" name="showPage" value="canvas_assignment_deregister">' +
    '<button type="submit" class="Btn Btn-primary">Change pol.is users</button>' +
    '</form></p>' +

    // "<p style='background-color: yellow;'>" +
    //     JSON.stringify(req.body)+
    //     (o.user_image ? "<img src='"+o.user_image+"'></img>" : "") +
    // "</p>"+
    "</body></html>";
  res.status(200).send(html);
}

function getUser(uid, zid_optional, xid_optional, owner_uid_optional) {
  if (!uid) {
    // this api may be called by a new user, so we don't want to trigger a failure here.
    return Promise.resolve({});
  }

  let xidInfoPromise = Promise.resolve(null);
  if (zid_optional && xid_optional) {
    xidInfoPromise = Conversation.getXidRecord(xid_optional, zid_optional);
  } else if (xid_optional && owner_uid_optional) {
    xidInfoPromise = Conversation.getXidRecordByXidOwnerId(xid_optional, owner_uid_optional, zid_optional);
  }

  return Promise.all([
    getUserInfoForUid2(uid),
    getFacebookInfo([uid]),
    getTwitterInfo([uid]),
    xidInfoPromise,
    getEmailVerifiedInfo([uid]),
    getJoinInfo([uid])
  ]).then(function(o) {
    let info = o[0];
    let fbInfo = o[1];
    let twInfo = o[2];
    let xInfo = o[3];
    let mvInfo = o[4];
    let joinInfo = o[5];

    let hasFacebook = fbInfo && fbInfo.length && fbInfo[0];
    let hasTwitter = twInfo && twInfo.length && twInfo[0];
    let hasXid = xInfo && xInfo.length && xInfo[0];
    let hasJoin = joinInfo && joinInfo.length && joinInfo[0] && joinInfo[0].valid;
    if (hasFacebook) {
      let width = 40;
      let height = 40;
      fbInfo.fb_picture = "https://graph.facebook.com/v2.2/" + fbInfo.fb_user_id + "/picture?width=" + width + "&height=" + height;
      delete fbInfo[0].response;
    }
    if (hasTwitter) {
      delete twInfo[0].response;
    }
    if (hasXid) {
      delete xInfo[0].owner;
      delete xInfo[0].created;
      delete xInfo[0].uid;
    }
    if (hasJoin) {
      delete joinInfo[0].uid;
    }
    return {
      uid: uid,
      email: info.email,
      hname: info.hname,
      emailVerified: !!(mvInfo && mvInfo.length > 0 && mvInfo[0]),
      hasFacebook: !!hasFacebook,
      facebook: fbInfo && fbInfo[0],
      twitter: twInfo && twInfo[0],
      join: joinInfo && joinInfo[0],
      hasTwitter: !!hasTwitter,
      hasXid: !!hasXid,
      hasJoin: !!hasJoin,
      xInfo: xInfo && xInfo[0],
      finishedTutorial: !!info.tut,
      site_ids: [info.site_id],
      created: Number(info.created),
      daysInTrial: 10 + (usersToAdditionalTrialDays[uid] || 0),
      // plan: planCodeToPlanName[info.plan],
      planCode: info.plan,
    };
  });
}

function getTwitterInfo(uids) {
  return pg.queryP_readOnly("select * from twitter_users where uid in ($1);", uids);
}

function getFacebookInfo(uids) {
  return pg.queryP_readOnly("select * from facebook_users where uid in ($1);", uids);
}

function getEmailVerifiedInfo(uids) {
  return pg.queryP_readOnly("SELECT * FROM email_validations WHERE email=" +
    "(SELECT email FROM users WHERE uid in ($1));", uids);
}

function getJoinInfo(uids) {
  return pg.queryP_readOnly("select * from join_users where uid in ($1);", uids);
}

// so we can grant extra days to users
// eventually we should probably move this to db.
// for now, use git blame to see when these were added
const  usersToAdditionalTrialDays = {
  50756: 14, // julien
  85423: 100, // mike test
};

function createDummyUser() {
  return new MPromise("createDummyUser", function(resolve, reject) {
    pg.query("INSERT INTO users (created) VALUES (default) RETURNING uid;", [], function(err, results) {
      if (err || !results || !results.rows || !results.rows.length) {
        console.error(err);
        reject(new Error("polis_err_create_empty_user"));
        return;
      }
      resolve(results.rows[0].uid);
    });
  });
}

let pidCache = new LruCache({
  max: 9000,
});

// returns a pid of -1 if it's missing
function getPid(zid, uid, callback) {
  let cacheKey = zid + "_" + uid;
  let cachedPid = pidCache.get(cacheKey);
  if (!_.isUndefined(cachedPid)) {
    callback(null, cachedPid);
    return;
  }
  pg.query_readOnly("SELECT pid FROM participants WHERE zid = ($1) AND uid = ($2);", [zid, uid], function(err, docs) {
    let pid = -1;
    if (docs && docs.rows && docs.rows[0]) {
      pid = docs.rows[0].pid;
      pidCache.set(cacheKey, pid);
    }
    callback(err, pid);
  });
}

// returns a pid of -1 if it's missing
function getPidPromise(zid, uid, usePrimary) {
  let cacheKey = zid + "_" + uid;
  let cachedPid = pidCache.get(cacheKey);
  return new MPromise("getPidPromise", function(resolve, reject) {
    if (!_.isUndefined(cachedPid)) {
      resolve(cachedPid);
      return;
    }
    const f = usePrimary ? pg.query : pg.query_readOnly;
    f("SELECT pid FROM participants WHERE zid = ($1) AND uid = ($2);", [zid, uid], function(err, results) {
      if (err) {
        return reject(err);
      }
      if (!results || !results.rows || !results.rows.length) {
        resolve(-1);
        return;
      }
      let pid = results.rows[0].pid;
      pidCache.set(cacheKey, pid);
      resolve(pid);
    });
  });
}


function resolve_pidThing(pidThingStringName, assigner, loggingString) {
  if (_.isUndefined(loggingString)) {
    loggingString = "";
  }
  return function(req, res, next) {
    if (!req.p) {
      Log.fail(res, 500, "polis_err_this_middleware_should_be_after_auth_and_zid");
      next("polis_err_this_middleware_should_be_after_auth_and_zid");
    }
    console.dir(req.p);

    let existingValue = Utils.extractFromBody(req, pidThingStringName) ||
      Utils.extractFromCookie(req, pidThingStringName);

    if (existingValue === "mypid" && req.p.zid && req.p.uid) {
      getPidPromise(req.p.zid, req.p.uid).then(function(pid) {
        if (pid >= 0) {
          assigner(req, pidThingStringName, pid);
        }
        next();
      }).catch(function(err) {
        Log.fail(res, 500, "polis_err_mypid_resolve_error", err);
        next(err);
      });
    } else if (existingValue === "mypid") {
      // don't assign anything, since we have no uid to look it up.
      next();
    } else if (!_.isUndefined(existingValue)) {
      Utils.getInt(existingValue).then(function(pidNumber) {
        assigner(req, pidThingStringName, pidNumber);
        next();
      }).catch(function(err) {
        Log.fail(res, 500, "polis_err_pid_error", err);
        next(err);
      });
    } else {
      next();
    }
  };
}


// must follow auth and need('zid'...) middleware
function getPidForParticipant(assigner, cache) {
  return function(req, res, next) {
    let zid = req.p.zid;
    let uid = req.p.uid;

    function finish(pid) {
      assigner(req, "pid", pid);
      next();
    }
    getPidPromise(zid, uid).then(function(pid) {
      if (pid === -1) {
        let msg = "polis_err_get_pid_for_participant_missing";
        Log.yell(msg);

        console.log("info", zid);
        console.log("info", uid);
        console.log("info", req.p);
        next(msg);
      }
      finish(pid);
    }, function(err) {
      Log.yell("polis_err_get_pid_for_participant");
      next(err);
    });
  };
}

module.exports = {
  pidCache,
  getUserInfoForUid,
  getUserInfoForUid2,
  addLtiUserIfNeeded,
  addLtiContextMembership,
  renderLtiLinkageSuccessPage,
  getUser,
  createDummyUser,
  getPid,
  getPidPromise,
  resolve_pidThing,
  getPidForParticipant
};