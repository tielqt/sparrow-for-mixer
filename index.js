var clientInfo = require('./config/clientinfo.json')
var morgan = require('morgan');
var User = require('./app/user');
var path = require('path');
var appDir = path.dirname(require.main.filename);
var express = require('express'), fs = require('fs'), app = express(), response = {};
var session = require('express-session');
var bodyParser = require('body-parser');
var passport = require('passport'),
MixerStrategy = require('passport-mixer').Strategy;
var request = require('request');
var SQLiteStore = require('connect-sqlite3')(session);

var http = require('http');
var https = require('https');
var privateKey  = fs.readFileSync('sslcert/server.key', 'utf8');
var certificate = fs.readFileSync('sslcert/server.crt', 'utf8');

var credentials = {
	key: privateKey,
	cert: certificate,
}

var mixerApi = "https://mixer.com/api/v1";

// var config = require('config/config.json');
// var mixerSession = require('config/mixerSession.json');

app.use(morgan(':method :url :status :res[content-length] - :response-time ms'));
app.use(express.static(appDir+'/public'));
app.use(session({
	store: new SQLiteStore,
	secret: 'nonsensegibberish', 
	cookie: {
		httpOnly: true,
		maxAge: 1000 * 60 * 60 * 24 * 365
	}
}));
app.set('view engine', 'ejs');
app.set('views',appDir+"\\views");
app.use(passport.initialize());
app.use(passport.session());

passport.use(new MixerStrategy({
    clientID: clientInfo.id,
    clientSecret: clientInfo.secret,
    callbackURL: "https://localhost/auth/mixer/callback"
  },
  function(accessToken, refreshToken, profile, done) {
    User.findOrCreate(profile.id, {"accessToken": accessToken, "refreshToken": refreshToken, "tokenDate": Date.now(), "_raw": profile._raw});
   	// console.log(profile._raw);
  	return done(null, profile);
  }
));

passport.serializeUser(function(user, done) {
  done(null, user.id);
});

passport.deserializeUser(function(id, done) {
	console.log("Passport Deserialize");
	User.findById(id, function(err, user) {
		// console.log("USER: "+JSON.stringify(user));
  	done(null, user);
	})
});

app.get('/auth/mixer',
  passport.authenticate('mixer', {scope: "channel:update:self+channel:analytics:self+user:analytics:self+user:details:self"}));

app.get('/auth/mixer/callback',
  passport.authenticate('mixer', { failureRedirect: '/failed' }),
  function(req, res) {
  	// Successful authentication, redirect home.
  	console.log('Successful authentication, redirect to dash.')
    res.redirect('/dashboard');
  });

app.get('/', (req, res) => {
 res.redirect('/overlay');
});

app.get('/overlay', (req, res) => {
 res.render('overlay/overlay', {user: req.user, isAuthenticated: true})
});

app.get('/failed', (req, res) => {
	res.send(html);
});

app.get('/dashboard', (req, res) => {
  if (req.isAuthenticated()) {
  	res.render('dashboard', {user: req.user, isAuthenticated: true});
  } else {
  	res.render('dashboard', {isAuthenticated: false});
  }
});

app.get('/logout', (req, res) => {
	req.logOut();
	res.redirect('/dashboard');
});

app.get('/favicon.ico', (req, res) => {
  res.status(404)        // HTTP status 404: NotFound
   .send('Not found');
});

// your express configuration here

server = https.createServer(credentials, app).listen(443, function(){
  console.log("Express server listening on port " + 443);
});

http.createServer(function (req, res) {
    res.writeHead(301, { "Location": "https://" + req.headers['host'] + req.url });
    res.end();
}).listen(80);