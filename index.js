var request = require('request');
var _ = require('underscore');
_.mixin( require('underscore.deferred') );
var inflection = require('inflection');
var Twit = require('twit');
var T = new Twit(require('./config.js'));
var wordfilter = require('wordfilter');
var ent = require('ent');
var rita = require('rita');
var r = rita.RiTa;
var rl = rita.RiLexicon();

var reallyLog = console.log;
console.log = console.error = console.info = console.debug = console.warn = function() {};

Array.prototype.pick = function() {
  return this[Math.floor(Math.random()*this.length)];
};

Array.prototype.pickRemove = function() {
  var index = Math.floor(Math.random()*this.length);
  return this.splice(index,1)[0];
};

function generate() {
  var tweets = search(rl.randomWord(1)).then(function(results) {
    return _.map(results, function(tweet) {
      var stresses = r.getStresses(tweet.replace(/'/,'')).replace(/[^01\/\s]/g,'').replace(/\s\s+/g, '');
      return {tweet: tweet, stresses: stresses};
    });
  }).done(function(tweets){
    var lyrics = [
      "The itsy bitsy spider went up the water spout",
      "down came the rain and washed the spider out",
      "out came the sun and dried up all the rain",
      "and the itsy bitsy spider went up the spout again"
    ];

    var lyrics = _.map(lyrics, function(line) {
      return {line: line, stresses: r.getStresses(line)}
    });

    var lyricStresses = _.map(lyrics, function(i){return i.stresses});
    var tweetStresses = _.map(tweets, function(i){return i.stresses});
    var intersection = _.intersection(lyricStresses, tweetStresses);

    reallyLog("intersection: " + intersection.length);

    var successes = 0;
    _.each(lyrics, function(lyric) {
      var match = _.findWhere(tweets, {stresses: lyric.stresses})
      if (match !== undefined) {
        reallyLog('SUCCESS! ' + match.tweet + ' = ' + lyric.line);
        successes++;
      } else {
        //console.log(lyric.line);
      }
    });
  });

  return new _.Deferred().resolve("");
}

function tweet() {
  generate().then(function(myTweet) {
    if (!wordfilter.blacklisted(myTweet)) {
      console.log(myTweet);
      /*
      T.post('statuses/update', { status: myTweet }, function(err, reply) {
        if (err) {
          console.log('error:', err);
        }
        else {
          console.log('reply:', reply);
        }
      });
      */
    }
  });
}

function search(term) {
  console.log('searching',term);
  var dfd = new _.Deferred();
  T.get('search/tweets', { q: term, count: 100 }, function(err, reply) {
    console.log('search error:',err);
    var tweets = reply.statuses;
    tweets = _.chain(tweets)
      // decode weird characters
      .map(function(el) {
        if (el.retweeted_status) {
          return ent.decode(el.retweeted_status.text);
        }
        else {
          return ent.decode(el.text);
        }
      })
      .reject(function(el) {
        // throw out quotes and links and replies
        return el.indexOf('http') > -1 || el.indexOf('@') > -1 || el.indexOf('"') > -1;
      })
      .uniq()
      .value();
    dfd.resolve(tweets);
  });
  return dfd.promise();
}

// Run every 20 seconds
setInterval(function () {
  try {
    tweet();
  }
  catch (e) {
    console.log(e);
  }
}, 1000 * 20);

// Tweet once on initialization
tweet();
