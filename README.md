# Beergame simulation 

## Description:
"[Beer distribution game](http://en.wikipedia.org/wiki/Beer_distribution_game)" simulation, based on modern web technologies

A project by Christian Hollinger & Julian Hoernschemeyer  
Driven by a uni-project @ Hochschule Osnabrück, Standort Lingen (Ems), Germany

## Project time:
Nov. - Jan. 2014

## Used technologies:
Client: jQuery 1.9.1, jQuery Mobile 1.4.0, jQuery Cookie, flotr2  
Server: node.js, express 3.4.7, socket.io 0.9.16, node-http-proxy 0.10.4, winston 0.7.2, Apache 2.4.7, mySQL, PHP 5.5.4 @ Debian 3.2.51-1 x86_64 GNU/Linux
		
## Contact:
christian.hollinger@hs-osnabrueck.de / www.otter-in-a-suit.com  
julian.hoernschemeyer@hs-osnabrueck.de

## Usage: 
1. Install all requirements, at least node.js w/ plugins and mySQL (see "Used technologies")
2. Upload the content of Beergame_Client & Beergame_Server onto an accessible web-server of your choice (see "Structure")
3. Edit the "configuration.config.example" to match your requirements
4. Create a database & import the 3 sql-scripts from Beergame_Server/sql
5. Run app.js (We recommend "[Forever](https://github.com/nodejitsu/forever)"!)
6. Enjoy!

## Structure:
├── app.js  
├── configuration.json  
├── css  
│   ├── images  
│   └── jquery.mobile-1.4.0.min.css  
├── index.html  
├── images  
├── js  
│   ├── flotr2.min.js  
│   ├── jquery-1.9.1.min.js  
│   ├── jquery.cookie.js  
│   └── jquery.mobile-1.4.0.min.js  
├── LICENSE  
├── node_modules
└── package.json

## License:
GPL v3 
