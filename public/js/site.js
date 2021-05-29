/**
 * Created by noamc on 8/31/14.
 */

(function () {
	var client,
		recorder,
		context,
		bStream,
		contextSampleRate = new AudioContext().sampleRate,
		resampleRate = contextSampleRate,
		worker;

	function initWorker() {
		worker = new Worker("js/worker/resampler-worker.js");

		worker.postMessage({ cmd: "init", from: contextSampleRate, to: resampleRate });

		worker.addEventListener(
			"message",
			function (e) {
				// console.log(e);
				if (bStream && bStream.writable) bStream.write(convertFloat32ToInt16(e.data.buffer));
			},
			false,
		);
	}

	document.querySelector("#start-rec-btn").addEventListener("click", function () {
		close();
		initWorker();
		client = new BinaryClient("wss://" + location.host);
		client.on("open", function () {
			bStream = client.createStream({ sampleRate: resampleRate });
		});

		if (context) {
			recorder.connect(context.destination);
			return;
		}

		var session = {
			audio: true,
			video: false,
		};

		navigator.getUserMedia(
			session,
			function (stream) {
				context = new AudioContext();
				var audioInput = context.createMediaStreamSource(stream);
				// var bufferSize = 0; // let implementation decide
				var bufferSize = 2 ** 11; // let implementation decide

				recorder = context.createScriptProcessor(bufferSize, 2, 2);

				recorder.onaudioprocess = onAudio;

				audioInput.connect(recorder);

				recorder.connect(context.destination);
			},
			function (e) {},
		);
	});

	function onAudio(e) {
		var left = e.inputBuffer.getChannelData(0);
		var right = e.inputBuffer.getChannelData(1);

		worker.postMessage({ cmd: "resample", buffer: left });
		worker.postMessage({ cmd: "resample", buffer: right });

		drawBuffer(left, "left");
		drawBuffer(right, "right");
	}

	function convertFloat32ToInt16(buffer) {
		var l = buffer.length;
		var buf = new Int16Array(l);
		while (l--) {
			buf[l] = Math.min(1, buffer[l]) * 0x7fff;
		}
		return buf.buffer;
	}

	function drawBuffer(data, channel) {
		var canvasLeft = document.getElementById("canvasChLeft");
		var canvasRight = document.getElementById("canvasChRight");
		channel == "left" ? rndrCtx(canvasLeft, data) : rndrCtx(canvasRight, data);
		function rndrCtx(layer, arr) {
			var ctx = layer.getContext("2d"),
				width = layer.width,
				height = layer.height;
			ctx.clearRect(0, 0, width, height);
			var step = Math.ceil(arr.length / width);
			var amp = height / 2;
			// console.log("step", step, "amp", amp);
			for (var i = 0; i < width; i++) {
				var min = 1.0;
				var max = -1.0;
				for (var j = 0; j < step; j++) {
					var datum = arr[i * step + j];
					if (datum < min) min = datum;
					if (datum > max) max = datum;
				}
				// var txtToPrint = "DIAGRAM";
				var txtToPrint = width;
				var chnlWidth = ctx.measureText(txtToPrint).width;
				ctx.font = "20px sans-serif";
				ctx.fillText(arr.length + " - " + width + " / " + height, 0, height / 2);
				ctx.fillText(txtToPrint, width - chnlWidth, height / 2);
				ctx.fillRect(i, (1 + min) * amp, 2, Math.max(1, (max - min) * amp));
			}
			return ctx.canvas;
		}
	}

	document.querySelector("#stop-rec-btn").addEventListener("click", function () {
		close();
	});

	function close() {
		console.log("close");
		if (recorder) recorder.disconnect();
		if (client) client.close();
		if (worker) worker.terminate();
	}
})();

navigator.getUserMedia = navigator.getUserMedia || navigator.webkitGetUserMedia || navigator.mozGetUserMedia || navigator.msGetUserMedia;
