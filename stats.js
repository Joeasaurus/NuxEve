"use strict";

var fs      = require('fs'),
	path    = require('path'),
	os      = require('os'),
	evenode = require('evenode'),
	cheerio = require('cheerio'),
	async   = require('async'),
	EventEmitter2 = require('eventemitter2').EventEmitter2;

class Config {
	constructor(path) {
		this._config = JSON.parse(fs.readFileSync(path));
	}
	get config() { return this._config; }
}

let EvePilot = function(char_name, char_id) {
	this.name    = char_name;
	this.charid  = char_id;
}

class NuxEve extends EventEmitter2 {
	constructor(config) {
		super();
		this._eve    = evenode(config);
		this._chars  = new Map();
		this._loaded = false;
		this.loadCharacters(() => { 
			this._loaded = true;
			this.emit('charsLoaded', this._chars);
		});
	}

	_loadData(data, callback) {
		let $ = cheerio.load(data, {xmlMode: true});
		let $rows = $('eveapi > result > rowset > row');
		if($rows.length <= 0)
			return callback({'err': 'no rows found'});

		$rows.each((index, element) => {
			callback(null, $(element)[0].attribs)
		});
	}

	loadCharacters(callback) {
		var callback = callback || () => {};

		let queue = async.queue((task, queue_callback) => {
			this._chars.set(task.name, new EvePilot(task.name, task.characterID));
			queue_callback();
		});

		this._eve.account.characters((err, data) => {
			if(err) return callback(err);

			this._loadData(data, (err_two, loadedData) => {
				if(err) return callback(err);

				queue.push({
					"name": loadedData.name, 
					"characterID": loadedData.characterID
				});
			})
		});

		queue.drain = () => {
			this.loadBalances();
			this.once('balancesLoaded', callback);
		};

	}

	loadBalances(callback) {
		var callback = callback || () => {}; 

		let queue = async.queue((task, queue_callback) => {
			this._chars.get(task.name)['balance'] = task.balance;
			queue_callback();
		});

		this._chars.forEach((value) => {
			this._eve.character.accountBalance(value.charid, (err, data) => {
				if(err) return callback(err);

				this._loadData(data, (err_two, loadedData) => {
					if(err) return callback(err_two);

					queue.push({
						"name": value.name,
						"balance": loadedData.balance
					});
				})
			});
		});
		queue.drain = () => {
			this.emit('balancesLoaded');
			callback();
		};
	}

	get chars() {
		if(this._loaded)
			return this._chars;
		return {"error": "Characters not loaded yet!"};
	}

	getBalance(char_name) {
		return this._chars;
	}
}

let config = new Config(path.join(__dirname, 'config.json'));
let ne = new NuxEve(config.config);
ne.once('charsLoaded', () => {
	console.log(ne.chars);
});