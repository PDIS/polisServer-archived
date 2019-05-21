const Config = require('../polis-config');

let mailgun = null;
if (Config.get('MAILGUN_API_KEY')) {
  mailgun = require("mailgun-js")(
    {apiKey: Config.get('MAILGUN_API_KEY'), domain: Config.get('MAILGUN_DOMAIN')});
}

function sendText(sender, recipient, subject, text) {
  if (!mailgun) {
    return;
  }

  console.log("sending email with Mailgun: " + [sender, recipient, subject, text].join("\n"));

  return new Promise(function (resolve, reject) {
    var data = {
      from: sender,
      to: recipient,
      subject: subject,
      text: text
    };
    mailgun.messages().send(data, function (error, body) {
      console.log("Mailgun sent");
      console.log(body);
      if (error) {
        console.error(error);
        reject(error);
      } else {
        resolve();
      }
    });
  });
}

module.exports = {
  sendText
};
