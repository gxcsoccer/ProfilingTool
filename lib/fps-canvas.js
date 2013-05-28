// D3.js-based FPS Counter
//-------------------------------------
// Avoids SVG for HTML5 Canvas (http://bl.ocks.org/syntagmatic/2409451)

var fpscanvas = {
	frameStartTime : (new Date()).getTime(),
	frameInFrame   : false,

	frameTimeData : [],
	chartWidth    : 1280,
	chartHeight   :   72,
	chartMaxY     :   50,
	chartMinX     :  -10 * 1000,

	frameTimeChart : null,
	xAxis : null,
	yAxis : null,

	clearFrameTimeData: function() {
		fpscanvas.frameStartTime = (new Date()).getTime()
		fpscanvas.frameInFrame   = false
		fpscanvas.frameTimeData  = []
	},
	markEndOfFrames: function() {
		fpscanvas.frameInFrame = false
	},

	createFrameTimeChart: function() {
		fpscanvas.frameTimeChart = document.getElementById('frameTimeChart')
		fpscanvas.frameTimeChart.setAttribute("style",
			"position: absolute; " +
			"top: 0px; left: 0px; " +
			"z-index: 2000; " +
			"background: #000; " +
			"width: "  + fpscanvas.chartWidth  + "px; " +
			"height: " + fpscanvas.chartHeight + "px; ");

		// create and add data to the chart
		var chartCanvas = document.getElementById('chartCanvas')
		chartCanvas.setAttribute( "width", ''+fpscanvas.chartWidth+'px')
		chartCanvas.setAttribute("height", ''+fpscanvas.chartHeight+'px')

		// add initial, uncalibrated plotline
		var vis = chartCanvas.getContext("2d")
		vis.strokeStyle = "rgba(0,180,255,1.00)"
		vis.lineWidth = 3

		fpscanvas.redrawChart()

		return fpscanvas.frameTimeChart
	},
	markNewFrame: function() {
		if (fpscanvas.frameInFrame) {
			var frameEndTime = (new Date()).getTime()

			if (fpscanvas.frameTimeData.length > 1000)
				fpscanvas.frameTimeData.shift()

			fpscanvas.frameTimeData.push(
				{timestamp: frameEndTime, frameTime: frameEndTime - fpscanvas.frameStartTime}
			)
		}

		fpscanvas.frameInFrame = true
		fpscanvas.frameStartTime = (new Date()).getTime()
	},
	addFrameInfo: function(frameCount, elapsedTime) {
		//console.log("addFrameInfo: " + frameCount + "x " + elapsedTime + " msec")
	
		if (frameCount <= 0)
			return;

		if (fpscanvas.frameTimeData.length > 1000)
			fpscanvas.frameTimeData.shift()

		// ignore the fact that we may be parsing multiple frames
		fpscanvas.frameTimeData.push(
			{timestamp: (new Date()).getTime(), frameTime: elapsedTime}
		)

		fpscanvas.frameInFrame = true
		fpscanvas.frameStartTime = (new Date()).getTime()
	},
	redrawChart: function() {
		var vis = document.getElementById('chartCanvas').getContext('2d')

		// find current average FPS, and use average to scale chart
		fpscanvas.chartMaxY = fpscanvas.getAverageFps((new Date()).getTime() - 3000, (new Date()).getTime()) * 1.7
		if (fpscanvas.chartMaxY < 1) {
			fpscanvas.chartMaxY = fpscanvas.getFps() * 1.7
		}
		if (fpscanvas.chartMaxY < 1) {
			fpscanvas.chartMaxY = 50 * 1.7
		}
		if (fpscanvas.chartMaxY < 27) {
			fpscanvas.chartMaxY = 27
		}

		// set axis scaling for chart
		var xAxisEnd = (new Date()).getTime()
		var xAxis = d3.scale.linear()
			.domain([xAxisEnd + fpscanvas.chartMinX, xAxisEnd])
			.range([0, fpscanvas.chartWidth]);
		var yAxis = d3.scale.linear()
			.domain([0, fpscanvas.chartMaxY])
			.range([fpscanvas.chartHeight, 0]);

		// clear the backdrop, according to "goodness" of FPS
		//------------------------------------------------------------------
		// black by default
		vis.clearRect(0, 0, fpscanvas.chartWidth+1, fpscanvas.chartHeight+1)
		vis.textBaseline = "middle"
		vis.font = "bold 12px sans-serif"

		// clear the bottom half to red, indicating "dangerous" framerate
		// - as estimate of "choppiness", use 50 Hz (PAL frequency) over 2
		if (yAxis(25) < fpscanvas.chartHeight) {
			vis.fillStyle = "#400000"
			vis.fillRect(0, yAxis(25), fpscanvas.chartWidth+1, fpscanvas.chartHeight+1)

			vis.fillStyle = "#F00"
			vis.fillText("--- 25 FPS ---", 0, yAxis(25))
		}

		// clear the top part to green, indicating "good" framerate
		// - use 50 Hz, since that's the highest likely screen refresh
		// - Chrome and its decoupled rendering pipeline will throw this for a loop
		if (yAxis(50) > 0) {
			vis.fillStyle = "#004000"
			vis.fillRect(0, 0, fpscanvas.chartWidth+1, yAxis(50))

			vis.fillStyle = "#0f0"
			vis.fillText("--- 50 FPS ---", 0, yAxis(50))
		}

		// draw ticks and FPS along X axis
		//------------------------------------------------------------------
		for (var x = xAxisEnd; x > fpscanvas.chartMinX + xAxisEnd; x -= 1000) {
			var xLeft  = x;
			var xRight = x + 1000;

			vis.textBaseline = ('bottom')
			vis.fillStyle = "#fff"
			vis.fillText("|", xAxis(xLeft) - 4, fpscanvas.chartHeight)
			vis.textBaseline = ('bottom')
			vis.fillStyle = "#fff"
			vis.textAlign = "center"
			vis.fillText(
				"" + fpscanvas.getAverageFps(xLeft, xRight).toFixed(2) + " FPS",
				(xAxis(xLeft) + xAxis(xRight))/2,
				fpscanvas.chartHeight)
			vis.textAlign = "left"
		}

		// draw data (plot line)
		vis.beginPath();
		var firstPoint = fpscanvas.frameTimeData[0]
		if (firstPoint) {
			vis.moveTo(xAxis(firstPoint.timestamp), yAxis(1000/firstPoint.frameTime))
			fpscanvas.frameTimeData.map(function(p,i) {
				// TODO: if time delta is very different, draw horizontal line to new point
				vis.lineTo(xAxis(p.timestamp), yAxis(1000/p.frameTime));
			})
		}
		vis.stroke()
		
		// prune points that are older than start of chart
		while(fpscanvas.frameTimeData.length > 0) {
			var headPoint = fpscanvas.frameTimeData[0]
			if (headPoint.timestamp <= xAxisEnd + fpscanvas.chartMinX) {
				fpscanvas.frameTimeData.shift()
			}
			else {
				break;
			}
		}
	},
	getAverageFps: function(startTime, endTime) {
		var frameTimeSum   = 0
		var frameTimeCount = 0

		for (var index = 0; index < fpscanvas.frameTimeData.length; ++index) {
			if (fpscanvas.frameTimeData[index].timestamp <= startTime)
				continue;
			if (fpscanvas.frameTimeData[index].timestamp > endTime)
				break;

			frameTimeSum += fpscanvas.frameTimeData[index].frameTime;
			frameTimeCount += 1
		}

		if (frameTimeCount <= 0)
			return 0;

		return 1000.0 / ( frameTimeSum / frameTimeCount );
	},
	getFps: function() {
		return fpscanvas.getAverageFps(0, (new Date()).getTime());
	},

	// run at most 2x per second
	timerId: 0,
	updateInterval: 500,
	installIntervalTimer: function() {
		timerId = setInterval(function() {
			fpscanvas.redrawChart()
		}, fpscanvas.updateInterval);
	},
	removeIntervalTimer: function() {
		clearInterval(timerId)
		timerId = 0
	},

};



// fpsmeter.js
//--------------------------------------------------
// Copyright (c) 2012 David Corvoysier http://www.kaizou.org
//
// Permission is hereby granted, free of charge, to any person obtaining a copy
// of this software and associated documentation files (the "Software"), to deal
// in the Software without restriction, including without limitation the rights
// to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
// copies of the Software, and to permit persons to whom the Software is
// furnished to do so, subject to the following conditions:
//
// The above copyright notice and this permission notice shall be included in
// all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
// IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
// FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
// AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
// LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
// OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
// SOFTWARE.

// fpsmeter.js

(function(){

// We need to verify that CSS transitions are supported
var dummy = document.createElement('dummy');

var transEndEventNames = {
    'WebkitTransition' : 'webkitTransitionEnd',
    'MozTransition'    : 'transitionend',
    'OTransition'      : 'oTransitionEnd',
    'msTransition'     : 'MSTransitionEnd',
    'transition'       : 'transitionend'
};

var transitionPropertyName = null;
var transitionEventName = null;

for ( var prop in transEndEventNames ) {
    if(dummy.style[prop]!==undefined){
        transitionPropertyName = prop;
        transitionEventName = transEndEventNames[prop];
    }
}
if(!transitionPropertyName){
    return;
}

// Use this to remmeber what method we use to calculate fps
var method = 'raf';

var requestAnimationFrame = null;
var cancelAnimationFrame = null;
// requestAnimationFrame polyfill by Erik Möller
// http://my.opera.com/emoller/blog/2011/12/20/requestanimationframe-for-smart-er-animating
(function() {
    var lastTime = 0;
    var vendors = ['ms', 'moz', 'webkit', 'o'];
    for(var x = 0; x < vendors.length && !requestAnimationFrame; ++x) {
        requestAnimationFrame = window[vendors[x]+'RequestAnimationFrame'];
        cancelAnimationFrame = 
          window[vendors[x]+'CancelAnimationFrame'] || window[vendors[x]+'CancelRequestAnimationFrame'];
    }
 
    if (!requestAnimationFrame)
        requestAnimationFrame = function(callback, element) {
            method = 'js';
            var currTime = new Date().getTime();
            // 16 ms is for a 60fps target
            var timeToCall = Math.max(0, 16 - (currTime - lastTime));
            var id = window.setTimeout(function() { callback(currTime + timeToCall); }, 
              timeToCall);
            lastTime = currTime + timeToCall;
            return id;
        };
 
    if (!cancelAnimationFrame)
        cancelAnimationFrame = function(id) {
            clearTimeout(id);
        };
}());

var ref = null;
var values = null;
var startTime = null;
var frameID = null;

var self = window.FPSMeter = {
    run : function(rate) {
        self.rate = rate ? rate : 1;
        if(document.readyState === 'complete') {
            var startIteration = function() {
                values = new Array();
                // Remember when we started the iteration
                startTime = new Date().getTime();
                if (ref.style.left == "0px") {
                    ref.style.left = self.bodyWidth + "px";
                } else {
                    ref.style.left = "0px";
                }
                if (window.mozPaintCount != undefined) {
                    method = 'native';
                    // Remember how many paints we had
                    frameID = window.mozPaintCount;
                } else {
                    // Define a function to repeatedly store reference
                    // x positions 
                    var storeValue = function () {
                        frameID = requestAnimationFrame(storeValue);
                        var l = GetFloatValueOfAttr(ref, 'left');
                        if(l){
                            values.push(l);
                        }
                    };
                    // Start storing positions right now
                    storeValue();
                }
            };
            if(!ref) {
                self.bodyWidth = GetFloatValueOfAttr(document.body,'width');
                ref = document.createElement("div");
                ref.setAttribute("id", "AnimBenchRef");
                ref.style['position'] = 'absolute';
                ref.style['backgroundColor'] = 'transparent';
                ref.style['width'] = '1px';
                ref.style['height'] = '1px';
                ref.style['left'] = '0px';
                ref.style['bottom'] = '0px';
                ref.style[transitionPropertyName] = 'all ' + self.rate + 's linear';
                var bodyRef = document.getElementsByTagName("body").item(0);
                bodyRef.appendChild(ref);
                ref.addEventListener(transitionEventName,
                    function (evt) {
                        var frames = 0;
                        var elapsed = (new Date().getTime()) - startTime;
                        if (window.mozPaintCount != undefined) {
                            // We just count the number of paints that
                            // occured during the last iteration
                            frames = window.mozPaintCount - frameID;
                        } else {
                            // We will look at reference x positions 
                            // stored during the last iteration and remove 
                            // duplicates                        
                            cancelAnimationFrame(frameID);
                            var duplicates = 0;
                            var current = -1;
                            for (var i = 0; i < values.length; i++) {
                                var l = values[i];
                                if (l == current) {
                                    duplicates++;
                                } else {
                                    current = l;
                                }
                            }
                            frames = values.length - duplicates;
                        }

                        startIteration();

						fpscanvas.addFrameInfo(frames, elapsed)
                    },
                    false);
            }
            setTimeout(
                function (evt) {
                    startIteration();
                },
                10);
        } else {
            setTimeout(
                function (evt) {
                    self.run(rate);
                },
                10);
        }
    },
    stop : function() {
        cancelAnimationFrame(frameID);
        frameID = null;
        var bodyRef = document.getElementsByTagName("body").item(0);
        bodyRef.removeChild(ref);
        ref = null;
    }
}

function GetFloatValueOfAttr (element,attr) {
    var floatValue = null;
    if (window.getComputedStyle) {
        var compStyle = window.getComputedStyle (element, null);
        try {
            var value = compStyle.getPropertyCSSValue (attr);
            var valueType = value.primitiveType;
            switch (valueType) {
              case CSSPrimitiveValue.CSS_NUMBER:
                  floatValue = value.getFloatValue (CSSPrimitiveValue.CSS_NUMBER);
                  break;
              case CSSPrimitiveValue.CSS_PERCENTAGE:
                  floatValue = value.getFloatValue (CSSPrimitiveValue.CSS_PERCENTAGE);
                  alert ("The value of the width property: " + floatValue + "%");
                  break;
              default:
                  if (CSSPrimitiveValue.CSS_EMS <= valueType && valueType <= CSSPrimitiveValue.CSS_DIMENSION) {
                      floatValue = value.getFloatValue (CSSPrimitiveValue.CSS_PX);
                  }
            }
        } 
        catch (e) {
          // Opera doesn't support the getPropertyCSSValue method
          stringValue = compStyle[attr];
          floatValue = stringValue.substring(0, stringValue.length - 2);
        }
    }
    return floatValue;
}

})();