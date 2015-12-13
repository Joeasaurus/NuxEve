#!/usr/bin/env node
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
		this.loadCharacters((err) => {
			if(err) return console.log(err); 
			this._loaded = true;
			this.emit('charsLoaded', this._chars);
		});
	}

	_parseAPIData(data, callback) {
		let $ = cheerio.load(data, {xmlMode: true});
		let $rows = $('eveapi > result > rowset > row');
		if($rows.length <= 0)
			return callback({'err': 'no rows found'});

		$rows.each((index, element) => {
			callback(null, $(element)[0].attribs)
		});
	}

	loadCharacters(callback) {
		if(!callback) 
			var callback = function(err) {console.log(err);};

		let queue = async.queue((task, queue_callback) => {
			this.loadBalance({"name": task.name, "id": task.characterID}, (err, balance) => {
				if(err) {
					console.log(err);
				} else {
					this._chars.set(task.name, new EvePilot(task.name, task.characterID));
					this._chars.get(task.name)['balance'] = balance;
				}
				queue_callback();
			});
		});

		this._eve.account.characters((err, data) => {
			if(err) return callback(err);

			this._parseAPIData(data, (err_two, loadedData) => {
				if(err) return callback(err);

				queue.push({
					"name": loadedData.name, 
					"characterID": loadedData.characterID
				});
			})
		});

		queue.drain = () => {
			callback();
		};

	}

	loadBalance(charData, callback) {
		if(! charData || ! charData.id)
			return "No char data!";
		if(!callback) 
			var callback = function(err) {console.log(err);};

		this._eve.character.accountBalance(charData.id, (err, data) => {
			if(err) return callback(err);

			this._parseAPIData(data, (err_two, loadedData) => {
				if(err) return callback(err_two);

				callback(null, loadedData.balance);
			});
		});
	}

	get chars() {
		if(this._loaded)
			return this._chars;
		return {};
	}

	getBalance(char_name, formatted) {
		if(this._loaded && this._chars.has(char_name)) {
			let gotChar = this._chars.get(char_name);
			let charBal = formatted ? gotChar.balance.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",") : gotChar.balance;
			return charBal;
		}
		return 0;
	}
}

let config = new Config(path.join(__dirname, 'config.json'));
let ne = new NuxEve(config.config);
ne.once('charsLoaded', (data) => {
	console.log(ne.getBalance("Jinux", true) + " ISK");
});
