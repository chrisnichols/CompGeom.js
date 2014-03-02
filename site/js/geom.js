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
// Geometry Classes
//----------------------------------------------------------------------------------------
function Point(x, y) {
    'use strict';
    
    this.x = x;
    this.y = y;
}

Point.prototype.distanceTo = function (point) {
    'use strict';
    
    var deltaX = this.x - point.x,
        deltaY = this.y - point.y;

    return Math.sqrt(deltaX * deltaX + deltaY * deltaY);
};

Point.prototype.compare = function (point) {
    'use strict';
    
    if (this.x !== point.x) {
        return this.x - point.x;
    } else {
        return this.y - point.y;
    }
};

function Circle(center, radius) {
    'use strict';
    
    this.center = center;
    this.radius = radius;
}

Circle.prototype.containsPoint = function (point) {
    'use strict';

    return lessThanOrTolerablyEqual(this.center.distanceTo(point), this.radius);
};

//----------------------------------------------------------------------------------------
// General Geometry Functions
//----------------------------------------------------------------------------------------
function comparePoints(a, b) {
    'use strict';
    
    return a.compare(b);
}

function orderPoints(points) {
    'use strict';
    
    var orderedPoints = points.slice(0);
    
    orderedPoints.sort(comparePoints);
    
    return orderedPoints;
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
    
    var z = (p1.x - p2.x) * (p3.y - p2.y) - (p1.y - p2.y) * (p3.x - p2.x);
    
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

    var center = new Point((p1.x + p2.x) / 2.0, (p1.y + p2.y) / 2.0),
        radius = center.distanceTo(p1);

    return new Circle(center, radius);
}

function threePointDisc(p1, p2, p3) {
    'use strict';

    // See http://en.wikipedia.org/wiki/Circumscribed_circle#Cartesian_coordinates
    // Didn't feel like working through the equations.
    //
    var D = 2.0 * (p1.x * (p2.y - p3.y) + p2.x * (p3.y - p1.y) + p3.x * (p1.y - p2.y)),
        x = ((Math.pow(p1.x, 2) + Math.pow(p1.y, 2)) * (p2.y - p3.y) + (Math.pow(p2.x, 2) + Math.pow(p2.y, 2)) * (p3.y - p1.y) + (Math.pow(p3.x, 2) + Math.pow(p3.y, 2)) * (p1.y - p2.y)) / D,
        y = ((Math.pow(p1.x, 2) + Math.pow(p1.y, 2)) * (p3.x - p2.x) + (Math.pow(p2.x, 2) + Math.pow(p2.y, 2)) * (p1.x - p3.x) + (Math.pow(p3.x, 2) + Math.pow(p3.y, 2)) * (p2.x - p1.x)) / D,
        center = new Point(x, y),
        radius = center.distanceTo(p1);

    return new Circle(center, radius);
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
        orderedPoints = orderPoints(points);
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
        if (!minDisc.containsPoint(points[i])) {
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
        if (!minDisc.containsPoint(points[i])) {
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
            if (!minDisc.containsPoint(randomPoints[i])) {
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
    gDrawingContext.arc(point.x, point.y, gPointRadius, 0, 2 * Math.PI, false);
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
    gDrawingContext.moveTo(start.x, start.y);
    gDrawingContext.lineTo(end.x, end.y);
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

    var x = circle.center.x,
        y = circle.center.y,
        r = circle.radius;

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

    return new Point(x, y);
}

function updatePointSet(clickedPoint) {
    'use strict';
    
    var tolerance = 2 * gPointRadius,
        pointIndex = -1,
        i,
        curPoint;
    
    for (i = 0; i < gPoints.length; i += 1) {
        if (clickedPoint.distanceTo(gPoints[i]) <= tolerance) {
            pointIndex = i;
            break;
        }
    }

    if (pointIndex !== -1) {
        // Find the point under the cursor (if any) and remove it from the list
        //
        gPoints.splice(i, 1);
    } else {
        // Add the clicked point to the list
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

function supportsLocalStorage() {
    'use strict';
    
    var t = "test";
    
    // Temporarily disable local storage until this can be fixed
    return false;
    
    try {
        window.localStorage.setItem(t, t);
        window.localStorage.removeItem(t);
        return true;
    } catch (e) {
        return false;
    }
}

function init() {
    'use strict';
    
    var rawPoints,
        isTouchDevice = window.hasOwnProperty('ontouchstart');
    
    // Select an algorithm to use
    //
    gCurrentAlgorithm = randomAlgorithm();
    
    // Detect if HTML5 Storage is supported
    gSupportsStorage = supportsLocalStorage();
    
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
