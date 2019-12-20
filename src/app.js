// Scrape Crestron's firmware/software update page and send out a notification via slack

const https   = require('https');     // request
const fs      = require('fs');        // store results
const cheerio = require('cheerio');   // jquery like scraping
const slack   = require('./slack');  // post to slack

// Crestron firmware/software update page
const options = {
  hostname: 'crestron.com',
  port: 443,
  path: '/en-US/Support/Search-Results?c=4&m=10&q=&o=0',
  method: 'GET'
}

/**
 * Compare data gathered to what has been stored on disk
 * @param {any} updates 
 * returns true if changed/new otherwise, false
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
 * Process the response we get back from querying the Crestron update site
 */
function processBody(body){
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
  });

  return results;
}

/**
 * Query Crestron for the latest updates
 */
function queryLatestUpdates(callback){
  const req = https.request(options, res => {
    console.log(`statusCode: ${res.statusCode}`)
    let body = '';

    res.on('data', d => {
      body = body + d;
    });

    // finished query, process the response
    res.on('end', () => {
      const results = processBody(body);
      if(!compareResults(results)){
        return callback(results);
      }
      callback(null);
    });
  });

  req.on('error', error => {
    console.error(error)
    callback(null);
  });

  req.end();
}

/**
 * Query Crestron update site for latest releases
 */
queryLatestUpdates(res => {
  if(!res){
    console.log('No updates today, exiting');
    process.exit();
  }
  console.log(`We have ${res.length} results`);
  slack.postMessage(res);
});