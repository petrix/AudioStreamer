/**
 * Created by noamc on 8/31/14.
 */
const path = require('path');
var binaryServer = require('binaryjs').BinaryServer,
    https = require('https'),
    express = require('express'),
    // connect = require('connect'),
    wav = require('wav'),
    opener = require('opener'),
    fs = require('fs'),
    // serveStatic = require('serve-static'),
    CONFIG = require("../config.json");
//  lame = require('lame');
var PORT = process.env.PORT = 9191;

if (!fs.existsSync("recordings"))
    fs.mkdirSync("recordings");
var app = express();
var options = {
    key: fs.readFileSync('cert/key.pem'),
    cert: fs.readFileSync('cert/cert.pem'),
};

var server = https.createServer(options, app).listen(PORT);

// var app = connect();

app.use(function (req, res, next) {
    res.header('Cache-Control', 'private, no-cache, no-store, must-revalidate');
    res.header('Expires', '-1');
    res.header('Pragma', 'no-cache');
    next();
});
app.use('/', express.static('./public/'));
app.use(express.static(path.join(__dirname, './public/index.html')));
// app.use(serveStatic('public'));
app.get('/', function (req, res) {
    res.sendFile('./public/');
});


opener("https://localhost:" + PORT);

var server = binaryServer({
    server: server
});

server.on('connection', function (client) {
    console.log("new connection...");
    var fileWriter = null;
    var writeStream = null;

    client.on('stream', function (stream, meta) {

        console.log("Stream Start@" + meta.sampleRate + "Hz");
        console.log(meta);
        var fileName = "recordings/" + "_" + new Date().getTime();

        switch (CONFIG.AudioEncoding) {
            case "WAV":
                fileWriter = new wav.FileWriter(fileName + ".wav", {
                    channels: 1,
                    sampleRate: meta.sampleRate,
                    bitDepth: 16
                });
                stream.pipe(fileWriter);
                break;

                // case "MP3":
                //     writeStream = fs.createWriteStream( fileName + ".mp3" );
                //     stream.pipe( new lame.Encoder(
                //     {
                //         channels: 1, bitDepth: 16, sampleRate: meta.sampleRate, bitRate: 128, outSampleRate: 22050, mode: lame.MONO
                //     })
                //     )
                //     .pipe( writeStream );
                // break;
        };

    });


    client.on('close', function () {
        if (fileWriter != null) {
            fileWriter.end();
        } else if (writeStream != null) {
            writeStream.end();
        }
        console.log("Connection Closed");
    });
});