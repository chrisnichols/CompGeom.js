// geom.js - v0.1 - http://chrisnichols.ca
//
// Copyright (c) 2014 Chris Nichols
// All rights reserved.
//

/*global window */
/*global document */
/*global localStorage */

// Configuration Variables
var gSupportsStorage = false;

// General drawing variables
var gCanvasElement;
var gDrawingContext;
var gWidth;
var gHeight;

// Geometry variables
var gPoints = [];
var gPointRadius = 4.0;

var Algorithm = {
    MIN_DISC : 0,
    CONVEX_HULL : 1,
    NUM_ALGORITHMS : 2
};

var TurnDirection = {
    RIGHT_TURN : -1,
    NO_TURN : 0,
    LEFT_TURN : 1
};

var gCurrentAlgorithm;

var gMinDisc = null;
var gConvexHull = null;

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

function randomIntLessThan(upperLimit) {
    'use strict';

    return Math.floor((Math.random() * upperLimit));
}

function randomPermutation(elements) {
    'use strict';

    var randomElements = elements.slice(),
        i,
        j,
        temp;

    for (i = randomElements.length - 1; i > 0; i -= 1) {

        j = randomIntLessThan(i);
        temp = randomElements[i];
        randomElements[i] = randomElements[j];
        randomElements[j] = temp;
    }

    return randomElements;
}

function comparePoints(a, b) {
    'use strict';
    
    if (a[0] !== b[0]) {
        return a[0] - b[0];
    } else {
        return a[1] - b[1];
    }
}

function lexicographicOrder(points) {
    'use strict';
    
    var orderedPoints = points.slice(0);
    
    orderedPoints.sort(comparePoints);
    
    return orderedPoints;
}

function concat(a, b) {
    'use strict';
    
    var result = null,
        i;
    
    if (a && b) {
        result = a.slice();
        
        for (i = 0; i < b.length; i += 1) {
            result.push(b[i]);
        }
    }
    
    return result;
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

function turnDirection(p1, p2, p3) {
    'use strict';
    
    // The sign of the z-value of the cross product of the vectors (p2 -> p1) and
    // (p2 -> p3) indicates the direction of the turn. As we are using a left-handed
    // system, :
    //      positive -> left turn
    //      zero -> no turn
    //      negative -> right turn
    //
    
    var z = (p1[0] - p2[0]) * (p3[1] - p2[1]) - (p1[1] - p2[1]) * (p3[0] - p2[0]);
    
    if (tolerablyEqual(z, 0.0)) {
        return TurnDirection.NO_TURN;
    } else if (lessThanOrTolerablyEqual(z, 0.0)) {
        return TurnDirection.RIGHT_TURN;
    } else {
        return TurnDirection.LEFT_TURN;
    }
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
    //
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
// Convex Hull
//----------------------------------------------------------------------------------------

function halfConvexHull(points) {
    'use strict';
    
    var halfHull = [],
        i,
        n;
    
    
    halfHull.push(points[0]);
    halfHull.push(points[1]);

    for (i = 2; i < points.length; i += 1) {
        halfHull.push(points[i]);

        n = halfHull.length;
        while (n > 2 && turnDirection(halfHull[n - 3], halfHull[n - 2], halfHull[n - 1]) !== TurnDirection.RIGHT_TURN) {
            // Remove the middle of the last 3 points
            //
            halfHull.splice(n - 2, 1);

            n = halfHull.length;
        }
    }
    
    return halfHull;
}

function convexHull(points) {
    'use strict';
    
    var hull = null,
        upperHull = [],
        lowerHull = [],
        orderedPoints;
    
    if (points && points.length > 2) {
        // Compute the upper convex hull
        //
        orderedPoints = lexicographicOrder(points);
        upperHull = halfConvexHull(orderedPoints);
        
        // Compute the lower convex hull
        //
        orderedPoints.reverse();
        lowerHull = halfConvexHull(orderedPoints);
        
        // Combine the upper and lower vertices into a single convex hull (ignore the
        // first point as this is the last point of the upper hull)
        //
        hull = upperHull;
        lowerHull.splice(0, 1);
        hull = concat(upperHull, lowerHull);
    }

    return hull;
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

function drawLine(start, end) {
    'use strict';
    
    // Draw a line connecting the start and end points
    //
    gDrawingContext.beginPath();
    gDrawingContext.moveTo(start[0], start[1]);
    gDrawingContext.lineTo(end[0], end[1]);
    gDrawingContext.strokeStyle = 'black';
    gDrawingContext.stroke();
}

function drawPolyLine(vertices) {
    'use strict';
    
    var i;
    
    for (i = 0; i < vertices.length - 1; i += 1) {
        drawLine(vertices[i], vertices[i + 1]);
    }
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
    
    // Draw the convex hull (if it exists)
    //
    if (gConvexHull) {
        drawPolyLine(gConvexHull);
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

function updatePointSet(clickedPoint) {
    'use strict';
    
    var tolerance = 2 * gPointRadius,
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
    
    if (gSupportsStorage) {
        localStorage.setItem('points', JSON.stringify(gPoints));
    }
}

function updateDerivedGeometry() {
    'use strict';
    
    // Update computed geometry information (smallest enclosing disc, Delaunay
    // triangulation, or convex hull for example). These should involve calls out to
    // other javascript files which should be in a github repository.
    switch (gCurrentAlgorithm) {
    case Algorithm.MIN_DISC:
        gMinDisc = minimumDisc(gPoints);
        break;
    case Algorithm.CONVEX_HULL:
        gConvexHull = convexHull(gPoints);
        break;
    }
}

function onClick(e) {
    'use strict';

    // Find the clicked point in the list of points(if it exists)
    //
    var clickedPoint = getClickedPoint(e);

    updatePointSet(clickedPoint);
    
    updateDerivedGeometry();

    draw();
}

function randomAlgorithm() {
    'use strict';
    
    return randomIntLessThan(Algorithm.NUM_ALGORITHMS);
}

function init() {
    'use strict';
    
    var rawPoints,
        isTouchDevice = window.hasOwnProperty('ontouchstart');
    
    // Select an algorithm to use
    //
    gCurrentAlgorithm = randomAlgorithm();
    
    // Detect if HTML5 Storage is supported
    gSupportsStorage = window.hasOwnProperty('localStorage') && window.localStorage !== null;
    
    if (gSupportsStorage) {
        rawPoints = localStorage.getItem('points');
        if (rawPoints) {
            gPoints = JSON.parse(rawPoints);
            updateDerivedGeometry();
        }
    }

    // Initialize the drawing variables
    //
    gCanvasElement = document.getElementById("canvas");
    gDrawingContext = gCanvasElement.getContext("2d");
    
    // Setup event listeners
    //
    gCanvasElement.addEventListener("click", onClick, false);
    window.addEventListener("deviceorientation", draw(), false);

    if (isTouchDevice) {
        // Use a bigger point radius for touch screens as fingers are big and clumsy
        //
        gPointRadius = 20.0;
    }

    // Size the canvas
    //
    draw();
}
