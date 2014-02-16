// geom.js - v0.1 - http://chrisnichols.ca
//
// Copyright (c) 2014 Chris Nichols
// All rights reserved.
//

/*global window */
/*global document */

// General drawing variables
var gCanvasElement;
var gDrawingContext;
var gWidth;
var gHeight;

// Geometry variables
var gPoints = [];
var gPointRadius = 4.0;

var gMinDisc;

//----------------------------------------------------------------------------------------
// Comparison Functions
//----------------------------------------------------------------------------------------
function tolerablyEqual(a, b) {
    'use strict';

    // Poor implementation of tolerably equal. We assume that all values are on
    // the same order of magnitude and not very big or small (i.e. we won't
    // encounter any funny floating point or catastrophic cancellation issues)
    //
    return Math.abs(a - b) <= 0.00001;
}

function lessThanOrTolerablyEqual(a, b) {
    'use strict';

    return (a < b) || tolerablyEqual(a, b);
}

//----------------------------------------------------------------------------------------
// Utility Functions
//----------------------------------------------------------------------------------------

function randomIndexLessThan(upperLimit) {
    'use strict';

    return Math.floor((Math.random() * upperLimit));
}

function randomPermutation(elements) {
    'use strict';

    var randomElements,
        i,
        j,
        temp;

    randomElements = elements.slice();

    for (i = randomElements.length - 1; i > 0; i -= 1) {

        j = randomIndexLessThan(i);
        temp = randomElements[i];
        randomElements[i] = randomElements[j];
        randomElements[j] = temp;
    }

    return randomElements;
}

//----------------------------------------------------------------------------------------
// General Geometry Functions
//----------------------------------------------------------------------------------------

function distance(p1, p2) {
    'use strict';

    var deltaX = p1[0] - p2[0],
        deltaY = p1[1] - p2[1];

    return Math.sqrt(deltaX * deltaX + deltaY * deltaY);
}

function twoPointDisc(p1, p2) {
    'use strict';

    var center = [(p1[0] + p2[0]) / 2.0, (p1[1] + p2[1]) / 2.0],
        radius = distance(center, p1);

    return [center, radius];
}

function threePointDisc(p1, p2, p3) {
    'use strict';

    // See http://en.wikipedia.org/wiki/Circumscribed_circle#Cartesian_coordinates
    // Didn't feel like working through the equations.
    var D = 2.0 * (p1[0] * (p2[1] - p3[1]) + p2[0] * (p3[1] - p1[1]) + p3[0] * (p1[1] - p2[1])),
        x = ((Math.pow(p1[0], 2) + Math.pow(p1[1], 2)) * (p2[1] - p3[1]) + (Math.pow(p2[0], 2) + Math.pow(p2[1], 2)) * (p3[1] - p1[1]) + (Math.pow(p3[0], 2) + Math.pow(p3[1], 2)) * (p1[1] - p2[1])) / D,
        y = ((Math.pow(p1[0], 2) + Math.pow(p1[1], 2)) * (p3[0] - p2[0]) + (Math.pow(p2[0], 2) + Math.pow(p2[1], 2)) * (p1[0] - p3[0]) + (Math.pow(p3[0], 2) + Math.pow(p3[1], 2)) * (p2[0] - p1[0])) / D,
        center = [x, y],
        radius = distance(center, p1);

    return [center, radius];
}

function pointInDisc(p, disc) {
    'use strict';

    return lessThanOrTolerablyEqual(distance(disc[0], p), disc[1]);
}

//----------------------------------------------------------------------------------------
// Minimum Enclosing Disc
//----------------------------------------------------------------------------------------

function minimumDiscWith2Points(points, p, q) {
    'use strict';

    var minDisc,
        i;

    minDisc = twoPointDisc(p, q);

    for (i = 0; i < points.length; i += 1) {
        if (!pointInDisc(points[i], minDisc)) {
            minDisc = threePointDisc(points[i], p, q);
        }
    }

    return minDisc;
}

function minimumDiscWithPoint(points, p) {
    'use strict';

    var minDisc,
        i;

    minDisc = twoPointDisc(points[0], p);

    for (i = 1; i < points.length; i += 1) {
        if (!pointInDisc(points[i], minDisc)) {
            minDisc = minimumDiscWith2Points(points.slice(0, i), points[i], p);
        }
    }

    return minDisc;
}

function minimumDisc(points) {
    'use strict';

    var randomPoints,
        minDisc = null,
        i;

    if (points && points.length >= 2) {
        randomPoints = randomPermutation(points);

        minDisc = twoPointDisc(randomPoints[0], randomPoints[1]);

        for (i = 2; i < randomPoints.length; i += 1) {
            if (!pointInDisc(randomPoints[i], minDisc)) {
                minDisc = minimumDiscWithPoint(randomPoints.slice(0, i), randomPoints[i]);
            }
        }
    }

    return minDisc;
}

//----------------------------------------------------------------------------------------
// UI Functions
//----------------------------------------------------------------------------------------

function resize() {
    'use strict';

    // Update the size of the canvas so that it fills the screen
    //
    gWidth = window.innerWidth;
    gHeight = window.innerHeight;

    gCanvasElement.width = gWidth;
    gCanvasElement.height = gHeight;
}

function drawPoint(point) {
    'use strict';

    // Draw a single point as a filled circle at the point coordinates
    //
    gDrawingContext.beginPath();
    gDrawingContext.arc(point[0], point[1], gPointRadius, 0, 2 * Math.PI, false);
    gDrawingContext.closePath();
    gDrawingContext.strokeStyle = 'black';
    gDrawingContext.stroke();
    gDrawingContext.fillStyle = 'black';
    gDrawingContext.fill();

}

function drawCircle(circle) {
    'use strict';

    var x = circle[0][0],
        y = circle[0][1],
        r = circle[1];

    // Draw a single point as a filled circle at the point coordinates
    //
    gDrawingContext.beginPath();
    gDrawingContext.arc(x, y, r, 0, 2 * Math.PI, false);
    gDrawingContext.closePath();
    gDrawingContext.strokeStyle = 'black';
    gDrawingContext.stroke();
}

function draw() {
    'use strict';

    var i;

    resize();

    // Draw all of the points clicked by the user
    //
    for (i = 0; i < gPoints.length; i += 1) {
        drawPoint(gPoints[i]);
    }

    // Draw the minimum enclosing disc (if it exists)
    //
    if (gMinDisc) {
        drawCircle(gMinDisc);
    }
}

function getClickedPoint(e) {
    'use strict';

    var x, y;

    if (e.pageX !== undefined && e.pageY !== undefined) {
	    x = e.pageX;
	    y = e.pageY;
    } else {
	    x = e.clientX + document.body.scrollLeft + document.documentElement.scrollLeft;
	    y = e.clientY + document.body.scrollTop + document.documentElement.scrollTop;
    }

    x -= gCanvasElement.offsetLeft;
    y -= gCanvasElement.offsetTop;

    return [x, y];
}

function onClick(e) {
    'use strict';

    // Find the clicked point in the list of points(if it exists)
    //
    var clickedPoint = getClickedPoint(e),
        tolerance = 2 * gPointRadius,
        pointIndex = -1,
        i,
        curPoint;

    for (i = 0; i < gPoints.length; i += 1) {
        curPoint = [gPoints[i][0], gPoints[i][1]];

        if (distance(curPoint, clickedPoint) <= tolerance) {
            pointIndex = i;
            break;
        }
    }

    if (pointIndex !== -1) {
        // Find the point under the cursor (if any) and remove it from the list
        //
        gPoints.splice(i, 1);
    } else {
        // Add a new point under the cursor (scaled to [0,1])
        //
        gPoints.push(clickedPoint);
    }

    // Update computed geometry information (smallest enclosing disc, Delaunay
    // triangulation, or convex hull for example). These should involve calls out to
    // other javascript files which should be in a github repository.
    //
    gMinDisc = minimumDisc(gPoints);

    draw();
}

function init() {
    'use strict';

    // Initialize the drawing variables
    //
    gCanvasElement = document.getElementById("canvas");
    gCanvasElement.addEventListener("click", onClick, false);
    window.addEventListener("deviceorientation", draw(), false);
    gDrawingContext = gCanvasElement.getContext("2d");

    var isTouchDevice = window.hasOwnProperty('ontouchstart');
    if (isTouchDevice) {
        // Use a bigger point radius for touch screens as fingers are big and clumsy
        //
        gPointRadius = 20.0;
    }

    // Size the canvas
    //
    draw();
}
