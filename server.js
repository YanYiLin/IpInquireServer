/*
 * IP query, with follow parameters
 * no parameters return current request client IP
 * id=XXX, register ip with identify, return remote IP
 * q=XXX, query ip with id(XXX), query all ip with q="*"
 * t=detail, query ip detail with id, query all detail with q="*"
 * 
 * Example:
 * Register - http://ip.zskit.com?id=abc
 * Query with id - http://ip.zskit.com?q=abc
 * Query quick list - http://ip.zskit.com?q=*
 * Query detail list - http://ip.zskit.com?q=**
 * Query detail with id - http://ip.zskit.com?q=abc&t=detail
 * Query all detail - http://ip.zskit.com?q=*&t=detail
 */


var HTTP = require("http");
var URL = require("url");
var FS = require('fs');


var CONFIG = {
	"host": process.env.OPENSHIFT_NODEJS_IP,
	"port": process.env.OPENSHIFT_NODEJS_PORT||8080,
	"size": 10		// Detail information size
};
var DEFID	= "Anonymous";
var GUEST	= {};			// Guest list, key="%IP%" value="%ID%"
var CACHE	= "";			// Guest list cache
var DETAIL	= {};			// Detail information, key="%ID%" value={last:"%ip%",%ip%:[{port:"%PORT%",date:"%DATE%",method:"%METHOD%"}],mbuf:""}
var CTTEXT	= "text/plain";
var INVALID = "Invalid path!";
var FAVICON = null;


// Load favicon file to memory
FAVICON = FS.readFileSync("./fav.ico");


/**
 * Save detail information to DETAIL
 * @param {String} ip
 * @param {String} id
 * @param {http.IncomingMessage} req
 */
function saveDetail( ip, id, req ) {
	if ( id === "*" ) {
		return;
	}
	var s = req.socket, h = req.headers;
	var detail = DETAIL[id]||{"mbuf":CONFIG.size};
	var infs = detail[ip]||[];
	var info = {
		"method": req.method,
		"port": h["x-forwarded-port"]||h["X-Forwarded-Port"]||s.remotePort,
		"lip": s.localAddress,
		"lport": s.localPort,
		"date": new Date()
	};
	infs.push( info );
	if ( infs.length > detail.mbuf ) {
		infs.shift();
	}
	detail[ip] = infs;
	detail.last = ip;
	DETAIL[id] = detail;
}

/**
 * Query last ip with id
 * @param {String} id
 * @return {String} 
 */
function queryId( id ) {
	var c = "";
	if ( id==="*" ) {
		c = CACHE;
	} else if ( id==="**" ) {
		var l = {};
		for( var i in DETAIL ) {
			l[i] = DETAIL[i].last;
		}
		c = JSON.stringify( l );
	} else {
		var d = DETAIL[id];
		if ( d ) {
			c = d.last;
		}
	}
	return c;
}

/**
 * Query detail with id
 * @param {String} id
 * @return {String} 
 */
function queryDetail( id ) {
	var c = "";
	var d = (id==="*")?DETAIL:DETAIL[id];
	if ( d ) {
		c = JSON.stringify( d );
	}
	return c;
}

function requestFovicon( res ) {
	res.writeHead( 200, {
		"Content-Length": FAVICON.length,
		"Content-Type": "image/x-icon"
	} );
	res.write( FAVICON );
	res.end();
}

function requestInvalid( res ) {
	res.writeHead( 403, {
		"Content-Length": INVALID.length,
		"Content-Type": CTTEXT
	} );
	res.write( INVALID );
	res.end();
}

/**
 * Create HTTP Server
 */
HTTP.createServer( function( req, res ) {
	var path=null,args=null;
	if ( req.method === "GET" ) {
		var url = URL.parse( req.url, true );
		path = url.pathname;
		args = url.query;
	} else {
		
	}
	
	// Path
	switch ( path ) {
		case "/favicon.ico":
		requestFovicon(res);
		return;
		case "/":
		break;
		default:
		requestInvalid(res);
		return;
	}

	// Save data to memory
	var id=null,q=null,t=null,r=null;
	if ( args ) {
		id = args.id;
		q = args.q;
		t = args.t;
		r = args.r;
	}
	var ip = req.headers["x-forwarded-for"]||req.headers["X-Forwarded-For"]||req.socket.remoteAddress;
	if ( id ) {
		saveDetail( ip, id, req );
	} else {
		id = DEFID;
	}
	if ( GUEST[ip] != id ) {
		GUEST[ip] = id;
		CACHE = JSON.stringify( GUEST );
	}
	
	// Update query data
	var ret = ip;
	if ( q ) {
		ret = (t==="detail")?queryDetail(q):queryId(q);
	}

	// Set response data
	res.writeHead( 200, {
		"Content-Length": ret.length,
		"Content-Type": CTTEXT
	} );
	res.write( ret );
	res.end();
	
} ).listen( CONFIG.port, CONFIG.host );
