var https = require("https");
var url = require("url");
var image = [];

function cognitive_repository(context, event) {
	var body_string = null;
	var request = https.request({
		host: url.parse(process.env.COGNITIVE_URL).host,
		path: url.parse(process.env.COGNITIVE_URL).path,
		method: 'POST',
		headers: {
			'Content-Type': 'application/octet-stream',
			'Ocp-Apim-Subscription-Key': process.env.COGNITIVE_KEY
		}
	}, function (response) {
		response.setEncoding('utf8');
		response.on('data', function (chunk) {
			body_string = chunk;
		});
		response.on('end', function () {
			if (response.statusCode != 200) {
				body_string = "Cognitive Error."
			} else {
				body_string = parse_ocr(body_string);
			}
			push_line_message_repository(context, event, body_string);
		});
	});
	request.write(image);
	request.end();
}

function parse_ocr(request) {
	var object = JSON.parse(request);
	var response = "";
	Object.keys(object.regions[0].lines).forEach(function (key) {
		var line = object.regions[0].lines[key];
		Object.keys(line.words).forEach(function (key) {
			response += line.words[key].text;
		});
		response += "\n";
	});
	return response;
}

function push_line_message_repository(context, event, message) {
	var parse_url = url.parse(process.env.LINE_REPLY_URL);
	var post_req = https.request({
		host: parse_url.host,
		path: parse_url.path,
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
			'Authorization': 'Bearer {' + process.env.LINE_CHANNEL_ACCESS_TOKEN + '}'
		}
	});
	post_req.write(JSON.stringify({
		"replyToken": event.replyToken,
		"messages": [{
			"type": "text",
			"id": event.message.id,
			"text": message
		}]
	}));
	post_req.end();
}

function get_line_image_repository(context, event) {
	var buf = "";
	var req = https.request({
		host: url.parse(process.env.LINE_IMAGE_URL + "/" + event.message.id + "/content").host,
		path: url.parse(process.env.LINE_IMAGE_URL + "/" + event.message.id + "/content").path,
		method: "GET",
		headers: {
			"Authorization": "Bearer {" + process.env.LINE_CHANNEL_ACCESS_TOKEN + "}"
		}
	}, function (res) {
		res.setEncoding('binary');
		var data = [];
		res.on('data', function (chunk) {
			data.push(new Buffer(chunk, 'binary'));
		});
		res.on('end', function () {
			image = Buffer.concat(data);
            cognitive_repository(context, event);
		});
	});
	req.end();
}

function ocr_service(context, event) {
	if (event.message.type == "image") {
		get_line_image_repository(context, event);
//		cognitive_repository(context, event);
	} else {
		push_line_message_repository(context, event, "Please post again with an image file.");
	}
}
module.exports = function (context, myQueueItem) {
	myQueueItem.events.forEach(event => ocr_service(context, event));
	context.done();
};