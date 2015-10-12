'use strict';

var fs = require('fs');
var config = {
  production: {
    mongodb: {
      uri: 'mongodb://localhost/vizon',
      options: {}
    },
    listeners: [{
      port: 443,
      ssl: {
        //pfx: fs.readFileSync('./ssl/server.p12'),
        //passphrase: 'sUp3|25e>r37'
        // or
        //cert: fs.readFileSync('./ssl/server.crt'),
        //key: fs.readFileSync('./ssl/server.pem')
        //ca: fs.readFileSync('./ssl/ca.crt')
      },
      io: { log: false },
    }],
    hook_key: '62dd194f84418480e00629836efa'
  },
  development: {
    mongodb: {
      uri: 'mongodb://localhost/vizon',
      options: {}
    },
    listeners: [{
      port: 8080,
      io: { },
    }]
  }
};

var env = (process.env.NODE_ENV == 'production' ? 'production' : 'development');
for(var k in config[env])
  exports[k] = config[env][k];
exports.prod = (env == 'production'); // set boolean flags for convenience
exports.dev = !(exports.prod);
exports.env = env;


exports.companyName = 'Stanford SSDL';
exports.projectName = 'Vizon';
exports.systemEmail = 'support@email.addr';
exports.cryptoKey = 'k3yb0ardc4t';
exports.loginAttempts = {
  forIp: 50,
  forIpAndUser: 7,
  logExpiration: '20m'
};
exports.requireAccountVerification = true;
exports.smtp = {
  from: {
    name: process.env.SMTP_FROM_NAME || exports.projectName +' Account Management',
    address: process.env.SMTP_FROM_ADDRESS || 'support@email.addr'
  },
  credentials: {
    //user: process.env.SMTP_USERNAME || '',
    //password: process.env.SMTP_PASSWORD || '',
    host: process.env.SMTP_HOST || 'smtp.email.com',
    ssl: true
  }
};
/*
exports.oauth = {
  twitter: {
    key: process.env.TWITTER_OAUTH_KEY || '',
    secret: process.env.TWITTER_OAUTH_SECRET || ''
  },
  facebook: {
    key: process.env.FACEBOOK_OAUTH_KEY || '',
    secret: process.env.FACEBOOK_OAUTH_SECRET || ''
  },
  github: {
    key: process.env.GITHUB_OAUTH_KEY || '',
    secret: process.env.GITHUB_OAUTH_SECRET || ''
  },
  google: {
    key: process.env.GOOGLE_OAUTH_KEY || '',
    secret: process.env.GOOGLE_OAUTH_SECRET || ''
  }
};*/
