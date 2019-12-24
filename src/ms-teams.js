'use strict'

const https   = require('https');     // request
const dotenv  = require('dotenv');    // easy environment vars

module.exports.postMessage = postMessage;

// webhook
dotenv.config();
const webhookPath = process.env.MSTEAMS_WEBHOOK_PATH || false;
if (!webhookPath){
  console.error('Webhook Path not defined');
  process.exit();
}

// message template
const messageTemplate = {
  '@type': 'MessageCard',
  '@context': 'https://schema.org/extensions',
  summary: 'Latest updates from Crestron',
  themeColor: '0078D7',
  sections: [
    {
      facts:[]
    }
  ]
};

/**
 * format the data
 */
function formatMessage(message){
  let data = messageTemplate;

  message.forEach(update => {
    data.sections[0].facts.push(
      {
        name: 'Name:',
        value: `[${update.name}](${update.link})`
      }
    );
    data.sections[0].facts.push(
      {
        name: 'Date Released:',
        value: update.date
      }
    );
    data.sections[0].facts.push(
      {
        name: 'Type:',
        value: update.type == 'Firmware' ? "**Firmware**" : "**Software**"
      }
    );
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
      hostname: 'outlook.office.com',
      path: webhookPath,
      method: 'POST',
      headers:{ 
        'Content-Type':'application/json',
        'Content-Length': message.length
      }
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