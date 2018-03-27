/**
 * @fileoverview Functions relating creating draggable joints and paths
 * @author s.maam@kalebr.com (Sami El Maameri)
 */

/**
 * Class for a Joint.
 * Allows joints and paths to be created within the element.
 * @param {string} the element id to create the instance on.
 * @param {object} options
 * @constructor
 */

function Joint(divId, opts){

  /** @type {String} the element id to create the instance on */
  this.divId = divId;

  /** @type {HTMLElement} the element id the instance is created on */
  this.element = document.getElementById(divId);

  /** @type {HTMLElements} the elements to turn into joints */
  this.joints = this.element.getElementsByClassName('joint');

  /** @type {HTMLElements} the elements that should be draggable */
  this.draggables = this.element.getElementsByClassName('draggable');

  /** @type {Boolean} True to enable interactive joints */
  this.interactiveJoints = opts.interactiveJoints;

  /** @type {Number} Stroke width of the connectors to be applied as a CSS Style */
  this.connectorStrokeWidth = opts.connectorStrokeWidth || 5;

  /** @type {Number} Offset distance between the triple connectors */
  this.connectorTripleOffset = opts.connectorTripleOffset || 5;

  /** @type {Function} Listener for when an element is being dragged */
  this.elementDraggableListener = this.handleElementDrag.bind(this);

  /** @type {Function} Listener for when an element is being dragged. Used when
   * creating a new path only */
  this.pathDragListener = this.handleDrag.bind(this);

  /** @type {Function} listener for mousedown event when a path is being dragged. Conencts the
   * path if it is on a connectable joint, otherwise ends the path */
  this.mouseDownOnPathDragListener = this.handleMouseDownOnPathDragListener.bind(this);

  /** @type {HTMLElement} Element containing all the connector elements */
  this.connectionsContainer = document.getElementById("connections-container");

  /** @type {String} The type of path we wish to draw */
  this.pathType = 'triple-line';

  this.init();
}

/** @type {boolean} true if a path joint currently being  dragged */
Joint.prototype.dragging = false;

/** @type {boolean} true  if the mouse cursor is currently over a joint element */
Joint.prototype.inJoint = false;

/** @type {array} containing the HTML elements of the connectors */
Joint.prototype.connections = [];

/**
 * Contains state data on the connectors, including
 *  - id
 *  - the HTML element
 *  - from joint (the joint it is connected from)
 *  - to joint (the joint it is connected to)
 *  - type (the type of connection it accepts)
 * @type {array} of connector state objects
 * */
Joint.prototype.connectionsList = [];


/** @type {Object} The starting coordinate for a dragged path */
Joint.prototype.startCoords = null;

/** @type {HTMLELement} The currently active path */
Joint.prototype.currentPath = null;

/** @type {Object} The active path attributes*/
Joint.prototype.currentPathState = {};

/** @type {string} a path that is clicked on */
Joint.prototype.activePath = null;

/** @type {Object} attributes of the element that is being dragged */
Joint.prototype.dragged = {};

/** @type {Object} id of the element that is being dragged */
Joint.prototype.mouseDragStartCoords = {x:null, y:null};

/** @type {Object} the active joint */
Joint.prototype.currentJoint  = {};

/** @type {Object} object containing all the connections */
Joint.prototype.connectionsContainer = null;

/**
 * @type {Function} Function to be fired on a delete event.
 */
Joint.prototype.deleteHandler = null;

/**
* @type {Array} Listeners subscribed to the Joint's events.
*/
Joint.prototype.listeners_ = [];

/**
 * If the mouse cursor is currently over a joint element
 * Joint.prototype.currentPath = null;
 */
Joint.prototype.init = function(){
  this.getConnectionsContainer();
  this.addEventListeners();
};

/**
 * Sets the g element container to hold the connector element. Creates it
 * if such a container does not already exist
 */
Joint.prototype.getConnectionsContainer = function(){
  var container = this.element.querySelector(".connections-container");
  if(!container){
    container  = this.createSvgGroupElement('connections-container');
    this.element.prepend(container);
  }
  this.connectionsContainer = container;
};

/**
 * Creates and svg group element
 * @param (string) the element classname
 * @return (SVGElement) a group element
 */
Joint.prototype.createSvgGroupElement = function(className){
  var g = document.createElementNS("http://www.w3.org/2000/svg", "g");
  g.setAttribute('class', className);
  return g;
};

/**
 * Create the event listeners
 */
Joint.prototype.addEventListeners = function(){

  // joint listeners
  if(this.interactiveJoints) this.addJointEventListeners();

  // connector listeners
  document.addEventListener("mousedown", this.connectionHoverListener.bind(this), true);
  document.addEventListener("keydown", this.deleteConnectorListener.bind(this), true);

  // element draggable listeners
  this.addElementDraggableListeners();
  document.addEventListener("mouseup", this.removeElementDraggableListener.bind(this), true);
  document.addEventListener("touchend", this.removeElementDraggableListener.bind(this), true);
};

/**
 * Create the event listeners for the draggable elements
 */
Joint.prototype.addElementDraggableListeners = function(){
  for(var i = 0; i < this.draggables.length; i++){
    this.makeElementDraggable(this.draggables[i]);
  }
};

/**
 * Create the event listeners for the draggable elements
 */
Joint.prototype.makeElementDraggable = function(element){
  element.querySelector('rect').addEventListener("mousedown", this.draggableMouseDownListener.bind(this), true);
  element.querySelector('rect').addEventListener("touchstart", this.draggableMouseDownListener.bind(this), true);
};

/**
 * Add event listener to drag blocks with mouse cursor
 * @param (event) the click event on the element
 */
Joint.prototype.draggableMouseDownListener = function(event){
  var joint = event.target.closest(".draggable");
  this.dragged = this.getElementCoordinateAttributes(joint);


  if(event.type === 'touchstart') {
    event.clientX = event.touches[0].clientX;
    event.clientY = event.touches[0].clientY;
  }

  this.mouseDragStartCoords = this.getSvgCoords(event.clientX, event.clientY);

  this.addElementDraggableListener();
};


/**
 * Get the elements coordinate attributes
 * @param {HTMLElement}
 * @return {object} element:the element; (x,y): the coordinates of the element in the SVG space
 */
Joint.prototype.getElementCoordinateAttributes = function(element){
  return {
    element: element,
    x: element.transform.baseVal[0].matrix.e,
    y: element.transform.baseVal[0].matrix.f
  };
};

/**
 * Get the translation and scale values of the matrix transformation acting on the
 * .svg-pan-zoom_viewport element, which is what the PanZoom libaray creates to
 * apply the pan and zoom functionality.
 * @return {{scale, x, y}} the scale factor, and the x and y translate values of the matrix
 */
Joint.prototype.getPanZoomValues = function(){
  var g = document.querySelector(".svg-pan-zoom_viewport");
  var matrix = g.transform.baseVal.consolidate().matrix;

  return {
    scale:matrix.a,
    x:matrix.e,
    y:matrix.f
  };

};

/**
 * Add the listener to attached the joints to mousemove events
 */
Joint.prototype.addElementDraggableListener = function(){
  document.addEventListener("mousemove", this.elementDraggableListener, true);
  document.addEventListener("touchmove", this.elementDraggableListener, true);
};

/**
 * Remove the listener that attached joints to mousemove events
 */
Joint.prototype.removeElementDraggableListener = function(){
  document.removeEventListener("mousemove", this.elementDraggableListener, true);
  document.removeEventListener("touchmove", this.elementDraggableListener, true);
  this.dragging = false;

  // Fire a JOINT_DRAG_END event
  var event = {
    type:'JOINT_DRAG_END',
  };
  this.fireChangeListener(event);

};

/**
 * Initialising a created joint and adding the mousemove listeners on it.
 * @param element
 * @param {x:Number, y:Number} coordinates in the dom space.
 */
Joint.prototype.addDraggableListenerOnElementCreation = function(element, coords){

  // convert the coordinates to the SVG Space
  var svgCoords = this.getSvgCoords(coords.x, coords.y);

  this.dragged.element = element;
  this.dragged.x = svgCoords.x;
  this.dragged.y = svgCoords.y;

  var panZoomCoords = this.transformSVGCoordinatesToPanZoomCoordinateSystem(svgCoords);
  this.mouseDragStartCoords = {
    x: panZoomCoords.x,
    y: panZoomCoords.y
  };

  this.addElementDraggableListener();
};


/**
 * Convert the SVG coordinates to account for the Pan Zoom matrix transformation
 * @param {Object} the initial coordinates
 * @return {Object} the updated coordinates
 */
Joint.prototype.transformSVGCoordinatesToPanZoomCoordinateSystem = function(coords){
  // get the current panZoom values of the Making tool svg element.
  var panZoom = this.getPanZoomValues();

  // transform the pins coordinate to match the pan-zoom transformations.
  var x = (coords.x * panZoom.scale) + panZoom.x;
  var y = (coords.y * panZoom.scale) + panZoom.y;

  return {x:x, y:y};
};

/**
 * Handle when a joint is being dragged
 * @param {MouseEvent.mousemove} the mousemove event
 */
Joint.prototype.handleElementDrag = function(event){

  this.dragging = true;
  if(this.isMouseOutOfBounds(event)) return;

  if(event.type === 'touchmove') {
    event.clientX = event.touches[0].clientX;
    event.clientY = event.touches[0].clientY;
  }

  // svg coordinate space
  var svgCoords = this.getSvgCoords(event.clientX, event.clientY);

  var panZoom = this.getPanZoomValues();

  // get the difference between the current mouse position, and the start of the mouse drag.
  var dx = svgCoords.x -  this.mouseDragStartCoords.x;
  var dy = svgCoords.y -  this.mouseDragStartCoords.y;

  // update the difference in the coordinates to account for pan-zoom scaling
  dx = (dx / panZoom.scale);
  dy = (dy / panZoom.scale);

  // calculated position of the dragged element is its start location, plus the
  // number of pixels it has been dragged.
  var translateX = Math.round(this.dragged.x + dx);
  var translateY = Math.round(this.dragged.y + dy);


  // update the dragged joint's position
  this.dragged.element.transform.baseVal[0].matrix.e = translateX;
  this.dragged.element.transform.baseVal[0].matrix.f = translateY;

  // Fire a JOINT_DRAG event
  var event = {
    type:'JOINT_DRAG',
    element:this.dragged.element,
    x:translateX,
    y:translateY
  };
  this.fireChangeListener(event);

  var pinId = this.dragged.element.id.substr(8);
  this.refreshConnectorPath(this.getConnectorFromPinId(pinId));

};

/**
 * Redraw all the connector paths
 */
Joint.prototype.refreshAllConnectorPaths = function(){
  this.connectionsList.forEach(function(c){
    this.refreshConnectorPath(c);
  }.bind(this));
};

/**
 * Redraw the connector path
 * @param {this.connectionsList[i]} connector object
 */
Joint.prototype.refreshConnectorPath = function(connector){
  var startCoords = this.getElementCenterOfGravityInSVGSPace(connector.from);
  var endCoords = this.getElementCenterOfGravityInSVGSPace(connector.to);
  this.updatePathDescription(connector.element, startCoords, endCoords);
};

/**
 * Check if a mouse has moved out of bounds of the svg element
 * @param {MouseEvent.mousemove} the mousemove event
 * @return {boolean} True if mouse is out of bounds
 */
Joint.prototype.isMouseOutOfBounds = function(event){
  var boundry = this.element.getBoundingClientRect();
  var offset = 0;

  return (event.clientX < boundry.x + offset ||
    event.clientX > boundry.x + boundry.width - offset ||
    event.clientY < boundry.y + offset ||
    event.clientY > boundry.y + boundry.height - offset);
};

/**
 * Add event listeners to the joints.
 */
Joint.prototype.addJointEventListeners = function(){
  for (var i = 0; i < this.joints.length; i++){
    this.joints[i].addEventListener("mousedown", this.jointMouseDownListener.bind(this), true);
    // this.joints[i].addEventListener("touchstart", this.jointMouseDownListener.bind(this), true);

    this.joints[i].addEventListener("mouseenter", function(){
      this.inJoint = true;
      if(this.dragging && this.isMatchingConnection(event)){
        event.target.closest(".joint").classList.add('jointHover');
      }
    }.bind(this), true);

    this.joints[i].addEventListener("mouseleave", function(){
      this.inJoint = false;
      event.target.closest(".joint").classList.remove('jointHover');
    }.bind(this), true);
  }
};

/**
 * Remove hover classes from the connectors
 */
Joint.prototype.removeConnectorHoverClasses = function(){
  var connections = document.getElementsByClassName('connector');
  for(var i=0; i<connections.length; i++){
    connections[i].classList.remove('connectionHover');
    this.activePath = null;
  }
};

/**
 * Remove hover classes from the connectors
 */
Joint.prototype.connectionHoverListener = function(){
  if(!event.target.classList.contains('connectionHover')){
    this.removeConnectorHoverClasses();
  }
};

/**
 * Handle the event for deleting the connectors
 * @param {Event} the delete event
 */
Joint.prototype.deleteConnectorListener = function(event){
  if(!this.activePath) return;
  var connectionId = Number(this.activePath.id.substr(11));
  if(event.keyCode == 46){
    if(this.deleteHandler){
      var pinId = this.getPinIdFromConnectionId(connectionId);
      this.deleteHandler(pinId);
    } else if(this.activePath){
      this.deleteConnector(Number(connectionId));
      this.activePath = null;

      var event = {
        type:'DELETE',
        connectorId:connectionId
      };

      this.fireChangeListener(event);
    }
  }
};

/**
 * Get the Pin Id from the Connection Id
 * @param id
 * @return {string}
 */
Joint.prototype.getPinIdFromConnectionId = function(id){
  var connector = this.getConnectionById(id);
  if(connector.from.classList.contains('pin')){
    return connector.from.id.substr(4);
  } else if(connector.to.classList.contains('pin')){
    return connector.to.id.substr(4);
  }
};

/**
 * Get the Pin Id from the Connection Id
 * @param {String} the pin id
 * @return {object} connector data attributes
 */
Joint.prototype.getConnectorFromPinId = function(pinId){
  return this.connectionsList.filter(function(connector){
    if(connector.from.classList.contains('pin')){
      return  pinId ===  connector.from.id.substr(4);
    } else if(connector.to.classList.contains('pin')){
      return pinId === connector.to.id.substr(4);
    }
  })[0];
};

/**
 * Delete a connector by Id
 * @param {String} the connector id
 */
Joint.prototype.deleteConnector = function(id){
  this.deleteConnectorPath(id);
  this.removeConnectorByIndex(this.indexOfConnector(id));
};

/**
 * Delete all the connector joints
 * @param {!Array.<!Joint.prototype.connectionsList>}
 */
Joint.prototype.deleteAllConnectors = function(){
  var connectors = this.connectionsList.slice();
  connectors.forEach(function(c){
    this.deleteConnector(c.id);
  }.bind(this));
};

/**
 * Delete all the connector joints
 */
Joint.prototype.makingToolEventListeners = function(event){
  if(event.type === 'CLEAR_ALL'){
    this.deleteAllConnectors();
  }
};

/**
 * Delete a connector path by Id
 * @param {String} the connector id
 */
Joint.prototype.deleteConnectorPath = function(id){
  return this.deleteElement(this.getConnectionById(id).element);
};

/**
 * Delete an HTML Element
 * @param {HTMLElement} the element to delete
 */
Joint.prototype.deleteElement = function(element){
  element.parentNode.removeChild(element);
};

/**
 * Get connector object by Id
 * @param {string} the connector id
 * @return {Object} the connector attributes
 */
Joint.prototype.getConnectionById = function(id){
  return this.connectionsList[this.indexOfConnector(id)];
};

/**
 * Remove a connector from the Joint.connectionsList by its index.
 * @param {string} the connector id
 * @return {Object} the connector attributes
 */
Joint.prototype.removeConnectorByIndex = function( index ){
  this.connectionsList.splice( index, 1 );
};

/**
 * Get a connectors index in the Joint.connectionsList by its Id.
 * @param {string} the connector id
 * @return {Number} the connector index
 */
Joint.prototype.indexOfConnector = function(id){
  var connections = this.connectionsList;
  for(var i=0;i<connections.length; i++){
    if( connections[i].id === id ){
      return i;
    }
  }
  return -1;
};

/**
 * Function called when ending a connector path
 */
Joint.prototype.endPath = function(){
  document.removeEventListener("mousemove", this.pathDragListener, true);
