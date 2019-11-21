// Scrape Crestron's firmware/software update page and send out a notification via slack

const https = require('https');       // request
const fs = require('fs');             // store results
const cheerio = require('cheerio');   // jquery like scraping
const dotenv = require('dotenv');     // easy environment vars

// Crestron firmware/software update page
const options = {
  hostname: 'crestron.com',
  port: 443,
  path: '/en-US/Support/Search-Results?c=4',
  method: 'GET'
}

// slack webhook
dotenv.config();
const slackWebHookPath = process.env.SLACK_WEBHOOK_PATH || false;

if (!slackWebHookPath){
  console.error('Slack Webhook Path not defined');
  process.exit();
}


/**
 * Compare data gathered to what has been stored on disk
 * @param {any} updates 
 * returns true or false
 */
function compareResults(updates)
{
  // if file doesnt exist
  if(!fs.existsSync('./previous-results.json'))
  {
    // write to file
    try{
      fs.writeFileSync("./previous-results.json", JSON.stringify(updates));
    } catch (e) {
      console.error(e);
      return false;
    }
    
    return false;
  }
  else
  {
    // compare files
    try {
      let previousResults = JSON.parse(fs.readFileSync('./previous-results.json'));
      console.log("previousResults",previousResults);
      console.log("updates",updates);
      if(JSON.stringify(updates) == JSON.stringify(previousResults))
      {
        console.log('Results Match!')
        return true
      }
      else
      {
        console.log('Results differ');
        fs.writeFileSync("./previous-results.json", JSON.stringify(updates));
        return false
      }
    }
    catch(e){
      console.error(e);
      return false;
    }
  }
}

/**
 * This is the json required to send a message to slack
 * @param {any} updates 
 */
function formatSlackMessage(updates){
  // Create some header info
  let message = {
    text: "Latest updates from Crestron :loudspeaker:",
    blocks: [
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: "Latest updates from Crestron :loudspeaker:"
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

  // add each firmware/software update to the list
  updates.forEach(update => {
    message.blocks.push(
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
  return message;
}

/**
 * Sends the json payload to the slack webhook specified
 * @param {webhook} path 
 * @param {json} message 
 */
function sendSlackMessage(path, message){
  try{
    message = JSON.stringify(message);
  } catch(e) {
    console.log(e);
    return false
  }

  return new Promise((resolve, reject) => {
    const requestOpts = {
      hostname: 'hooks.slack.com',
      path: path,
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

/**
 * Sends a query to Crestron for software/firmware updates
 * then process the results
 */
function sendQuery(){
  const req = https.request(options, res => {
    console.log(`statusCode: ${res.statusCode}`)

    let body = '';

    res.on('data', d => {
      body = body + d;
    });

    // finished the query, body should now contain the resulting html
    res.on('end', () =>{
      const $ = cheerio.load(body);
      let results = [];

      // each item is contained in its own class of .search-result
      const searchResults = $('.search-result');

      // scrape the data we need and add to the results array
      searchResults.each((i,res) => {
        const item = $(res).find($('.resource-search-name a'));
        const date = $(res).find($('.resource-search-date'));
        const type = $(res).find($('.resource-search-type'));

        // prepend the link with crestron tld
        results.push({
          date:date.text(),
          name:item.text(),
          link:`https://crestron.com${item.attr('href')}`,
          type:type.text()
        })
      })

      // compare results and send to slack if the results dont mach what we have on file
      if(!compareResults(results))
      {
        sendSlackMessage(slackWebHookPath, formatSlackMessage(results));
      }
    })
  })

  req.on('error', error => {
    console.error(error)
  })

  req.end();
}

// go!
sendQuery();