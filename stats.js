"use strict";

var fs      = require('fs'),
	path    = require('path'),
	os      = require('os'),
	evenode = require('../evenode'),
	cheerio = require('cheerio'),
	async   = require('async');

// if (process.argv.length < 3) {
// 	return usage();
// }

// var argv = process.argv.slice(2);

// var cmd = argv[0];

// if (cmd === 'help') {
// 	return usage();
// }

// var apiArgs = argv.slice(1);
// apiArgs.push(function (err, data) {
// 	if (err) return console.error(err);
// 	var x = xml.parseString(data);
// 	var t = function(err, root) {
// 		console.log(data);
// 		console.log(err);
// 		console.log(root);
// 	};
// 	var y = [];
// 	for (var xx in x.childs) {
// 		if (x.childs[xx] != '\r\n' && x.childs[xx] != '\r\n  ') {
// 			y.push(x.childs[xx]);
// 		}
// 	}
// 	x['childs'] = y;
// 	console.log(x);
// });


// 	var parts = cmd.split(':'),
// 		namespace = parts[0],
// 		method = parts[1];

// 	var func = evenode(config)[namespace][method];

// 	func.apply(null, apiArgs);
// });

let EvePilot = function(char_name, char_id) {
	this.name    = char_name;
	this.charid  = char_id;
}


class Config {
	constructor(path) {
		this._config = JSON.parse(fs.readFileSync(path));
	}
	get config() { return this._config; }
}

class NuxEve {
	constructor(config, callback) {
		this._eve   = evenode(config);
		this._chars = {"loaded": false};
		this.loadCharacters(() => {
			callback();
		});
	}

	loadCharacters(callback) {
		let queue = async.queue((task, queue_callback) => {
			this._chars[task.name] = new EvePilot(task.name, task.characterID);
			queue_callback();
		})
		this._eve.account.characters((err, data) => {
			console.log(data);
			let $ = cheerio.load(data, {xmlMode: true});
			$('eveapi > result > rowset > row').each((index, element) => {
				let eleData = $(element)[0].attribs;
				queue.push({"name": eleData.name, "characterID": eleData.characterID});
			});
		});
		queue.drain = () => {
			this._chars.loaded = true;
			callback();
		};
	}

	get chars() {
		if(this._chars.loaded) {
			return this._chars;
		}
	}
}

let config = new Config(path.join(__dirname, 'config.json'));
console.log(config.config);
let ne = new NuxEve(config.config, () => {
	console.log(ne.chars);
});