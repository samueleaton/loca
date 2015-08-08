module.exports = (function(){

	var fs = require("fs");

	var _events = {};
	var _localData = {};


	function emit(eventName, data){
		if (_events[eventName]) {
			_events[eventName].forEach(function(fn) {
				if(typeof data !== "undefined") fn(data);
				else fn(undefined);
			});
		}
	};


	function parseJson(fileData){
		var parsedFile;
		try {
			parsedFile = JSON.parse(fileData);
		}
		catch(e){
			emit("error", "JSON file not valid | "+e);
			parsedFile = null;
		}
		return parsedFile;
	}

	function getDataFromPath(obj, path, callback){
		if(typeof path === "undefined" || path === null) return obj;
		var queryArr = path.trim().split(".");
		var dbObject = obj;
		for(var i = 0, ii = queryArr.length; i < ii; i++){
			if( dbObject[queryArr[i]] ){
				dbObject =  dbObject[ queryArr[i] ];
			} else {
				// emit("error", "query path not found "+path+" | Error at ("+queryArr[i]+")");
				return (typeof callback === "function") ? callback(true, null) : undefined ;
			}
		}
		return callback(false, dbObject);
	}


	function getParentPath(Obj){ 
		var self = _localData[Obj.__name__];

		if(self[isProperty]){
			var parent = _localData[ self[propertyOf] ];

			if(parent[isProperty]) {
				return (getParentPath(parent) +"."+ self[path] );
			}
			else {
				return self[path];
			};

		} 

		else {
			return "";
		}

	}

	function triggerEmitter(propertyName, triggerName, triggerData){

		emit(propertyName+" "+triggerName, triggerData);

		if(_localData[propertyName]["isProperty"]) {
			var ParentName = _localData[propertyName]["propertyOf"];
			console.log("ParentName",ParentName);
			console.log("_localData",_localData);
			triggerEmitter(ParentName, triggerName, _localData[ParentName].data);
		}

	}

	

	var dbMethods = {
		commit: function(callback){
			if(_localData[this.__name__].data) {
				var self = this;
				fs.writeFile(_localData[this.__name__][path], JSON.stringify(this.get()), function(err){
					if(err) emit("error", "error committing local data to file");
					if(typeof callback === "function") {
						triggerEmitter(self.__name__, "committed", self.get());
						callback();
					}
				});

			}
		},

		get: function(getterPath){
			if(typeof getterPath === "undefined" || getterPath === null) return _localData[this.__name__].data;
			else if(typeof getterPath !== "string") return emit("error", this.__name__+".get only takes a paramter of type 'string', 'undefined', or 'null'. You passed a parameter of type '"+typeof getterPath+"'.");

			var queryArr = getterPath.trim().split(".");
			var dbObject = _localData[this.__name__].data;
			for(var i = 0, ii = queryArr.length; i < ii; i++){
				if( dbObject[queryArr[i]] ){
					dbObject = dbObject[queryArr[i]];
				} else {
					return emit("error", "query path not found "+getterPath+" | Error occured at: "+queryArr[i]);
				}
			}

			return dbObject;
		},

		set: function(queryPath, value){
			if(typeof queryPath === "undefined") return;
			if(queryPath === null) return _localData[this.__name__].data = value;
			// console.log("queryPath:",queryPath);

			var queryArr = queryPath.trim().split(".");
			var dbObject = _localData[this.__name__].data;

			for(var i = 0, ii = queryArr.length; i < ii; i++){
				if( dbObject[queryArr[i]] ){
					if(i === queryArr.length-1){
						dbObject[queryArr[i]] = value;
						// emit(this.__name__+" set", this.get());
						triggerEmitter(this.__name__, "set", this.get());
						return;
					}
				} else {
					return emit("error", this.__name__+".set error  |  Query path not found: "+queryPath+"  |  Error occured at: "+queryArr[i]);
				}
				dbObject = dbObject[queryArr[i]];
			}
			
		},



		reset: function(queryPath, callback){
			var self = this;

			function getFilePath(Obj){
				if(_localData[Obj.__name__][isProperty]) return getFilePath(_localData[ _localData[Obj.__name__][propertyOf] ]);
				else return _localData[Obj.__name__][path];
			}

			fs.readFile(getFilePath(this), "utf-8", function(err, data){
				if(err) return emit("error", err);

				var jsonData = parseJson(data);
				if(!jsonData) return;

				if(typeof queryPath === "undefined" || queryPath === null) {
					if(!_localData[self.__name__][isProperty]) {
						_localData[self.__name__].data = jsonData;
					}
					else {
						self.set(null, getDataFromPath(jsonData, getParentPath(self)));
					}
					triggerEmitter(self.__name__, "reset", self.get());
					return (typeof callback === "function") ? callback() : undefined ;
				}	

				else if(typeof queryPath === "string") {
					var fullQueryPath = (_localData[self.__name__][isProperty]) ? getParentPath(self)+"."+queryPath : queryPath;
					getDataFromPath(jsonData, fullQueryPath, function(err, newData){
						if(err) return emit("error", "error message");
						self.set(queryPath, newData);
						triggerEmitter(self.__name__, "reset", self.get());
						return (typeof callback === "function") ? callback() : undefined ;
					});
				}

				else if(typeof queryPath !== "string"){
					return emit("error", self.__name__+".reset's first paramter only takes a paramter of type 'string', 'undefined', or 'null'. You passed a parameter of type '"+typeof queryPath+"'.");
				} 
				
			});
		},


		createProperty: function(propName, propPath, propConfig){
			if(typeof propName !== "string") return emit("error", "Property name (1st param) passed to "+this.__name__+".createProperty is not of type 'string'.");
			if(typeof propPath !== "string") return emit("error", "Query Path (2nd param) passed to "+this.__name__+".createProperty is not of type 'string'.");

			var queryArr = propPath.trim().split(".");
			var dbObject = _localData[this.__name__].data;
			for(var i = 0, ii = queryArr.length; i < ii; i++){
				if( dbObject[queryArr[i]] ){
					dbObject = dbObject[queryArr[i]];
				} else {
					return emit("error", "query path not found "+propPath);
				}
			}

			this[propName] = Object.create(dbMethods);
			this[propName].__name__ = propName;
			
			_localData[propName] = {
				data: dbObject,
				path : propPath,
				isProperty: true,
				propertyOf: this.__name__
			};

			this[propName].config(propConfig);

		},
		config: function(configObj){
			_localData[this.__name__].onSet = (configObj && typeof configObj.onSet === "string") 
				? configObj.onSet : _localData[this.__name__].onSet ;

			_localData[this.__name__].onReset = (configObj && typeof configObj.onReset === "string") 
				? configObj.onReset : _localData[this.__name__].onReset;
		}
	};
			


	var locaCoreMethods = {
		on: function(eventName, fn){
			_events[eventName] = _events[eventName] || [];
			_events[eventName].push(fn);
		},
		off: function(eventName, fn){
			if (_events[eventName]) {
				for (var i = 0; i < _events[eventName].length; i++) {
					if (_events[eventName][i] === fn) {
						_events[eventName].splice(i, 1);
						break;
					}
				};
			}
		},
		init: function(dbName, dbPath, dbConfig, callback){
			if(typeof this[dbName] === "undefined") {
				var self = this;

				fs.readFile(dbPath, "utf-8", function(err, data){
					if(err) return emit("error", err);

					var jsonData = parseJson(data);
					if(!jsonData) return;

					self[dbName] = Object.create(dbMethods);
					self[dbName].__name__ = dbName;

					_localData[dbName] = {
						data: jsonData,
						path : dbPath,
						isProperty: false,
						propertyOf: null,
					};

					self[dbName].config(dbConfig);

					emit("init "+dbName);
					if(typeof callback === "function") return callback();
				});

			} else {
				if(err) return emit("error", err);
			}

		}
	}
	return Object.create(locaCoreMethods);
})();

