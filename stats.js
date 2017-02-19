#!/usr/bin/env node
"use strict";

var evenode        = require('evenode'),
		cheerio        = require('cheerio'),
		EventEmitter2  = require('eventemitter2').EventEmitter2;

class APIConfig {
	constructor(acc_id, api_key) {
		this._config = {
			"keyID": acc_id,
			"vCode": api_key,
			"host": "api.eveonline.com"
		};
	}
	get config() { return this._config; }
}

class EveCharacter {
	constructor(name, id) {
		this.name = name;
		this.ID = id;
	}
}

class EvePilot {
	constructor(api) {
		var events = new EventEmitter2();
		this.characters = new Map();
		this._eve = evenode(api.config);
		this.loadCharacters((char) => {
			events.emit('char-loaded', char);
		});
		this.events = events;
	}

	getBalance(char_name, formatted) {
		if(this.characters.has(char_name)) {
			let gotChar = this.characters.get(char_name);
			let charBal = formatted ? gotChar.balance.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",") : gotChar.balance;
			return charBal;
		}
		return NaN;
	}

	loadCharacters(callback) {
		let instance = this;

		this._eve.account.characters((err, data) => {
			if(err) return callback(err);

			instance._parseAPIData(data, (err_two, loadedData) => {
				if(err_two) return callback(err_two);

				instance.characters.set(loadedData.name, new EveCharacter(loadedData.name, loadedData.characterID));
				instance._loadBalance(loadedData.name, () => {
					callback(instance.characters.get(loadedData.name));
				});
			});
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

	_loadBalance(name, callback) {
		let instance = this;
		let id = this.characters.get(name).ID;

		this._eve.character.accountBalance(id, (err, data) => {
			if(err) return callback(err);

			this._parseAPIData(data, (err_two, loadedData) => {
				if(err) return callback(err_two);

				instance.characters.get(name)['balance'] = loadedData.balance;
				callback(loadedData.balance)
			});
		});
	}
}

let config = new APIConfig(process.env.EVE_API_KEY, process.env.EVE_API_SECRET);
let ne = new EvePilot(config);
ne.events.on('char-loaded', (char) => {
	console.log(char);
});
