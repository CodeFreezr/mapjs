/*global document, window, require, module */
require('./create-node');
const jQuery = require('jquery'),
	_ = require('underscore'),
	cleanDOMId = require('../core/util/clean-dom-id'),
	DOMRender = require('./dom-render'),
	createSVG = require('./create-svg'),
	connectorKey = function (connectorObj) {
		'use strict';
		return cleanDOMId('connector_' + connectorObj.from + '_' + connectorObj.to);
	},
	linkKey = function (linkObj) {
		'use strict';
		return cleanDOMId('link_' + linkObj.ideaIdFrom + '_' + linkObj.ideaIdTo);
	};


require('./hammer-draggable');
require('./node-resize-widget');
require('./update-connector');
require('./update-link');
require('./get-box');
require('./get-data-box');
require('./node-with-id');
require('./update-node-content');
require('./set-theme-class-list');



jQuery.fn.animateConnectorToPosition = function (animationOptions, tolerance) {
	'use strict';
	const element = jQuery(this),
		shapeFrom = element.data('nodeFrom'),
		shapeTo = element.data('nodeTo'),
		fromBox = shapeFrom && shapeFrom.getDataBox(),
		toBox = shapeTo && shapeTo.getDataBox(),
		oldBox = {
			from: shapeFrom && shapeFrom.getBox(),
			to: shapeTo && shapeTo.getBox()
		};
	tolerance = tolerance || 1;
	if (fromBox && toBox && oldBox && oldBox.from.width === fromBox.width &&
		oldBox.to.width   === toBox.width   &&
		oldBox.from.height  === fromBox.height    &&
		oldBox.to.height  === toBox.height    &&
		Math.abs(oldBox.from.top - oldBox.to.top - (fromBox.top - toBox.top)) < tolerance &&
		Math.abs(oldBox.from.left - oldBox.to.left - (fromBox.left - toBox.left)) < tolerance) {

		element.animate({
			left: Math.round(Math.min(fromBox.left, toBox.left)),
			top: Math.round(Math.min(fromBox.top, toBox.top))
		}, animationOptions);
		return true;
	}
	return false;
};
jQuery.fn.queueFadeOut = function (options) {
	'use strict';
	const element = this;
	return element.fadeOut(_.extend({
		complete: function () {
			if (element.is(':focus')) {
				element.parents('[tabindex]').focus();
			}
			element.remove();
		}
	}, options));
};
jQuery.fn.queueFadeIn = function (options) {
	'use strict';
	const element = this;
	return element
		.css('opacity', 0)
		.animate(
			{'opacity': 1},
			_.extend({ complete: function () {
				element.css('opacity', '');
			}}, options)
		);
};


jQuery.fn.updateStage = function () {
	'use strict';
	const data = this.data(),
		size = {
			'min-width': Math.round(data.width - data.offsetX),
			'min-height': Math.round(data.height - data.offsetY),
			'width': Math.round(data.width - data.offsetX),
			'height': Math.round(data.height - data.offsetY),
			'transform-origin': 'top left',
			'transform': 'translate3d(' + Math.round(data.offsetX) + 'px, ' + Math.round(data.offsetY) + 'px, 0)'
		},
		svgContainer = this.find('[data-mapjs-role=svg-container]')[0];
	if (data.scale && data.scale !== 1) {
		size.transform = 'scale(' + data.scale + ') translate(' + Math.round(data.offsetX) + 'px, ' + Math.round(data.offsetY) + 'px)';
	}
	this.css(size);
	if (svgContainer) {
		svgContainer.setAttribute('viewBox',
			'' + Math.round(-1 * data.offsetX) + ' ' +  Math.round(-1 * data.offsetY) + ' ' + Math.round(data.width) + ' ' + Math.round(data.height)
		);
		svgContainer.setAttribute('style',
			'top:' + Math.round(-1 * data.offsetY) + 'px; ' +
			'left:' + Math.round(-1 * data.offsetX) + 'px; ' +
			'width:' +  Math.round(data.width) + 'px; ' +
			'height:' +  Math.round(data.height) + 'px;'
		);
	}
	return this;
};


jQuery.fn.placeCaretAtEnd = function () {
	'use strict';
	const el = this[0];
	let range, sel, textRange;
	if (window.getSelection && document.createRange) {
		range = document.createRange();
		range.selectNodeContents(el);
		range.collapse(false);
		sel = window.getSelection();
		sel.removeAllRanges();
		sel.addRange(range);
	} else if (document.body.createTextRange) {
		textRange = document.body.createTextRange();
		textRange.moveToElementText(el);
		textRange.collapse(false);
		textRange.select();
	}
};
jQuery.fn.selectAll = function () {
	'use strict';
	const el = this[0];
	let range, sel, textRange;
	if (window.getSelection && document.createRange) {
		range = document.createRange();
		range.selectNodeContents(el);
		sel = window.getSelection();
		sel.removeAllRanges();
		sel.addRange(range);
	} else if (document.body.createTextRange) {
		textRange = document.body.createTextRange();
		textRange.moveToElementText(el);
		textRange.select();
	}
};
jQuery.fn.innerText = function () {
	'use strict';
	const htmlContent = this.html(),
		containsBr = /<br\/?>/.test(htmlContent),
		containsDiv = /<div>/.test(htmlContent);
	if (containsDiv && this[0].innerText) { /* broken safari jquery text */
		return this[0].innerText.trim();
	} else if (containsBr) { /*broken firefox innerText */
		return htmlContent.replace(/<br\/?>/gi, '\n').replace(/(<([^>]+)>)/gi, '');
	}
	return this.text();
};
jQuery.fn.editNode = function (shouldSelectAll) {
	'use strict';
	const node = this,
		textBox = this.find('[data-mapjs-role=title]'),
		unformattedText = this.data('title'),
		originalText = textBox.text(),
		result = jQuery.Deferred(),
		clear = function () {
			detachListeners(); //eslint-disable-line no-use-before-define
			textBox.css('word-break', '');
			textBox.removeAttr('contenteditable');
			node.shadowDraggable();
		},
		finishEditing = function () {
			const content = textBox.innerText();
			if (content === unformattedText) {
				return cancelEditing(); //eslint-disable-line no-use-before-define
			}
			clear();
			result.resolve(content);
		},
		cancelEditing = function () {
			clear();
			textBox.text(originalText);
			result.reject();
		},
		keyboardEvents = function (e) {
			const ENTER_KEY_CODE = 13,
				ESC_KEY_CODE = 27,
				TAB_KEY_CODE = 9,
				S_KEY_CODE = 83,
				Z_KEY_CODE = 90;
			if (e.shiftKey && e.which === ENTER_KEY_CODE) {
				return; // allow shift+enter to break lines
			} else if (e.which === ENTER_KEY_CODE) {
				finishEditing();
				e.stopPropagation();
			} else if (e.which === ESC_KEY_CODE) {
				cancelEditing();
				e.stopPropagation();
			} else if (e.which === TAB_KEY_CODE || (e.which === S_KEY_CODE && (e.metaKey || e.ctrlKey) && !e.altKey)) {
				finishEditing();
				e.preventDefault(); /* stop focus on another object */
			} else if (!e.shiftKey && e.which === Z_KEY_CODE && (e.metaKey || e.ctrlKey) && !e.altKey) { /* undo node edit on ctrl+z if text was not changed */
				if (textBox.text() === unformattedText) {
					cancelEditing();
				}
				e.stopPropagation();
			}
		},
		attachListeners = function () {
			textBox.on('blur', finishEditing).on('keydown', keyboardEvents);
		},
		detachListeners = function () {
			textBox.off('blur', finishEditing).off('keydown', keyboardEvents);
		};
	attachListeners();
	if (unformattedText !== originalText) { /* links or some other potential formatting issues */
		textBox.css('word-break', 'break-all');
	}
	textBox.text(unformattedText).attr('contenteditable', true).focus();
	if (shouldSelectAll) {
		textBox.selectAll();
	} else if (unformattedText) {
		textBox.placeCaretAtEnd();
	}
	node.shadowDraggable({disable: true});
	return result.promise();
};
jQuery.fn.updateReorderBounds = function (border, box, dropCoords) {
	'use strict';
	const element = this;
	if (!border) {
		element.hide();
		return;
	}
	element.show();
	element.attr('mapjs-edge', border.edge);
	if (border.edge === 'top') {
		element.css({
			top: border.minY,
			left: Math.round(dropCoords.x - element.width() / 2)
		});
	} else {
		element.css({
			top: Math.round(dropCoords.y - element.height() / 2),
			left: border.x - (border.edge === 'left' ? element.width() : 0)
		});
	}

};

jQuery.fn.createConnector = function (connector) {
	'use strict';
	const stage = this.parent('[data-mapjs-role=stage]');
	return createSVG('g')
		.attr({'id': connectorKey(connector), 'data-mapjs-role': 'connector'})
		.data({'nodeFrom': stage.nodeWithId(connector.from), 'nodeTo': stage.nodeWithId(connector.to), attr: connector.attr})
		.appendTo(this);
};
jQuery.fn.createLink = function (l) {
	'use strict';
	const stage = this.parent('[data-mapjs-role=stage]');
	return createSVG('g')
		.attr({
			'id': linkKey(l),
			'data-mapjs-role': 'link'
		})
		.data({
			'nodeFrom': stage.nodeWithId(l.ideaIdFrom),
			'nodeTo': stage.nodeWithId(l.ideaIdTo),
			attr: l.attr && l.attr.style
		})
		.appendTo(this);
};


jQuery.fn.findLine = function (line) {
	'use strict';
	if (line && line.type === 'connector') {
		return this.find('#' + connectorKey(line));
	} else if (line && line.type === 'link') {
		return this.find('#' + linkKey(line));
	}
	console.log('invalid.line', line); //eslint-disable-line
	throw 'invalid-args';
};
jQuery.fn.createReorderBounds = function () {
	'use strict';
	const result = jQuery('<div>').attr({
		'data-mapjs-role': 'reorder-bounds',
		'class': 'mapjs-reorder-bounds'
	}).hide().css('position', 'absolute').appendTo(this);
	return result;
};

module.exports = function domMapViewController(mapModel, stageElement, touchEnabled, imageInsertController, resourceTranslator, options) {
	'use strict';
	let currentDroppable = false,
		connectorsForAnimation = jQuery(),
		linksForAnimation = jQuery(),
		viewPortDimensions;

	const viewPort = stageElement.parent(),
		nodeAnimOptions = { duration: 400, queue: 'nodeQueue', easing: 'linear' },
		reorderBounds = mapModel.isEditingEnabled() ? stageElement.createReorderBounds() : jQuery('<div>'),
		getViewPortDimensions = function () {
			if (viewPortDimensions) {
				return viewPortDimensions;
			}
			viewPortDimensions =  {
				left: viewPort.scrollLeft(),
				top: viewPort.scrollTop(),
				innerWidth: viewPort.innerWidth(),
				innerHeight: viewPort.innerHeight()
			};
			return viewPortDimensions;
		},
		stageToViewCoordinates = function (x, y) {
			const stage = stageElement.data(),
				scrollPosition = getViewPortDimensions();
			return {
				x: stage.scale * (x + stage.offsetX) - scrollPosition.left,
				y: stage.scale * (y + stage.offsetY) - scrollPosition.top
			};
		},
		viewToStageCoordinates = function (x, y) {
			const stage = stageElement.data(),
				scrollPosition = getViewPortDimensions();
			return {
				x: (scrollPosition.left + x) / stage.scale - stage.offsetX,
				y: (scrollPosition.top + y) / stage.scale - stage.offsetY
			};
		},
		updateScreenCoordinates = function () {
			const element = jQuery(this);
			element.css({
				'left': element.data('x'),
				'top': element.data('y')
			}).trigger('mapjs:move');
		},
		animateToPositionCoordinates = function () {
			const element = jQuery(this);
			element.clearQueue(nodeAnimOptions.queue).animate({
				'left': element.data('x'),
				'top': element.data('y'),
				'opacity': 1 /* previous animation can be cancelled with clearqueue, so ensure it gets visible */
			}, _.extend({
				complete: function () {
					element.css('opacity', '');
					element.each(updateScreenCoordinates);
				}
			}, nodeAnimOptions)).trigger('mapjs:animatemove');
		},
		ensureSpaceForPoint = function (x, y) {/* in stage coordinates */
			const stage = stageElement.data();
			let dirty = false;
			if (x < -1 * stage.offsetX) {
				stage.width =  stage.width - stage.offsetX - x;
				stage.offsetX = -1 * x;
				dirty = true;
			}
			if (y < -1 * stage.offsetY) {
				stage.height = stage.height - stage.offsetY - y;
				stage.offsetY = -1 * y;
				dirty = true;
			}
			if (x > stage.width - stage.offsetX) {
				stage.width = stage.offsetX + x;
				dirty = true;
			}
			if (y > stage.height - stage.offsetY) {
				stage.height = stage.offsetY + y;
				dirty = true;
			}
			if (dirty) {
				stageElement.updateStage();
			}
		},
		ensureSpaceForNode = function () {
			return jQuery(this).each(function () {
				const node = jQuery(this).data(),
					margin = DOMRender.stageMargin || {top: 0, left: 0, bottom: 0, right: 0};
				/* sequence of calculations is important because maxX and maxY take into consideration the new offsetX snd offsetY */
				ensureSpaceForPoint(node.x - margin.left, node.y - margin.top);
				ensureSpaceForPoint(node.x + node.width + margin.right, node.y + node.height + margin.bottom);
			});
		},
		centerViewOn = function (x, y, animate) { /*in the stage coordinate system*/
			const stage = stageElement.data(),
				viewPortCenter = {
					x: Math.round(viewPort.innerWidth() / 2),
					y: Math.round(viewPort.innerHeight() / 2)
				},
				margin = DOMRender.stageVisibilityMargin || {top: 0, left: 0, bottom: 0, right: 0};
			let newLeftScroll = false, newTopScroll = false;

			ensureSpaceForPoint(x - viewPortCenter.x / stage.scale, y - viewPortCenter.y / stage.scale);
			ensureSpaceForPoint(x + viewPortCenter.x / stage.scale - margin.left, y + viewPortCenter.y / stage.scale - margin.top);

			newLeftScroll = stage.scale * (x + stage.offsetX) - viewPortCenter.x;
			newTopScroll = stage.scale * (y + stage.offsetY) - viewPortCenter.y;
			viewPort.finish();
			if (animate) {
				viewPort.animate({
					scrollLeft: newLeftScroll,
					scrollTop: newTopScroll
				}, {
					duration: 400
				});
			} else {
				viewPort.scrollLeft(newLeftScroll);
				viewPort.scrollTop(newTopScroll);
			}
		},
		centerViewOnNode = function (ideaId, animate) {
			const node = stageElement.nodeWithId(ideaId).data(),
				nodeCenterX = Math.round(node.x + node.width / 2),
				nodeCenterY = Math.round(node.y + node.height / 2);
			centerViewOn(nodeCenterX, nodeCenterY, animate);
		},
		stagePointAtViewportCenter = function () {
			return viewToStageCoordinates(Math.round(viewPort.innerWidth() / 2), Math.round(viewPort.innerHeight() / 2));
		},
		ensureNodeVisible = function (domElement) {
			if (!domElement || domElement.length === 0) {
				return;
			}
			viewPort.finish();
			const node = domElement.data(),
				nodeTopLeft = stageToViewCoordinates(node.x, node.y),
				nodeBottomRight = stageToViewCoordinates(node.x + node.width, node.y + node.height),
				animation = {},
				margin = DOMRender.stageVisibilityMargin || {top: 10, left: 10, bottom: 10, right: 10};
			if ((nodeTopLeft.x - margin.left) < 0) {
				animation.scrollLeft = viewPort.scrollLeft() + nodeTopLeft.x - margin.left;
			} else if ((nodeBottomRight.x + margin.right) > viewPort.innerWidth()) {
				animation.scrollLeft = viewPort.scrollLeft() + nodeBottomRight.x - viewPort.innerWidth() + margin.right;
			}
			if ((nodeTopLeft.y - margin.top) < 0) {
				animation.scrollTop = viewPort.scrollTop() + nodeTopLeft.y - margin.top;
			} else if ((nodeBottomRight.y + margin.bottom) > viewPort.innerHeight()) {
				animation.scrollTop = viewPort.scrollTop() + nodeBottomRight.y - viewPort.innerHeight() + margin.bottom;
			}
			if (!_.isEmpty(animation)) {
				viewPort.animate(animation, {duration: 100});
			}
		},
		viewportCoordinatesForPointEvent = function (evt) {
			const dropPosition = (evt && evt.gesture && evt.gesture.center) || evt,
				vpOffset = viewPort.offset();
			let result;
			if (dropPosition) {
				result = {
					x: dropPosition.pageX - vpOffset.left,
					y: dropPosition.pageY -  vpOffset.top
				};
				if (result.x >= 0 && result.x <= viewPort.innerWidth() && result.y >= 0 && result.y <= viewPort.innerHeight()) {
					return result;
				}
			}
		},
		stagePositionForPointEvent = function (evt) {
			const viewportDropCoordinates = viewportCoordinatesForPointEvent(evt);
			if (viewportDropCoordinates) {
				return viewToStageCoordinates(viewportDropCoordinates.x, viewportDropCoordinates.y);
			}
		},
		clearCurrentDroppable = function () {
			if (currentDroppable || currentDroppable === false) {
				jQuery('.mapjs-node').removeClass('droppable');
				currentDroppable = undefined;
			}
		},
		showDroppable = function (nodeId) {
			stageElement.nodeWithId(nodeId).addClass('droppable');
			currentDroppable = nodeId;
		},
		withinReorderBoundary = function (boundaries, box) {
			const closeTo = function (reorderBoundary) {
				let nodeX = box.x;
				if (reorderBoundary.edge === 'right') {
					nodeX += box.width;
				}
				if (reorderBoundary.x && reorderBoundary.margin) {
					return Math.abs(nodeX - reorderBoundary.x) < reorderBoundary.margin * 2 &&
						box.y < reorderBoundary.maxY &&
						box.y > reorderBoundary.minY;
				} else {
					return box.y < reorderBoundary.maxY &&
						box.y > reorderBoundary.minY &&
						box.x < reorderBoundary.maxX &&
						box.x > reorderBoundary.minX;
				}
			};
			if (_.isEmpty(boundaries)) {
				return false;
			}
			if (!box) {
				return false;
			}
			return _.find(boundaries, closeTo);
		};
	viewPort.on('scroll', function () {
		viewPortDimensions = undefined;
	});
	if (imageInsertController) {
		imageInsertController.addEventListener('imageInserted', function (dataUrl, imgWidth, imgHeight, evt) {
			const point = stagePositionForPointEvent(evt);
			mapModel.dropImage(dataUrl, imgWidth, imgHeight, point && point.x, point && point.y);
		});
	}
	mapModel.addEventListener('nodeCreated', function (node) {
		let currentReorderBoundary;
		const element = stageElement.createNode(node)
			.queueFadeIn(nodeAnimOptions)
			.updateNodeContent(node, {resourceTranslator: resourceTranslator, theme: DOMRender.theme})
			.nodeResizeWidget(node.id, mapModel, stagePositionForPointEvent)
			.on('tap', function (evt) {

				const realEvent = (evt.gesture && evt.gesture.srcEvent) || evt;
				if (realEvent.button && realEvent.button !== -1) {
					return;
				}
				mapModel.clickNode(node.id, realEvent);
				if (evt) {
					evt.stopPropagation();
				}
				if (evt && evt.gesture) {
					evt.gesture.stopPropagation();
				}

			})
			.on('doubletap', function (event) {
				if (event) {
					event.stopPropagation();
					if (event.gesture) {
						event.gesture.stopPropagation();
					}
				}
				if (!mapModel.isEditingEnabled()) {
					mapModel.toggleCollapse('mouse');
					return;
				}
				mapModel.editNode('mouse');
			})
			.on('attachment-click', function () {
				mapModel.openAttachment('mouse', node.id);
			})
			.on('decoration-click', function (evt, decorationType) {
				mapModel.decorationAction('mouse', node.id, decorationType);
			})
			.each(ensureSpaceForNode)
			.each(updateScreenCoordinates)
			.on('mm:start-dragging mm:start-dragging-shadow', function (evt) {
				if (evt && evt.relatedTarget === this) {
					mapModel.selectNode(node.id);
					currentReorderBoundary = mapModel.getReorderBoundary(node.id);
					element.addClass('dragging');
				}
			})
			.on('mm:drag', function (evt) {
				const dropCoords = stagePositionForPointEvent(evt),
					currentPosition = evt.currentPosition && stagePositionForPointEvent({pageX: evt.currentPosition.left, pageY: evt.currentPosition.top}),
					hasShift = evt && evt.gesture && evt.gesture.srcEvent && evt.gesture.srcEvent.shiftKey,
					nodeId = dropCoords && mapModel.getNodeIdAtPosition(dropCoords.x, dropCoords.y);
				let border;
				if (!dropCoords) {
					clearCurrentDroppable();
					return;
				}


				if (!hasShift && !nodeId && currentPosition) {
					currentPosition.width = element.outerWidth();
					currentPosition.height = element.outerHeight();
					border = withinReorderBoundary(currentReorderBoundary, currentPosition);
					reorderBounds.updateReorderBounds(border, currentPosition, dropCoords);
				} else {
					reorderBounds.hide();
				}
				if (!nodeId || nodeId === node.id) {
					clearCurrentDroppable();
				} else if (nodeId !== currentDroppable) {
					clearCurrentDroppable();
					if (nodeId) {
						showDroppable(nodeId);
					}
				}
			})
			.on('contextmenu', function (event) {
				mapModel.selectNode(node.id);
				if (mapModel.requestContextMenu(event.pageX, event.pageY)) {
					event.preventDefault();
					return false;
				}
			})
			.on('mm:stop-dragging', function (evt) {
				element.removeClass('dragging');
				reorderBounds.hide();
				let dropResult, manualPosition;
				const isShift = evt && evt.gesture && evt.gesture.srcEvent && evt.gesture.srcEvent.shiftKey,
					stageDropCoordinates = stagePositionForPointEvent(evt),
					nodeAtDrop = stageDropCoordinates && mapModel.getNodeIdAtPosition(stageDropCoordinates.x, stageDropCoordinates.y),
					finalPosition = evt.finalPosition && stagePositionForPointEvent({pageX: evt.finalPosition.left, pageY: evt.finalPosition.top});

				clearCurrentDroppable();
				if (!stageDropCoordinates) {
					return;
				}

				if (nodeAtDrop && nodeAtDrop !== node.id) {
					dropResult = mapModel.dropNode(node.id, nodeAtDrop, !!isShift);
				} else {
					finalPosition.width = element.outerWidth();
					finalPosition.height = element.outerHeight();
					manualPosition = (!!isShift) || !withinReorderBoundary(currentReorderBoundary, finalPosition);
					if (manualPosition) {
						dropResult = mapModel.positionNodeAt(node.id, finalPosition.x, finalPosition.y, manualPosition);
					} else {
						dropResult = mapModel.positionNodeAt(node.id, stageDropCoordinates.x, stageDropCoordinates.y, manualPosition);
					}
				}
				return dropResult;
			})
			.on('mm:cancel-dragging', function () {
				clearCurrentDroppable();
				element.removeClass('dragging');
				reorderBounds.hide();
			}).on('mm:resize', function (event) {
				mapModel.setNodeWidth('mouse', node.id, event.nodeWidth);
			});
		if (touchEnabled) {
			element.on('hold', function (evt) {
				const realEvent = (evt.gesture && evt.gesture.srcEvent) || evt;
				mapModel.clickNode(node.id, realEvent);
				if (mapModel.requestContextMenu(evt.gesture.center.pageX, evt.gesture.center.pageY)) {
					evt.preventDefault();
					if (evt.gesture) {
						evt.gesture.preventDefault();
						evt.gesture.stopPropagation();
					}
					return false;
				}
			});
		}
		element.css('min-width', element.css('width'));
		if (mapModel.isEditingEnabled()) {
			element.shadowDraggable();
		}
	});
	mapModel.addEventListener('nodeSelectionChanged', function (ideaId, isSelected) {
		const node = stageElement.nodeWithId(ideaId);
		if (isSelected) {
			node.addClass('selected');
			ensureNodeVisible(node);
		} else {
			node.removeClass('selected');
		}
	});
	mapModel.addEventListener('nodeRemoved', function (node) {
		stageElement.nodeWithId(node.id).queueFadeOut(nodeAnimOptions);
	});
	mapModel.addEventListener('nodeMoved', function (node /*, reason*/) {
		const currentViewPortDimensions = getViewPortDimensions(),
			nodeDom = stageElement.nodeWithId(node.id).data({
				'x': Math.round(node.x),
				'y': Math.round(node.y),
				'width': Math.round(node.width),
				'height': Math.round(node.height)
			}).each(ensureSpaceForNode),
			screenTopLeft = stageToViewCoordinates(Math.round(node.x), Math.round(node.y)),
			screenBottomRight = stageToViewCoordinates(Math.round(node.x + node.width), Math.round(node.y + node.height));
		if (screenBottomRight.x < 0 || screenBottomRight.y < 0 || screenTopLeft.x > currentViewPortDimensions.innerWidth || screenTopLeft.y > currentViewPortDimensions.innerHeight) {
			nodeDom.each(updateScreenCoordinates);
		} else {
			nodeDom.each(animateToPositionCoordinates);
		}
	});
	mapModel.addEventListener('nodeTitleChanged nodeAttrChanged nodeLabelChanged', function (n) {
		stageElement.nodeWithId(n.id).updateNodeContent(n, { resourceTranslator: resourceTranslator, theme: DOMRender.theme});
	});
	mapModel.addEventListener('connectorCreated', function (connector) {
		const element = stageElement.find('[data-mapjs-role=svg-container]')
			.createConnector(connector).updateConnector({canUseData: true, theme: DOMRender.theme});
		stageElement.nodeWithId(connector.from).add(stageElement.nodeWithId(connector.to))
			.on('mapjs:move', function () {
				element.updateConnector({canUseData: true, theme: DOMRender.theme});
			})
			.on('mapjs:resize', function () {
				element.updateConnector({canUseData: true, theme: DOMRender.theme});
			})
			.on('mm:drag', function () {
				element.updateConnector({theme: DOMRender.theme});
			})
			.on('mapjs:animatemove', function () {
				connectorsForAnimation = connectorsForAnimation.add(element);
			});
		element.on('tap', function (event) {
			if (event.target && event.target.tagName === 'text') {
				mapModel.lineLabelClicked(connector);
			} else {
				mapModel.selectConnector('mouse', connector,
					event && event.gesture && event.gesture.center &&
						{ x: event.gesture.center.pageX, y: event.gesture.center.pageY }
				);
			}
			event.gesture && event.gesture.stopPropagation && event.gesture.stopPropagation();
			event.stopPropagation();
		});
	});
	mapModel.addEventListener('connectorRemoved', function (connector) {
		stageElement.findLine(connector).remove();
	});
	mapModel.addEventListener('linkCreated', function (line) {
		const link = stageElement
			.find('[data-mapjs-role=svg-container]')
			.createLink(line).updateLink({theme: DOMRender.theme});
		link.on('tap', function (event) {
			if (event.target && event.target.tagName === 'text') {
				mapModel.lineLabelClicked(line);
			} else {
				mapModel.selectLink('mouse', line, { x: event.gesture.center.pageX, y: event.gesture.center.pageY });
			}
			event.stopPropagation();
			event.gesture.stopPropagation();
		});
		stageElement.nodeWithId(line.ideaIdFrom).add(stageElement.nodeWithId(line.ideaIdTo))
			.on('mapjs:move mm:drag', function () {
				link.updateLink({theme: DOMRender.theme});
			})
			.on('mapjs:animatemove', function () {
				linksForAnimation = linksForAnimation.add(link);
			});
	});
	mapModel.addEventListener('linkRemoved', function (l) {
		stageElement.findLine(l).remove();
	});
	mapModel.addEventListener('mapScaleChanged', function (scaleMultiplier /*, zoomPoint */) {
		const currentScale = stageElement.data('scale'),
			targetScale = Math.max(Math.min(currentScale * scaleMultiplier, 5), 0.2),
			currentCenter = stagePointAtViewportCenter();
		if (currentScale === targetScale) {
			return;
		}
		stageElement.data('scale', targetScale).updateStage();
		centerViewOn(currentCenter.x, currentCenter.y);
	});
	mapModel.addEventListener('nodeVisibilityRequested', function (ideaId) {
		const id = ideaId || mapModel.getCurrentlySelectedIdeaId(),
			node = stageElement.nodeWithId(id);
		if (node) {
			ensureNodeVisible(node);
			viewPort.finish();
		}

	});
	mapModel.addEventListener('nodeFocusRequested', function (ideaId) {
		if (stageElement.data('scale') !== 1) {
			stageElement.data('scale', 1).updateStage();
		}
		centerViewOnNode(ideaId, true);
	});
	mapModel.addEventListener('mapViewResetRequested', function () {
		stageElement.data({'scale': 1, 'height': 0, 'width': 0, 'offsetX': 0, 'offsetY': 0}).updateStage();
		stageElement.children().andSelf().finish(nodeAnimOptions.queue);
		jQuery(stageElement).find('.mapjs-node').each(ensureSpaceForNode);
		jQuery(stageElement).find('[data-mapjs-role=connector]').updateConnector({canUseData: true, theme: DOMRender.theme});
		jQuery(stageElement).find('[data-mapjs-role=link]').updateLink({theme: DOMRender.theme});
		centerViewOnNode(mapModel.getCurrentlySelectedIdeaId());
		viewPort.focus();
	});
	mapModel.addEventListener('layoutChangeStarting', function () {
		viewPortDimensions = undefined;
		stageElement.children().finish(nodeAnimOptions.queue);
		stageElement.finish(nodeAnimOptions.queue);
	});
	mapModel.addEventListener('layoutChangeComplete', function (options) {
		let connectorGroupClone = jQuery(), linkGroupClone = jQuery();
		if (options && options.themeChanged) {
			stageElement.children().andSelf().finish(nodeAnimOptions.queue);
			jQuery(stageElement).find('[data-mapjs-role=connector]').updateConnector({canUseData: true, theme: DOMRender.theme});
			jQuery(stageElement).find('[data-mapjs-role=link]').updateLink({theme: DOMRender.theme, canUseData: true});
		} else {
			connectorsForAnimation.each(function () {
				if (!jQuery(this).animateConnectorToPosition(nodeAnimOptions, 2)) {
					connectorGroupClone = connectorGroupClone.add(this);
				}
			});
			linksForAnimation.each(function () {
				if (!jQuery(this).animateConnectorToPosition(nodeAnimOptions, 2)) {
					linkGroupClone = linkGroupClone.add(this);
				}
			});
			stageElement.animate({'opacity': 1}, _.extend({
				progress: function () {
					connectorGroupClone.updateConnector({theme: DOMRender.theme});
					linkGroupClone.updateLink({theme: DOMRender.theme});
				},
				complete: function () {
					connectorGroupClone.updateConnector({canUseData: true, theme: DOMRender.theme});
					linkGroupClone.updateLink({theme: DOMRender.theme, canUseData: true});
				}
			}, nodeAnimOptions));
			stageElement.children().dequeue(nodeAnimOptions.queue);
			stageElement.dequeue(nodeAnimOptions.queue);
		}
		connectorsForAnimation = jQuery();
		linksForAnimation = jQuery();

		ensureNodeVisible(stageElement.nodeWithId(mapModel.getCurrentlySelectedIdeaId()));
	});

	/* editing */
	if (!options || !options.inlineEditingDisabled) {
		mapModel.addEventListener('nodeEditRequested', function (nodeId, shouldSelectAll, editingNew) {
			const editingElement = stageElement.nodeWithId(nodeId);
			mapModel.setInputEnabled(false);
			viewPort.finish(); /* close any pending animations */
			editingElement.editNode(shouldSelectAll).done(
				function (newText) {
					mapModel.setInputEnabled(true);
					mapModel.updateTitle(nodeId, newText, editingNew);
					editingElement.focus();

				}).fail(function () {
					mapModel.setInputEnabled(true);
					if (editingNew) {
						mapModel.undo('internal');
					}
					editingElement.focus();
				});
		});
	}
	mapModel.addEventListener('addLinkModeToggled', function (isOn) {
		if (isOn) {
			stageElement.addClass('mapjs-add-link');
		} else {
			stageElement.removeClass('mapjs-add-link');
		}
	});
	mapModel.addEventListener('linkAttrChanged', function (l) {
		stageElement.findLine(l).data('attr', (l.attr && l.attr.style) || {}).updateLink({theme: DOMRender.theme});
	});
	mapModel.addEventListener('connectorAttrChanged', function (connector) {
		stageElement.findLine(connector).data('attr', connector.attr || false).updateConnector({canUseData: true, theme: DOMRender.theme});
	});
	mapModel.addEventListener('activatedNodesChanged', function (activatedNodes, deactivatedNodes) {
		_.each(activatedNodes, function (nodeId) {
			stageElement.nodeWithId(nodeId).addClass('activated');
		});
		_.each(deactivatedNodes, function (nodeId) {
			stageElement.nodeWithId(nodeId).removeClass('activated');
		});
	});
};

