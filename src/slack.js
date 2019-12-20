'use strict'

const https   = require('https');     // request
const dotenv  = require('dotenv');    // easy environment vars

module.exports.postMessage = postMessage;

// slack webhook
dotenv.config();
const slackWebHookPath = process.env.SLACK_WEBHOOK_PATH || false;
if (!slackWebHookPath){
  console.error('Slack Webhook Path not defined');
  process.exit();
}

// message template
const messageTemplate = {
  text: "Latest updates from Crestron :loudspeaker:",
  blocks: [
  {
    type: "section",
    text: {
      type: "mrkdwn",
      text: "Latest updates from <https://crestron.com/en-US/Support/Search-Results?c=4&m=10&q=&o=0|Crestron> :loudspeaker:"
    }
  },
  {
    type: "divider"
  },
  {
    type: "section",
    fields: [
    {
      type: "mrkdwn",
      text: "*Name*"
    },
    {
      type: "mrkdwn",
      text: "*Updated*"
    }]
  }]
};

/**
 * format the data for slack
 */
function formatMessage(message){
  let data = messageTemplate;

  // add each firmware/software update to the list
  message.forEach(update => {
    data.blocks.push(
    {
      type: "section",
      fields: [
        {
          type: "mrkdwn",
          text: `<${update.link}|${update.name}>`
        },
        {
          type: "mrkdwn",
          text: update.date
        }
      ]
    },
    {
      type: "context",
      elements: [
        {
          type: "mrkdwn",
          text: update.type == 'Firmware' ? ":hammer:*Firmware*" : ":floppy_disk:*Software*"
        }
      ]
    });
  });

  return data;
}


function postMessage(message)
{
  try{
    message = JSON.stringify(formatMessage(message));
  } catch(e) {
    console.log(e);
    return false
  }

  return new Promise((resolve, reject) => {
    const requestOpts = {
      hostname: 'hooks.slack.com',
      path: slackWebHookPath,
      method: 'POST',
      header:{ 'Content-Type':'application/json'}
    }
    const req = https.request(requestOpts, (res) => {
      let response = '';
      res.on('data',(data) => { response += data; })
      res.on('end', () => { resolve(response); })
    })

    req.on('error', (e) => { reject(e); })
    req.write(message);
    req.end();
  });
}