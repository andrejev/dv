/*************************************************************************
 * Copyright 2016 Pavel Andrejev
 *
 *************************************************************************
 *
 * @description
 * DV is a JavaScript library for graph data visualization on the timeline.
 *
 * @author
 * Pavel Andrejev ( <andrejev(dot)pavel(at)gmail(dot)com> )
 *
 *************************************************************************/
(function (window, d3) {
  "use strict";
  var DV,
    today = new Date(),
    formatDateIso = d3.time.format("%Y-%m-%d"),
    baseConfig = {
      keyMap: {
        id: "id",
        date: "date",
        description: "description",
        weight: "weight",
        sourceId: "sourceId",
        targetId: "targetId"
      },
      // 4 * 9 = 28 unique symbols
      symbols: [
        d3.svg.symbol().type("circle"),
        d3.svg.symbol().type("square"),
        d3.svg.symbol().type("triangle-down"),
        d3.svg.symbol().type("triangle-up")],
      colors: d3.scale.category10().range().slice(0, 9),
      // base pixel
      scale: 1,
      pixel: 15,
      minSize: 4,
      maxSize: 10,
      agenda: true,
      dateFormatNode: formatDateIso,
      dateFormatView: formatDateIso
    },
    Tooltip,
    Metro,
    Prepare,
    Timeline,
    Progress,
    Agenda;

  (function () {
    /**
     * Initialize a new Prepare object.
     * This object verifies incoming data and converts it in required format
     *
     * @constructor
     * @param metro
     */
    Prepare = function (metro) {
      var that = this, config = metro._config, keyMap = config.keyMap;
      // store required variables from metro in this
      that._metro = metro;
      that._nodes = metro._nodes;
      that._edges = metro._edges;
      that._community = metro._community || {};
      that._weight = metro._weight || 0;
      that._dateFormat = config.dateFormatNode;
      that._from = metro._from && config.dateFormatView.parse(metro._from);
      that._to = metro._to && config.dateFormatView.parse(metro._to);

      // prepare nodes
      that._nodes = that._nodes.map(function (node) {
        return {
          id: node[keyMap.id],
          date: node[keyMap.date],
          description: node[keyMap.description] || node[keyMap.id],
          _orig: node
        };
      });

      // prepare edges
      that._edges = that._edges.map(function (edge) {
        return {
          sourceId: edge[keyMap.sourceId],
          targetId: edge[keyMap.targetId],
          weight: edge[keyMap.weight] || 0,
          _orig: edge
        };
      });

      that.prepare();
      that.grouped(metro._grouped);
    };

    /**
     * preparation of nodes and edges for visualization
     */
    Prepare.prototype.prepare = function () {
      var that = this, fromTime, toTime;
      that._sday = today;
      that._eday = today;
      that._nodesGroupByCommunity = {};
      that._edgesGroupByCommunity = {};
      that._edgesGroupBySource = {};
      that._idNodeMap = {};

      that._nodes = that._nodes.filter(function (node) {
        if (node.hasOwnProperty("id") && node.hasOwnProperty("date")) {
          node._date = that._dateFormat.parse(node.date);
          return node;
        }
      }).sort(function (a, b) {
        var x = a._date.getTime(),
          y = b._date.getTime();
        return ((x < y) ? -1 : ((x > y) ? 1 : 0));
      });

      that._sday = that._nodes[0]._date;
      that._eday = that._nodes[that._nodes.length - 1]._date;

      fromTime = (that._from || that._sday).getTime();
      toTime = (that._to || that._eday).getTime();

      that._nodes = that._nodes.filter(function (node) {
        var id = node.id,
          community;
        if (fromTime <= node._date.getTime() && node._date.getTime() <= toTime) {
          node.community = community = that._community[id];
          // community
          if (!that._nodesGroupByCommunity[community]) {
            that._nodesGroupByCommunity[community] = [];
          }
          that._nodesGroupByCommunity[community].push(node);
          that._idNodeMap[id] = node;
          return node;
        }
      });

      that._sday = that._nodes[0]._date;
      that._eday = that._nodes[that._nodes.length - 1]._date;

      that._edges = that._edges.filter(function (edge) {
        var srcNode = that._idNodeMap[edge.sourceId],
          trgNode = that._idNodeMap[edge.targetId],
          communityTarget = that._community[edge.targetId];

        edge.srcNode = srcNode;
        edge.trgNode = trgNode;

        if (srcNode && trgNode) {

          if (!that._edgesGroupByCommunity[communityTarget]) {
            that._edgesGroupByCommunity[communityTarget] = [];
          }
          that._edgesGroupByCommunity[communityTarget].push(edge);

          if (!that._edgesGroupBySource[edge.sourceId]) {
            that._edgesGroupBySource[edge.sourceId] = [];
          }
          if (edge.weight >= that._weight) {
            that._edgesGroupBySource[edge.sourceId].push(edge);
          }

          if (srcNode._date.getTime() > trgNode._date.getTime()) {
            return edge;
          }
        }
      }).sort(function (a, b) {
        // "sourceTimeStamp": "07.06.2013"
        // "targetTimeStamp" : "20130609"
        var aSource = a.srcNode._date,
          aTarget = a.trgNode._date,
          bSource = b.srcNode._date,
          bTarget = b.trgNode._date,
          x = aSource.getTime() - aTarget.getTime(),
          y = bSource.getTime() - bTarget.getTime();
        return ((x < y) ? -1 : ((x > y) ? 1 : 0));
      });
    };

    /**
     * Call group function by parameter name
     *
     * @param grouped
     */
    Prepare.prototype.grouped = function (grouped) {
      switch (grouped) {
        case "day":
          this.groupByDay();
          break;
        default:
          // data is already grouped
          break;
      }
    };

    /**
     * Group data by date.
     * All nodes for each community would be grouped to one object by date.
     */
    Prepare.prototype.groupByDay = function () {
      // build without
      var that = this,
        nodes = that._nodes,
        edges = that._edges,
        community = that._community,
        idNodeMap = that._idNodeMap,
        newNodes = [],
        newNodesMap = {},
        newEdges = [],
        newEdgesMap = {},
        oldNodeNewNodeMap = {},
        newCommunity = {};

      nodes.forEach(function (node) {
        var id = [node.community, node.date].join("/"),
          newNode = newNodesMap[id];

        if (!newNode) {
          newNode = newNodesMap[id] = {
            description: id,
            date: node.date,
            _date: node._date,
            id: id,
            nodes: []
          };
          newNodes.push(newNode);
          newNode.community = newCommunity[id] = community[node.id];
        }

        oldNodeNewNodeMap[node.id] = newNode;
        newNode.nodes.push(node);
      });

      edges.forEach(function (edge) {
        var sourceId = edge.sourceId,
          srcNode = idNodeMap[sourceId],
          targetId = edge.targetId,
          trgNode = idNodeMap[targetId],
          newSourceId,
          newTargetId,
          edgesUnique;

        if (srcNode && trgNode) {
          newSourceId = [
            community[srcNode.id],
            srcNode.date
          ].join("/");
          newTargetId = [
            community[trgNode.id],
            trgNode.date
          ].join("/");

          if (newSourceId !== newTargetId) {
            edgesUnique = [
              newSourceId,
              newTargetId
            ].join("-");

            if (!newEdgesMap[edgesUnique]) {
              newEdgesMap[edgesUnique] = {
                edges: [],
                sourceId: newSourceId,
                targetId: newTargetId,
                srcNode: newNodesMap[newSourceId],
                trgNode: newNodesMap[newTargetId],
                weight: edge.weight
              };
              newEdges.push(newEdgesMap[edgesUnique]);
            }

            newEdgesMap[edgesUnique].weight = Math.max(
              newEdgesMap[edgesUnique].weight, edge.weight);
            newEdgesMap[edgesUnique].edges.push(edge);
          }
        }
      });

      that._nodes = newNodes;
      that._edges = newEdges;
      that._community = newCommunity;
      that.prepare();
    };

  })(window.jLouvain, window.d3);

  (function ($) {
    /**
     * Initialize a new Tooltip object
     *
     * @param selector  jQuery object or jQuery string selector, in which tooltip will be added
     * @param metro     reference to metro object
     * @constructor
     */
    Tooltip = function (selector, metro) {
      var that = this;
      that._metro = metro;
      that._tooltipObj = $("<div>")
        .append("<div class='col-lg-12'>" +
          "<ul class='list-group'>")
        .addClass("dvTooltip");
      that._list = that._tooltipObj.find("ul");
      that._parent = selector;
      that._dateFormat = metro._config.dateFormatView;

      // add callbacks to metro
      metro.onMouseOut = that.context(that.onMouseOut);
      metro.onMouseOver = that.context(that.onMouseOver);
      metro.onClick = that.context(that.onClick);
      // add element to selector
      that.appendTo(selector);
    };

    Tooltip.prototype.context = function (callback) {
      var that = this;
      return function () {
        callback.apply(that, arguments);
      };
    };

    /**
     * Generate description string for the node
     *
     * @param node
     * @returns {string}
     */
    Tooltip.prototype.description = function (node) {
      var description = this._dateFormat(node._date) + ": " + node.description;
      if (node.nodes && node.nodes.length) {
        description += " (" + node.nodes.length + ")";
      }
      return description;
    };

    /**
     * Create list of elements, which be grouped together and add it after element.
     *
     * @param node      node object
     * @param selector  jQuery selector
     */
    Tooltip.prototype.subList = function (node, selector) {
      var that = this;
      if (node.nodes && node.nodes.length) {
        // create sublist
        var nodeHolder = $("<div class='dvTooltipNodeHolder'>");
        node.nodes.forEach(function (n) {
          nodeHolder.append($("<li class='list-group-item dvTooltipSubListNode'>" +
            that.description(n) + "</li>"));
        });
        $(selector)
          .on("click", function () {
            nodeHolder.toggle();
          })
          .addClass("dvTooltipCursorPointer")
          .after(nodeHolder);
      }
    };

    /**
     * Show tooltip for clicked element.
     *
     * @param source
     * @param target
     */
    Tooltip.prototype.show = function (source, target) {
      var that = this, header, other,
        metro = that._metro,
        event = d3.event,
        dvBody = $('.dvBody'),
        dvBodyGraph = $('.dvBodyGraph'),
        dvBodyGraphWidth = dvBodyGraph.width(),
        windowWidth = $(window).width(),
        pageX = event.pageX,
        pageY = event.pageY,
        offsetLeft = dvBody.offset().left,
        offsetTop = dvBodyGraph.offset().top,
      // calculate tooltip position
        x = pageX - offsetLeft + dvBody.scrollLeft(),
        y = pageY - offsetTop + dvBodyGraph.scrollTop(),
        top = y + 5, left, right;

      if (windowWidth / 2 > pageX && ((dvBodyGraphWidth + offsetLeft) / 2) > pageX) {
        // position tooltip on the right side of element
        left = x;
      } else {
        // position tooltip on the left side of element
        right = dvBodyGraphWidth - x;
      }

      that._tooltipObj.css({
        left: left || "",
        right: right || "",
        top: top || ""
      });

      that._list.empty();

      // generate html for header
      header = $("<li class='list-group-item active'>" +
        "<span class='badge dvTooltipCursorPointer'>close</span>" +
        that.description(source) + "</li>");
      // bind close click
      header.on("click", function () {
        if ($(arguments[0].target).hasClass("badge")) {
          that.onClose();
        }
      });
      that._list.append(header);

      // add sublist to header
      that.subList(source, header);

      // get all edges for the node
      other = metro.prepared._edgesGroupBySource[source.id] || [];
      // add edge to the tooltip
      other.forEach(function (edge) {
        var targetNode = metro.prepared._idNodeMap[edge.targetId],
          listElement;
        if (targetNode) {
          listElement = $("<li class='list-group-item'>" +
            "<span class='badge'>" + (Math.round(edge.weight * 100) / 100) + "</span>" +
            that.description(targetNode) + "</li>");
          if (targetNode === target) {
            listElement.addClass("dvTooltipSelectedNodeInList");
          }
          that._list.append(listElement);
          that.subList(targetNode, listElement);
        }
      });
      that._tooltipObj.show();
    };

    /**
     * Hide the tooltip element
     */
    Tooltip.prototype.hide = function () {
      this._tooltipObj.hide();
    };

    /**
     * Append tooltip into element
     *
     * @param holder  jQuery selector
     */
    Tooltip.prototype.appendTo = function (holder) {
      $(holder).append(this._tooltipObj);
    };

    /**
     * On mouse over callback.
     *
     * @param source
     * @param target
     */
    Tooltip.prototype.onMouseOver = function (source, target) {
      if (!this._clicked) {
        var that = this,
          metro = that._metro,
          polylines = metro._polylineBySourceId[source.id],
          shape = metro._shapeBySourceId[source.id];
        if (polylines) {
          d3.selectAll(polylines).style("stroke", "black").style("stroke-width", 5);
        }
        shape.style("fill", "black");
        that.show(source, target);
      }
    };

    /**
     * On mouse over callback
     *
     * @param source
     */
    Tooltip.prototype.onMouseOut = function (source) {
      if (!this._clicked) {
        var that = this,
          metro = that._metro,
          color = source._communityConfig.color,
          polylines = metro._polylineBySourceId[source.id],
          shape = metro._shapeBySourceId[source.id];
        if (polylines) {
          d3.selectAll(polylines).style("stroke", color).style("stroke-width", 1);
        }
        shape.style("fill", color);
        that.hide();
      }
    };

    /**
     * On click callback
     *
     * @param source
     * @param target
     */
    Tooltip.prototype.onClick = function (source, target) {
      var that = this;
      if (that._clicked) {
        that.onClose();
      }
      if (source) {
        that._onClick = {source: source, target: target};
        that.onMouseOver(source, target);
        that._clicked = true;
      }
    };

    /**
     * On close callback
     */
    Tooltip.prototype.onClose = function () {
      var that = this, onClick = that._onClick;
      if (that._clicked) {
        that._clicked = false;
        that.onMouseOut(onClick.source, onClick.target);
      }
    };
  })(window.jQuery);

  (function (d3) {
    /**
     * Initialize a new Agenda object
     *
     * @param holder
     * @param maxSize
     * @param pixel
     * @constructor
     */
    Agenda = function (holder, maxSize, pixel) {
      var that = this;
      that._parent = holder;
      that._positionX = pixel;
      that._positionY = 10;
      that._maxSize = maxSize;
      that._pixel = pixel;
      that._svg = d3.select(holder[0]).append("svg")
        .attr("width", "100%");
    };

    /**
     * Add a new community to Agenda
     *
     * @param color
     * @param symbol
     * @param name
     */
    Agenda.prototype.add = function (color, symbol, name) {
      var that = this,
        svg = that._svg,
        width = that._parent.width();

      if (width < (that._positionX + name.length * 6)) {
        that._positionY += 10;
        that._positionX = that._pixel;
      }

      svg.append("svg:path")
        .attr("transform", function () {
          return "translate(" + that._positionX + "," + that._positionY + ")";
        })
        .attr("d", function () {
          return symbol.size(that._maxSize * that._maxSize * 2)();
        })
        .style("fill", color);

      that._positionX += that._pixel;

      svg.append("text")
        .attr("x", that._positionX)
        .attr("y", that._positionY + 4)
        .text(name);

      that._positionX += name.length * 6 + 10;
      that.heigth = that._positionY + 12;
      svg.attr("height", that.heigth);
    };
  })(window.d3);

  (function ($) {
    /**
     * Initialize a new Progress bar
     *
     * @constructor
     * @param holder  jQuery selector
     */
    Progress = function (holder) {
      var that = this;
      that._obj = $("<div>")
        .append("<div class='progress progress-striped active'>" +
          "<div class='progress-bar'>")
        .addClass("dvProgressBar");
      that._progress = that._obj.find(".progress-bar");
      $(holder).append(that._obj);
    };

    /**
     * Set value of progress bar
     *
     * @param percent   percent value
     */
    Progress.prototype.set = function (percent) {
      this._progress.css("width", (parseInt(percent, 10) || 0) + "%");
    };

    /**
     * Remove the progress bar from the page
     */
    Progress.prototype.ready = function () {
      this._obj.remove();
    };

  })(window.jQuery);

  (function () {
    /**
     * Initialize a new Timeline object
     *
     * @param holder        jQuery selector
     * @param startDate     Start date of timeline
     * @param endDate       End date of timeline
     * @param tickDistance  Distance between days
     * @constructor
     */
    Timeline = function (holder, startDate, endDate, tickDistance, dateFormat) {
      var svg = d3.select(holder[0]).append("svg"),
        timeline = svg.append("g"),
        scale = d3.time.scale().domain([startDate, endDate]),
        ticks = scale.ticks(d3.time.day, 1),
        days = ticks.length,
        width = days * tickDistance + tickDistance * 2,
        height = 20,
        mapDate = {},
        pointsList = [];

      timeline.attr("transform", "translate(0,5)");
      timeline.append("polyline")
        .attr("points", function () {
          for (var k = 0; k < days; k++) {
            var d = ticks[k],
              dayPosition = k * tickDistance + tickDistance;
            mapDate[d] = dayPosition;

            if ((d.getDate() === 1 && k > 10 && k < days - 10) ||
              k === 0 || k === days - 1) {
              var textX = k * tickDistance + tickDistance + 4;
              if (k === days - 1) {
                textX = textX - 3 * tickDistance - 4;
              }
              timeline.append("text")
                .attr("x", textX)
                .attr("y", 8)
                .text(dateFormat(d));
            }

            if (d.getDate() === 1 || k === 0 || k === days - 1) {
              pointsList.push(dayPosition + "," + 4);
            } else {
              pointsList.push(dayPosition + "," + 8);

            }

            pointsList.push(dayPosition + "," + 12);

            if (k !== days - 1) {
              pointsList.push(((k + 1) * tickDistance + tickDistance) + "," + 12);
            }

          }
          return pointsList.join(" ");
        })
        .attr("style", "fill:none;stroke:#2fa4e7;stroke-width:2;");
      // return timeline height and width
      this.width = width;
      this.height = height;
      this.mapDate = mapDate;

      svg.attr("width", width).attr("height", height);
    };
  })();

  (function ($, d3) {
    /**
     * Initialize a new Metro object.
     *
     * @param nodes       List of nodes
     * @param edges       List of edges
     * @param community   Community mapping
     * @constructor
     */
    Metro = function (nodes, edges, community) {
      var that = this;
      that._nodes = nodes || [];
      that._edges = edges || [];
      that._community = community || {};
      that._weight = 0;
      that._unlinked = true;
      // async
      that._asyncQueue = [];
      that._async = true;
      that._svg = null;
      that._mapNodes = {};
      that._mapEdges = {};
      that._mapGlobal = {};
      that._polylineBySourceId = {};
      that._shapeBySourceId = {};
      that._paddingTop = 0;
      that._minNotFreeY = {};

      that.config({});
      // start timer for async functionality
      setInterval(function () {
        var next = that._asyncQueue.shift();
        if (typeof next === "function") {
          next();
        }
      }, 5);
    };

    /**
     * Set grouped parameter
     *
     * @param grouped
     */
    Metro.prototype.grouped = function (grouped) {
      if (grouped) {
        this._grouped = grouped;
      }
      return this;
    };

    /**
     * Set minimal weight for edges
     *
     * @param weight
     */
    Metro.prototype.weight = function (weight) {
      if (typeof weight === "number") {
        this._weight = weight;
      }
      return this;
    };

    /**
     * Set showed date range
     *
     * @param from
     * @param to
     */
    Metro.prototype.range = function (from, to) {
      this._from = from;
      this._to = to;
      return this;
    };

    /**
     * Update default metro config.
     *
     * @param config  Configuration object
     */
    Metro.prototype.config = function (config) {
      var that = this,
        configMerged = $.extend(true, {}, baseConfig, that._config, config),
        scale = configMerged.scale;
      that._config = configMerged;
      that._pixel = configMerged.pixel * scale;
      that._minSize = configMerged.minSize * scale;
      that._maxSize = configMerged.maxSize * scale;
      return that;
    };

    /**
     * Get/set element from/to nodes map
     *
     * @param node      node object
     * @param y         y value in pixel
     * @returns {int}   node object
     */
    Metro.prototype.mapNodes = function (node, y) {
      if (y) {
        this._mapNodes[node.id] = y;
      }
      return this._mapNodes[node.id];
    };

    /**
     * Set object to global map.
     *
     * @param x   x-position (date was used)
     * @param y   y position in pixel
     * @param obj Object to set (Node/Edge)
     */
    Metro.prototype.mapGlobal = function (x, y, obj) {
      if (obj) {
        var that = this,
          d = x.toString(),
          _mapGlobal = this._mapGlobal;
        if (!_mapGlobal[d]) {
          _mapGlobal[d] = {};
        }
        if (!_mapGlobal[d][y]) {
          _mapGlobal[d][y] = {
            edges: []
          };
        }
        if (obj.hasOwnProperty("id")) {
          _mapGlobal[d][y].node = obj;
          that.mapNodes(obj, y);
        } else {
          _mapGlobal[d][y].edges.push(obj);
        }
        _mapGlobal._maxPointY = Math.max(y, _mapGlobal._maxPointY || 0);
        _mapGlobal[d].maxPositionOnY = Math.max(_mapGlobal[d][y].maxPositionOnY || 0, y);
        if (!that._minNotFreeY[y] || (that._minNotFreeY[y] || x).getTime() > x.getTime()) {
          that._minNotFreeY[y] = x;
        }
      }
    };

    /**
     * Check if position for node on global map is free
     *
     * @param x   x-position (date)
     * @param y   y-position (pixel)
     * @returns {boolean}
     */
    Metro.prototype.hasMapNode = function (x, y) {
      var _mapGlobal = this._mapGlobal,
        d = x.toString();
      return !!(_mapGlobal[d] && _mapGlobal[d][y] && _mapGlobal[d][y].node);
    };

    /**
     * Check if position for edge on global map is free
     *
     * @param x     x-position (date)
     * @param y     y-position (pixel)
     * @param node  node object, which has this edge
     *              (edges from the same node can be positioned at the same point)
     * @returns {boolean}
     */
    Metro.prototype.hasMapEdge = function (x, y, node) {
      var result = false,
        _mapGlobal = this._mapGlobal,
        i, len, d = x.toString(),
        edges = _mapGlobal[d] && _mapGlobal[d][y] && _mapGlobal[d][y].edges;
      if (edges && edges.length) {
        for (i = 0, len = edges.length; i < len && !result; ++i) {
          result = result || edges[i].sourceId === node.id;
        }
      }
      return result;
    };

    /**
     * Get maximal set y position for x
     *
     * @param x
     * @returns {*}
     */
    Metro.prototype.getMaxPointY = function (x) {
      var d;
      if (x) {
        d = x.toString();
        return (this._mapGlobal[d] && this._mapGlobal[d].maxPositionOnY) || 0;
      }
      return this._mapGlobal._maxPointY || 0;
    };

    /**
     * Add callback to the async queue
     *
     * @param callback
     */
    Metro.prototype.async = function (callback) {
      if (this._async) {
        this._asyncQueue.push(callback);
      } else {
        callback();
      }
    };

    /**
     * Generate ticks.
     * More info: https://github.com/mbostock/d3/wiki/Time-Scales#ticks
     *
     * @param startDate
     * @param endDate
     * @param interval
     * @param step
     */
    Metro.prototype.generateTicks = function (startDate, endDate, interval, step) {
      return d3.time.scale().domain([startDate, endDate]).ticks(interval, step);
    };

    /**
     * Create a node element and it to the graph
     *
     * @param graph
     * @param node
     * @param sourceNode
     */
    Metro.prototype.drawNode = function (graph, node, sourceNode) {
      var that = this,
        shape,
        dayCheck = null,
        x = that.timeline.mapDate[node._date],
        y = that.getMaxPointY(node._date),
        ticks = that.generateTicks(that.prepared._sday, node._date, d3.time.day, 1).reverse(),
        days = ticks.length,
        communityConfig = that._communityConfig[node.community],
        color = communityConfig.color,
        pixel = that._pixel,
        size = that._minSize;

      node._communityConfig = communityConfig;

      if (sourceNode) {
        y = that.getMaxPointY(sourceNode._date) - pixel;
      }

      // find position with free line on left side of node
      while (that.prepared._sday !== dayCheck) {
        y += pixel;
        if (y in that._minNotFreeY) {
          for (var i = 0; i < days; ++i) {
            dayCheck = ticks[i];
            if (that.hasMapNode(dayCheck, y) || that.hasMapEdge(dayCheck, y, node)) {
              dayCheck = node._date;
              break;
            }
            if (that._minNotFreeY[y].getTime() > dayCheck.getTime()) {
              dayCheck = that.prepared._sday;
              break;
            }
          }
        } else {
          break;
        }
      }

      if (node.nodes) {
        // min <= size <= max
        size = Math.min(that._maxSize, size + node.nodes.length);
      }

      shape = graph.append("svg:path")
        .attr("transform", function () {
          return "translate(" + x + "," + y + ")";
        })
        .attr("d", function () {
          return communityConfig.symbol.size(size * size * 2)();
        })
        .style("fill", color)
        .on("mouseover", function () {
          that.onMouseOver && that.onMouseOver(node);
        })
        .on("mouseout", function () {
          that.onMouseOut && that.onMouseOut(node);
        })
        .on("click", function () {
          that.onClick && that.onClick(node);
        });

      that._shapeBySourceId[node.id] = shape;
      that.mapGlobal(node._date, y, node);
    };

    /**
     * Draw a edge between to nodes
     *
     * @param graph
     * @param edge
     */
    Metro.prototype.drawEdge = function (graph, edge) {
      var that = this,
        source = edge.srcNode,
        target = edge.trgNode,
        targetX = that.timeline.mapDate[target._date],
        targetY = that.mapNodes(target),
        sourceX = that.timeline.mapDate[source._date],
        sourceY = that.mapNodes(source),
        pointsList = [],
        communityConfig = that._communityConfig[source.community],
        color = communityConfig.color,
        y = sourceY,
        scale = d3.time.scale().domain([source._date, target._date]),
        ticks = scale.ticks(d3.time.day, 1).reverse(),
        daysBetween = ticks.length - 1,
        x = 1;

      pointsList.push(sourceX + "," + sourceY);

      // find way between nodes
      for (; x < daysBetween; ++x) {
        var d = ticks[x],
          n = that.hasMapNode(d, y),
          e = that.hasMapEdge(d, y, source);
        if (n || e) {
          if (sourceY >= targetY) {
            y -= that._pixel;
          } else {
            y += that._pixel;
          }
          x--;
        } else {
          if (y < 0) {
            that._paddingTop = Math.min(that._paddingTop, y);
          }
          that.mapGlobal(d, y, edge);
          pointsList.push(that.timeline.mapDate[d] + "," + y);
        }
      }

      pointsList.push(targetX + "," + targetY);

      if (!that._polylineBySourceId[source.id]) {
        that._polylineBySourceId[source.id] = [];
      }
      that._polylineBySourceId[source.id].push(graph
        .append("polyline")
        .attr("points", pointsList.join(" "))
        .style("fill", "none")
        .style("stroke", color)
        .style("stroke-width", 1)
        .on("mouseover", function () {
          that.onMouseOver && that.onMouseOver(source, target);
        })
        .on("mouseout", function () {
          that.onMouseOut && that.onMouseOut(source, target);
        })
        .on("click", function () {
          that.onClick && that.onClick(source, target);
        })[0][0]);
    };

    /**
     * Draw tree for the node
     *
     * @param graph       svg graph element
     * @param node        the root node
     * @param sourceNode  previous element of the tree
     */
    Metro.prototype.drawTree = function (graph, node, sourceNode) {
      if (!this.mapNodes(node)) {
        var that = this,
          date = node._date,
          id = node.id,
          sameDayEdges = [],
          sameDayNodes = [],
          i, len, edge, targetNode, nodeEdges;

        nodeEdges = that.prepared._edgesGroupBySource[id] || [];

        if (that._unlinked || sourceNode || nodeEdges.length) {
          that.drawNode(graph, node, sourceNode);

          for (i = 0, len = nodeEdges.length; i < len; ++i) {
            edge = nodeEdges[i];
            // find source node
            targetNode = edge.trgNode;

            if (targetNode) {
              if (node.community !== targetNode.community) {
                if (!this.mapNodes(targetNode)) {
                  that._crossCommunityEdges.push(edge);
                  continue;
                }
              }
              if (targetNode._date.getTime() === date.getTime()) {
                sameDayEdges.push(edge);
                sameDayNodes.push(targetNode);
              } else {
                that.drawTree(graph, targetNode, node);
                that.drawEdge(graph, edge);
              }
            }
          }

          for (i = 0, len = sameDayEdges.length; i < len; ++i) {
            edge = sameDayEdges[i];
            that.drawTree(graph, edge.trgNode, node);
            that.drawEdge(graph, edge);
          }
        }
      }
    };

    /**
     * Append metro graph into the element
     *
     * @param selector  jQuery selector
     * @param config    Configuration object
     */
    Metro.prototype.appendTo = function (selector, config) {
      var that = this,
        container = $("<div class='dvContainer'>")
          .append("<div class='dvBody'>")
          .append("<div class='dvAgenda'>"),
        body = container.find(".dvBody")
          .append("<div class='dvBodyTimeline'>")
          .append("<div class='dvBodyGraph'>"),
        agendaHolder = container.find(".dvAgenda"),
        progress = new Progress(container),
        agenda = new Agenda(container.find(agendaHolder), that._minSize, that._pixel);

      that.config(config);
      that.prepared = new Prepare(that);

      if (that._config.agenda === false) {
        agendaHolder.hide();
      }

      that.tooltip = new Tooltip(container.find(".dvBodyGraph"), that);
      that.timeline = new Timeline(
        container.find(".dvBodyTimeline"), that.prepared._sday, that.prepared._eday, that._pixel,
        that._config.dateFormatView
      );

      that._svg = d3.select(body.find(".dvBodyGraph")[0]).append("svg");
      $(selector).append(container);

      that._mapNodes = {};
      that._mapEdges = {};
      that._mapGlobal = {};
      that._shapeBySourceId = {};
      that._polylineBySourceId = {};
      that._crossCommunityEdges = [];
      that._communityConfig = {};

      that._svg
        .attr("width", that.timeline.width)
        .attr("height", container.height());

      /**
       * The sequential solution was replaced with asynchronous callback solution
       * due to performance problem
       *
       * Sequential solution:
       * for community from communities
       *   for each node from community
       *     draw tree
       */
      that.async(function () {
        var drawCommunityIntern, drawNodeIntern,
          currentValue = 0,
          communityIndex = 0,
          colors = that._config.colors,
          symbols = that._config.symbols,
          maxValue = that.prepared._nodes.length,

          dgraph = that._svg
            .append("g"),
          nodesGroupByCommunity = that.prepared._nodesGroupByCommunity,
          communityNames = Object.keys(nodesGroupByCommunity);

        drawCommunityIntern = function () {
          that.async(function () {
            var communityName = communityNames.shift(), communityConfig,
              nodes = nodesGroupByCommunity[communityName].reverse(),
              nodesLength = nodes.length,
              lastPercentValue = 0;
            drawNodeIntern = function () {
              if (nodes.length) {
                that.async(function () {
                  that.drawTree(dgraph, nodes.shift());
                  currentValue = currentValue + (nodesLength - nodes.length);
                  if (lastPercentValue < parseInt(currentValue / maxValue * 100, 10)) {
                    lastPercentValue = parseInt(currentValue / maxValue * 100, 10);
                    progress.set(lastPercentValue);
                  }
                  nodesLength = nodes.length;

                  dgraph.attr(
                    "transform",
                    "translate(0," + ( -that._paddingTop) + ")");
                  that._svg.attr("height", that.getMaxPointY() + that._paddingTop * -1 + 50);
                  drawNodeIntern();
                });

              } else {
                if (communityNames.length) {
                  drawCommunityIntern();
                } else {
                  var crossCommunityEdges = that._crossCommunityEdges;
                  while (crossCommunityEdges.length) {
                    that.drawEdge(dgraph, crossCommunityEdges.shift());
                  }
                  progress.ready();
                }
              }
            };


            that._communityConfig[communityName] = communityConfig = {
              color: colors[communityIndex % colors.length],
              symbol: symbols[communityIndex % symbols.length]
            };
            // disable agenda logic
            if (that._config.agenda !== false) {
              agenda.add(communityConfig.color, communityConfig.symbol, communityName);
              body.css("bottom", agenda.heigth);
            }
            communityIndex++;
            drawNodeIntern();
          });
        };

        drawCommunityIntern();
      });
    };
  })(window.jQuery, window.d3);

  DV = function (nodes, edges, community) {
    return new Metro(nodes, edges, community);
  };
  DV.metro = DV;
  window.DV = DV;
})(window, window.d3);
