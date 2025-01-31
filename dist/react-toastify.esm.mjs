import React, { isValidElement, useRef, useLayoutEffect, useEffect, cloneElement, useReducer, useState, forwardRef } from 'react';
import cx from 'clsx';

function isNum(v) {
  return typeof v === 'number' && !isNaN(v);
}
function isBool(v) {
  return typeof v === 'boolean';
}
function isStr(v) {
  return typeof v === 'string';
}
function isFn(v) {
  return typeof v === 'function';
}
function parseClassName(v) {
  return isStr(v) || isFn(v) ? v : null;
}
function isToastIdValid(toastId) {
  return toastId != null;
}
function getAutoCloseDelay(toastAutoClose, containerAutoClose) {
  return toastAutoClose === false || isNum(toastAutoClose) && toastAutoClose > 0 ? toastAutoClose : containerAutoClose;
}
function canBeRendered(content) {
  return isValidElement(content) || isStr(content) || isFn(content) || isNum(content);
}

const POSITION = {
  TOP_LEFT: 'top-left',
  TOP_RIGHT: 'top-right',
  TOP_CENTER: 'top-center',
  BOTTOM_LEFT: 'bottom-left',
  BOTTOM_RIGHT: 'bottom-right',
  BOTTOM_CENTER: 'bottom-center'
};
const TYPE = {
  INFO: 'info',
  SUCCESS: 'success',
  WARNING: 'warning',
  ERROR: 'error',
  DEFAULT: 'default'
};

/**
 * Used to collapse toast after exit animation
 */
function collapseToast(node, done, duration
/* Default.COLLAPSE_DURATION */
) {
  if (duration === void 0) {
    duration = 300;
  }

  const {
    scrollHeight,
    style
  } = node;
  requestAnimationFrame(() => {
    style.minHeight = 'initial';
    style.height = scrollHeight + 'px';
    style.transition = "all " + duration + "ms";
    requestAnimationFrame(() => {
      style.height = '0';
      style.padding = '0';
      style.margin = '0';
      setTimeout(done, duration);
    });
  });
}

/**
 * Css animation that just work.
 * You could use animate.css for instance
 *
 *
 * ```
 * cssTransition({
 *   enter: "animate__animated animate__bounceIn",
 *   exit: "animate__animated animate__bounceOut"
 * })
 * ```
 *
 */

function cssTransition(_ref) {
  let {
    enter,
    exit,
    appendPosition = false,
    collapse = true,
    collapseDuration = 300
    /* Default.COLLAPSE_DURATION */

  } = _ref;
  return function ToastTransition(_ref2) {
    let {
      children,
      position,
      preventExitTransition,
      done,
      nodeRef,
      isIn
    } = _ref2;
    const enterClassName = appendPosition ? enter + "--" + position : enter;
    const exitClassName = appendPosition ? exit + "--" + position : exit;
    const animationStep = useRef(0
    /* AnimationStep.Enter */
    );
    useLayoutEffect(() => {
      const node = nodeRef.current;
      const classToToken = enterClassName.split(' ');

      const onEntered = e => {
        if (e.target !== nodeRef.current) return;
        node.dispatchEvent(new Event("d"
        /* SyntheticEvent.ENTRANCE_ANIMATION_END */
        ));
        node.removeEventListener('animationend', onEntered);
        node.removeEventListener('animationcancel', onEntered);

        if (animationStep.current === 0
        /* AnimationStep.Enter */
        && e.type !== 'animationcancel') {
          node.classList.remove(...classToToken);
        }
      };

      const onEnter = () => {
        node.classList.add(...classToToken);
        node.addEventListener('animationend', onEntered);
        node.addEventListener('animationcancel', onEntered);
      };

      onEnter();
    }, []);
    useEffect(() => {
      const node = nodeRef.current;

      const onExited = () => {
        node.removeEventListener('animationend', onExited);
        collapse ? collapseToast(node, done, collapseDuration) : done();
      };

      const onExit = () => {
        animationStep.current = 1
        /* AnimationStep.Exit */
        ;
        node.className += " " + exitClassName;
        node.addEventListener('animationend', onExited);
      };

      if (!isIn) preventExitTransition ? onExited() : onExit();
    }, [isIn]);
    return React.createElement(React.Fragment, null, children);
  };
}

function toToastItem(toast, status) {
  return {
    content: toast.content,
    containerId: toast.props.containerId,
    id: toast.props.toastId,
    theme: toast.props.theme,
    type: toast.props.type,
    data: toast.props.data || {},
    isLoading: toast.props.isLoading,
    icon: toast.props.icon,
    status
  };
}

const eventManager = {
  list: new Map(),
  emitQueue: new Map(),

  on(event, callback) {
    this.list.has(event) || this.list.set(event, []);
    this.list.get(event).push(callback);
    return this;
  },

  off(event, callback) {
    if (callback) {
      const cb = this.list.get(event).filter(cb => cb !== callback);
      this.list.set(event, cb);
      return this;
    }

    this.list.delete(event);
    return this;
  },

  cancelEmit(event) {
    const timers = this.emitQueue.get(event);

    if (timers) {
      timers.forEach(clearTimeout);
      this.emitQueue.delete(event);
    }

    return this;
  },

  /**
   * Enqueue the event at the end of the call stack
   * Doing so let the user call toast as follow:
   * toast('1')
   * toast('2')
   * toast('3')
   * Without setTimemout the code above will not work
   */
  emit(event) {
    this.list.has(event) && this.list.get(event).forEach(callback => {
      const timer = setTimeout(() => {
        // @ts-ignore
        callback(...[].slice.call(arguments, 1));
      }, 0);
      this.emitQueue.has(event) || this.emitQueue.set(event, []);
      this.emitQueue.get(event).push(timer);
    });
  }

};

const Svg = _ref => {
  let {
    theme,
    type,
    ...rest
  } = _ref;
  return React.createElement("svg", {
    viewBox: "0 0 24 24",
    width: "100%",
    height: "100%",
    fill: theme === 'colored' ? 'currentColor' : "var(--toastify-icon-color-" + type + ")",
    ...rest
  });
};

function Warning(props) {
  return React.createElement(Svg, { ...props
  }, React.createElement("path", {
    d: "M23.32 17.191L15.438 2.184C14.728.833 13.416 0 11.996 0c-1.42 0-2.733.833-3.443 2.184L.533 17.448a4.744 4.744 0 000 4.368C1.243 23.167 2.555 24 3.975 24h16.05C22.22 24 24 22.044 24 19.632c0-.904-.251-1.746-.68-2.44zm-9.622 1.46c0 1.033-.724 1.823-1.698 1.823s-1.698-.79-1.698-1.822v-.043c0-1.028.724-1.822 1.698-1.822s1.698.79 1.698 1.822v.043zm.039-12.285l-.84 8.06c-.057.581-.408.943-.897.943-.49 0-.84-.367-.896-.942l-.84-8.065c-.057-.624.25-1.095.779-1.095h1.91c.528.005.84.476.784 1.1z"
  }));
}

function Info(props) {
  return React.createElement(Svg, { ...props
  }, React.createElement("path", {
    d: "M12 0a12 12 0 1012 12A12.013 12.013 0 0012 0zm.25 5a1.5 1.5 0 11-1.5 1.5 1.5 1.5 0 011.5-1.5zm2.25 13.5h-4a1 1 0 010-2h.75a.25.25 0 00.25-.25v-4.5a.25.25 0 00-.25-.25h-.75a1 1 0 010-2h1a2 2 0 012 2v4.75a.25.25 0 00.25.25h.75a1 1 0 110 2z"
  }));
}

function Success(props) {
  return React.createElement(Svg, { ...props
  }, React.createElement("path", {
    d: "M12 0a12 12 0 1012 12A12.014 12.014 0 0012 0zm6.927 8.2l-6.845 9.289a1.011 1.011 0 01-1.43.188l-4.888-3.908a1 1 0 111.25-1.562l4.076 3.261 6.227-8.451a1 1 0 111.61 1.183z"
  }));
}

function Error(props) {
  return React.createElement(Svg, { ...props
  }, React.createElement("path", {
    d: "M11.983 0a12.206 12.206 0 00-8.51 3.653A11.8 11.8 0 000 12.207 11.779 11.779 0 0011.8 24h.214A12.111 12.111 0 0024 11.791 11.766 11.766 0 0011.983 0zM10.5 16.542a1.476 1.476 0 011.449-1.53h.027a1.527 1.527 0 011.523 1.47 1.475 1.475 0 01-1.449 1.53h-.027a1.529 1.529 0 01-1.523-1.47zM11 12.5v-6a1 1 0 012 0v6a1 1 0 11-2 0z"
  }));
}

function Spinner() {
  return React.createElement("div", {
    className: "Toastify"
    /* Default.CSS_NAMESPACE */
    + "__spinner"
  });
}

const Icons = {
  info: Info,
  warning: Warning,
  success: Success,
  error: Error,
  spinner: Spinner
};

const maybeIcon = type => type in Icons;

function getIcon(_ref2) {
  let {
    theme,
    type,
    isLoading,
    icon
  } = _ref2;
  let Icon = null;
  const iconProps = {
    theme,
    type
  };

  if (icon === false) ; else if (isFn(icon)) {
    Icon = icon(iconProps);
  } else if (isValidElement(icon)) {
    Icon = cloneElement(icon, iconProps);
  } else if (isStr(icon) || isNum(icon)) {
    Icon = icon;
  } else if (isLoading) {
    Icon = Icons.spinner();
  } else if (maybeIcon(type)) {
    Icon = Icons[type](iconProps);
  }

  return Icon;
}

function useToastContainer(props) {
  const [, forceUpdate] = useReducer(x => x + 1, 0);
  const [toastIds, setToastIds] = useState([]);
  const containerRef = useRef(null);
  const toastToRender = useRef(new Map()).current;

  const isToastActive = id => toastIds.indexOf(id) !== -1;

  const instance = useRef({
    toastKey: 1,
    displayedToast: 0,
    count: 0,
    queue: [],
    props,
    containerId: null,
    isToastActive,
    getToast: id => toastToRender.get(id)
  }).current;
  useEffect(() => {
    instance.containerId = props.containerId;
    eventManager.cancelEmit(3
    /* Event.WillUnmount */
    ).on(0
    /* Event.Show */
    , buildToast).on(1
    /* Event.Clear */
    , toastId => containerRef.current && removeToast(toastId)).on(5
    /* Event.ClearWaitingQueue */
    , clearWaitingQueue).emit(2
    /* Event.DidMount */
    , instance);
    return () => {
      toastToRender.clear();
      eventManager.emit(3
      /* Event.WillUnmount */
      , instance);
    };
  }, []);
  useEffect(() => {
    instance.props = props;
    instance.isToastActive = isToastActive;
    instance.displayedToast = toastIds.length;
  });

  function clearWaitingQueue(_ref) {
    let {
      containerId
    } = _ref;
    const {
      limit
    } = instance.props;

    if (limit && (!containerId || instance.containerId === containerId)) {
      instance.count -= instance.queue.length;
      instance.queue = [];
    }
  }

  function removeToast(toastId) {
    setToastIds(state => isToastIdValid(toastId) ? state.filter(id => id !== toastId) : []);
  }

  function dequeueToast() {
    const {
      toastContent,
      toastProps,
      staleId
    } = instance.queue.shift();
    appendToast(toastContent, toastProps, staleId);
  }
  /**
   * check if a container is attached to the dom
   * check for multi-container, build only if associated
   * check for duplicate toastId if no update
   */


  function isNotValid(options) {
    return !containerRef.current || instance.props.enableMultiContainer && options.containerId !== instance.props.containerId || toastToRender.has(options.toastId) && options.updateId == null;
  } // this function and all the function called inside needs to rely on refs


  function buildToast(content, _ref2) {
    let {
      delay,
      staleId,
      ...options
    } = _ref2;
    if (!canBeRendered(content) || isNotValid(options)) return;
    const {
      toastId,
      updateId,
      data
    } = options;
    const {
      props
    } = instance;

    const closeToast = () => removeToast(toastId);

    const isNotAnUpdate = updateId == null;
    if (isNotAnUpdate) instance.count++;
    const toastProps = {
      toastId,
      updateId,
      data,
      containerId: options.containerId,
      isLoading: options.isLoading,
      theme: options.theme || props.theme,
      icon: options.icon != null ? options.icon : props.icon,
      isIn: false,
      key: options.key || instance.toastKey++,
      type: options.type,
      closeToast: closeToast,
      closeButton: options.closeButton,
      rtl: props.rtl,
      position: options.position || props.position,
      transition: options.transition || props.transition,
      className: parseClassName(options.className || props.toastClassName),
      bodyClassName: parseClassName(options.bodyClassName || props.bodyClassName),
      style: options.style || props.toastStyle,
      bodyStyle: options.bodyStyle || props.bodyStyle,
      onClick: options.onClick || props.onClick,
      pauseOnHover: isBool(options.pauseOnHover) ? options.pauseOnHover : props.pauseOnHover,
      pauseOnFocusLoss: isBool(options.pauseOnFocusLoss) ? options.pauseOnFocusLoss : props.pauseOnFocusLoss,
      draggable: isBool(options.draggable) ? options.draggable : props.draggable,
      draggablePercent: options.draggablePercent || props.draggablePercent,
      draggableDirection: options.draggableDirection || props.draggableDirection,
      closeOnClick: isBool(options.closeOnClick) ? options.closeOnClick : props.closeOnClick,
      progressClassName: parseClassName(options.progressClassName || props.progressClassName),
      progressStyle: options.progressStyle || props.progressStyle,
      autoClose: options.isLoading ? false : getAutoCloseDelay(options.autoClose, props.autoClose),
      hideProgressBar: isBool(options.hideProgressBar) ? options.hideProgressBar : props.hideProgressBar,
      progress: options.progress,
      role: options.role || props.role,

      deleteToast() {
        const removed = toToastItem(toastToRender.get(toastId), 'removed');
        toastToRender.delete(toastId);
        eventManager.emit(4
        /* Event.Change */
        , removed);
        const queueLen = instance.queue.length;
        instance.count = isToastIdValid(toastId) ? instance.count - 1 : instance.count - instance.displayedToast;
        if (instance.count < 0) instance.count = 0;

        if (queueLen > 0) {
          const freeSlot = isToastIdValid(toastId) ? 1 : instance.props.limit;

          if (queueLen === 1 || freeSlot === 1) {
            instance.displayedToast++;
            dequeueToast();
          } else {
            const toDequeue = freeSlot > queueLen ? queueLen : freeSlot;
            instance.displayedToast = toDequeue;

            for (let i = 0; i < toDequeue; i++) dequeueToast();
          }
        } else {
          forceUpdate();
        }
      }

    };
    toastProps.iconOut = getIcon(toastProps);
    if (isFn(options.onOpen)) toastProps.onOpen = options.onOpen;
    if (isFn(options.onClose)) toastProps.onClose = options.onClose;
    toastProps.closeButton = props.closeButton;

    if (options.closeButton === false || canBeRendered(options.closeButton)) {
      toastProps.closeButton = options.closeButton;
    } else if (options.closeButton === true) {
      toastProps.closeButton = canBeRendered(props.closeButton) ? props.closeButton : true;
    }

    let toastContent = content;

    if (isValidElement(content) && !isStr(content.type)) {
      toastContent = cloneElement(content, {
        closeToast,
        toastProps,
        data
      });
    } else if (isFn(content)) {
      toastContent = content({
        closeToast,
        toastProps,
        data
      });
    } // not handling limit + delay by design. Waiting for user feedback first


    if (props.limit && props.limit > 0 && instance.count > props.limit && isNotAnUpdate) {
      instance.queue.push({
        toastContent,
        toastProps,
        staleId
      });
    } else if (isNum(delay)) {
      setTimeout(() => {
        appendToast(toastContent, toastProps, staleId);
      }, delay);
    } else {
      appendToast(toastContent, toastProps, staleId);
    }
  }

  function appendToast(content, toastProps, staleId) {
    const {
      toastId
    } = toastProps;
    if (staleId) toastToRender.delete(staleId);
    const toast = {
      content,
      props: toastProps
    };
    toastToRender.set(toastId, toast);
    setToastIds(state => [...state, toastId].filter(id => id !== staleId));
    eventManager.emit(4
    /* Event.Change */
    , toToastItem(toast, toast.props.updateId == null ? 'added' : 'updated'));
  }

  function getToastToRender(cb) {
    const toRender = new Map();
    const collection = Array.from(toastToRender.values());
    if (props.newestOnTop) collection.reverse();
    collection.forEach(toast => {
      const {
        position
      } = toast.props;
      toRender.has(position) || toRender.set(position, []);
      toRender.get(position).push(toast);
    });
    return Array.from(toRender, p => cb(p[0], p[1]));
  }

  return {
    getToastToRender,
    containerRef,
    isToastActive
  };
}

function getX(e) {
  return e.targetTouches && e.targetTouches.length >= 1 ? e.targetTouches[0].clientX : e.clientX;
}

function getY(e) {
  return e.targetTouches && e.targetTouches.length >= 1 ? e.targetTouches[0].clientY : e.clientY;
}

function useToast(props) {
  const [isRunning, setIsRunning] = useState(false);
  const [preventExitTransition, setPreventExitTransition] = useState(false);
  const toastRef = useRef(null);
  const drag = useRef({
    start: 0,
    x: 0,
    y: 0,
    delta: 0,
    removalDistance: 0,
    canCloseOnClick: true,
    canDrag: false,
    boundingRect: null,
    didMove: false
  }).current;
  const syncProps = useRef(props);
  const {
    autoClose,
    pauseOnHover,
    closeToast,
    onClick,
    closeOnClick
  } = props;
  useEffect(() => {
    syncProps.current = props;
  });
  useEffect(() => {
    if (toastRef.current) toastRef.current.addEventListener("d"
    /* SyntheticEvent.ENTRANCE_ANIMATION_END */
    , playToast, {
      once: true
    });
    if (isFn(props.onOpen)) props.onOpen(isValidElement(props.children) && props.children.props);
    return () => {
      const props = syncProps.current;
      if (isFn(props.onClose)) props.onClose(isValidElement(props.children) && props.children.props);
    };
  }, []);
  useEffect(() => {
    props.pauseOnFocusLoss && bindFocusEvents();
    return () => {
      props.pauseOnFocusLoss && unbindFocusEvents();
    };
  }, [props.pauseOnFocusLoss]);

  function onDragStart(e) {
    if (props.draggable) {
      bindDragEvents();
      const toast = toastRef.current;
      drag.canCloseOnClick = true;
      drag.canDrag = true;
      drag.boundingRect = toast.getBoundingClientRect();
      toast.style.transition = '';
      drag.x = getX(e.nativeEvent);
      drag.y = getY(e.nativeEvent);

      if (props.draggableDirection === "x"
      /* Direction.X */
      ) {
        drag.start = drag.x;
        drag.removalDistance = toast.offsetWidth * (props.draggablePercent / 100);
      } else {
        drag.start = drag.y;
        drag.removalDistance = toast.offsetHeight * (props.draggablePercent === 80
        /* Default.DRAGGABLE_PERCENT */
        ? props.draggablePercent * 1.5 : props.draggablePercent / 100);
      }
    }
  }

  function onDragTransitionEnd() {
    if (drag.boundingRect) {
      const {
        top,
        bottom,
        left,
        right
      } = drag.boundingRect;

      if (props.pauseOnHover && drag.x >= left && drag.x <= right && drag.y >= top && drag.y <= bottom) {
        pauseToast();
      } else {
        playToast();
      }
    }
  }

  function playToast() {
    setIsRunning(true);
  }

  function pauseToast() {
    setIsRunning(false);
  }

  function bindFocusEvents() {
    if (!document.hasFocus()) pauseToast();
    window.addEventListener('focus', playToast);
    window.addEventListener('blur', pauseToast);
  }

  function unbindFocusEvents() {
    window.removeEventListener('focus', playToast);
    window.removeEventListener('blur', pauseToast);
  }

  function bindDragEvents() {
    drag.didMove = false;
    document.addEventListener('mousemove', onDragMove);
    document.addEventListener('mouseup', onDragEnd);
    document.addEventListener('touchmove', onDragMove);
    document.addEventListener('touchend', onDragEnd);
  }

  function unbindDragEvents() {
    document.removeEventListener('mousemove', onDragMove);
    document.removeEventListener('mouseup', onDragEnd);
    document.removeEventListener('touchmove', onDragMove);
    document.removeEventListener('touchend', onDragEnd);
  }

  function onDragMove(e) {
    const toast = toastRef.current;

    if (drag.canDrag && toast) {
      drag.didMove = true;
      if (isRunning) pauseToast();
      drag.x = getX(e);
      drag.y = getY(e);

      if (props.draggableDirection === "x"
      /* Direction.X */
      ) {
        drag.delta = drag.x - drag.start;
      } else {
        drag.delta = drag.y - drag.start;
      } // prevent false positif during a toast click


      if (drag.start !== drag.x) drag.canCloseOnClick = false;
      toast.style.transform = "translate" + props.draggableDirection + "(" + drag.delta + "px)";
      toast.style.opacity = "" + (1 - Math.abs(drag.delta / drag.removalDistance));
    }
  }

  function onDragEnd() {
    unbindDragEvents();
    const toast = toastRef.current;

    if (drag.canDrag && drag.didMove && toast) {
      drag.canDrag = false;

      if (Math.abs(drag.delta) > drag.removalDistance) {
        setPreventExitTransition(true);
        props.closeToast();
        return;
      }

      toast.style.transition = 'transform 0.2s, opacity 0.2s';
      toast.style.transform = "translate" + props.draggableDirection + "(0)";
      toast.style.opacity = '1';
    }
  }

  const eventHandlers = {
    onMouseDown: onDragStart,
    onTouchStart: onDragStart,
    onMouseUp: onDragTransitionEnd,
    onTouchEnd: onDragTransitionEnd
  };

  if (autoClose && pauseOnHover) {
    eventHandlers.onMouseEnter = pauseToast;
    eventHandlers.onMouseLeave = playToast;
  } // prevent toast from closing when user drags the toast


  if (closeOnClick) {
    eventHandlers.onClick = e => {
      onClick && onClick(e);
      drag.canCloseOnClick && closeToast();
    };
  }

  return {
    playToast,
    pauseToast,
    isRunning,
    preventExitTransition,
    toastRef,
    eventHandlers
  };
}

function CloseButton(_ref) {
  let {
    closeToast,
    theme,
    ariaLabel = 'close'
  } = _ref;
  return React.createElement("button", {
    className: "Toastify"
    /* Default.CSS_NAMESPACE */
    + "__close-button " + "Toastify"
    /* Default.CSS_NAMESPACE */
    + "__close-button--" + theme,
    type: "button",
    onClick: e => {
      e.stopPropagation();
      closeToast(e);
    },
    "aria-label": ariaLabel
  }, React.createElement("svg", {
    "aria-hidden": "true",
    viewBox: "0 0 14 16"
  }, React.createElement("path", {
    fillRule: "evenodd",
    d: "M7.71 8.23l3.75 3.75-1.48 1.48-3.75-3.75-3.75 3.75L1 11.98l3.75-3.75L1 4.48 2.48 3l3.75 3.75L9.98 3l1.48 1.48-3.75 3.75z"
  })));
}

function ProgressBar(_ref) {
  let {
    delay,
    isRunning,
    closeToast,
    type,
    hide,
    className,
    style: userStyle,
    controlledProgress,
    progress,
    rtl,
    isIn,
    theme
  } = _ref;
  const style = { ...userStyle,
    animationDuration: delay + "ms",
    animationPlayState: isRunning ? 'running' : 'paused',
    opacity: hide ? 0 : 1
  };
  if (controlledProgress) style.transform = "scaleX(" + progress + ")";
  const defaultClassName = cx("Toastify"
  /* Default.CSS_NAMESPACE */
  + "__progress-bar", controlledProgress ? "Toastify"
  /* Default.CSS_NAMESPACE */
  + "__progress-bar--controlled" : "Toastify"
  /* Default.CSS_NAMESPACE */
  + "__progress-bar--animated", "Toastify"
  /* Default.CSS_NAMESPACE */
  + "__progress-bar-theme--" + theme, "Toastify"
  /* Default.CSS_NAMESPACE */
  + "__progress-bar--" + type, {
    ["Toastify"
    /* Default.CSS_NAMESPACE */
    + "__progress-bar--rtl"]: rtl
  });
  const classNames = isFn(className) ? className({
    rtl,
    type,
    defaultClassName
  }) : cx(defaultClassName, className); // 🧐 controlledProgress is derived from progress
  // so if controlledProgress is set
  // it means that this is also the case for progress

  const animationEvent = {
    [controlledProgress && progress >= 1 ? 'onTransitionEnd' : 'onAnimationEnd']: controlledProgress && progress < 1 ? null : () => {
      isIn && closeToast();
    }
  }; // TODO: add aria-valuenow, aria-valuemax, aria-valuemin

  return React.createElement("div", {
    role: "progressbar",
    "aria-hidden": hide ? 'true' : 'false',
    "aria-label": "notification timer",
    className: classNames,
    style: style,
    ...animationEvent
  });
}
ProgressBar.defaultProps = {
  type: TYPE.DEFAULT,
  hide: false
};

const Toast = props => {
  const {
    isRunning,
    preventExitTransition,
    toastRef,
    eventHandlers
  } = useToast(props);
  const {
    closeButton,
    children,
    autoClose,
    onClick,
    type,
    hideProgressBar,
    closeToast,
    transition: Transition,
    position,
    className,
    style,
    bodyClassName,
    bodyStyle,
    progressClassName,
    progressStyle,
    updateId,
    role,
    progress,
    rtl,
    toastId,
    deleteToast,
    isIn,
    isLoading,
    iconOut,
    theme
  } = props;
  const defaultClassName = cx("Toastify"
  /* Default.CSS_NAMESPACE */
  + "__toast", "Toastify"
  /* Default.CSS_NAMESPACE */
  + "__toast-theme--" + theme, "Toastify"
  /* Default.CSS_NAMESPACE */
  + "__toast--" + type, {
    ["Toastify"
    /* Default.CSS_NAMESPACE */
    + "__toast--rtl"]: rtl
  });
  const cssClasses = isFn(className) ? className({
    rtl,
    position,
    type,
    defaultClassName
  }) : cx(defaultClassName, className);
  const isProgressControlled = !!progress;
  const closeButtonProps = {
    closeToast,
    type,
    theme
  };
  let Close = null;

  if (closeButton === false) ; else if (isFn(closeButton)) {
    Close = closeButton(closeButtonProps);
  } else if (React.isValidElement(closeButton)) {
    Close = React.cloneElement(closeButton, closeButtonProps);
  } else {
    Close = CloseButton(closeButtonProps);
  }

  return React.createElement(Transition, {
    isIn: isIn,
    done: deleteToast,
    position: position,
    preventExitTransition: preventExitTransition,
    nodeRef: toastRef
  }, React.createElement("div", {
    id: toastId,
    onClick: onClick,
    className: cssClasses,
    ...eventHandlers,
    style: style,
    ref: toastRef
  }, React.createElement("div", { ...(isIn && {
      role: role
    }),
    className: isFn(bodyClassName) ? bodyClassName({
      type
    }) : cx("Toastify"
    /* Default.CSS_NAMESPACE */
    + "__toast-body", bodyClassName),
    style: bodyStyle
  }, iconOut != null && React.createElement("div", {
    className: cx("Toastify"
    /* Default.CSS_NAMESPACE */
    + "__toast-icon", {
      ["Toastify"
      /* Default.CSS_NAMESPACE */
      + "--animate-icon " + "Toastify"
      /* Default.CSS_NAMESPACE */
      + "__zoom-enter"]: !isLoading
    })
  }, iconOut), React.createElement("div", null, children)), Close, (autoClose || isProgressControlled) && React.createElement(ProgressBar, { ...(updateId && !isProgressControlled ? {
      key: "pb-" + updateId
    } : {}),
    rtl: rtl,
    theme: theme,
    delay: autoClose,
    isRunning: isRunning,
    isIn: isIn,
    closeToast: closeToast,
    hide: hideProgressBar,
    type: type,
    style: progressStyle,
    className: progressClassName,
    controlledProgress: isProgressControlled,
    progress: progress
  })));
};

const Bounce = cssTransition({
  enter: "Toastify"
  /* Default.CSS_NAMESPACE */
  + "--animate " + "Toastify"
  /* Default.CSS_NAMESPACE */
  + "__bounce-enter",
  exit: "Toastify"
  /* Default.CSS_NAMESPACE */
  + "--animate " + "Toastify"
  /* Default.CSS_NAMESPACE */
  + "__bounce-exit",
  appendPosition: true
});
const Slide = cssTransition({
  enter: "Toastify"
  /* Default.CSS_NAMESPACE */
  + "--animate " + "Toastify"
  /* Default.CSS_NAMESPACE */
  + "__slide-enter",
  exit: "Toastify"
  /* Default.CSS_NAMESPACE */
  + "--animate " + "Toastify"
  /* Default.CSS_NAMESPACE */
  + "__slide-exit",
  appendPosition: true
});
const Zoom = cssTransition({
  enter: "Toastify"
  /* Default.CSS_NAMESPACE */
  + "--animate " + "Toastify"
  /* Default.CSS_NAMESPACE */
  + "__zoom-enter",
  exit: "Toastify"
  /* Default.CSS_NAMESPACE */
  + "--animate " + "Toastify"
  /* Default.CSS_NAMESPACE */
  + "__zoom-exit"
});
const Flip = cssTransition({
  enter: "Toastify"
  /* Default.CSS_NAMESPACE */
  + "--animate " + "Toastify"
  /* Default.CSS_NAMESPACE */
  + "__flip-enter",
  exit: "Toastify"
  /* Default.CSS_NAMESPACE */
  + "--animate " + "Toastify"
  /* Default.CSS_NAMESPACE */
  + "__flip-exit"
});

// https://github.com/yannickcr/eslint-plugin-react/issues/3140
const ToastContainer = forwardRef((props, ref) => {
  const {
    getToastToRender,
    containerRef,
    isToastActive
  } = useToastContainer(props);
  const {
    className,
    style,
    rtl,
    containerId
  } = props;

  function getClassName(position) {
    const defaultClassName = cx("Toastify"
    /* Default.CSS_NAMESPACE */
    + "__toast-container", "Toastify"
    /* Default.CSS_NAMESPACE */
    + "__toast-container--" + position, {
      ["Toastify"
      /* Default.CSS_NAMESPACE */
      + "__toast-container--rtl"]: rtl
    });
    return isFn(className) ? className({
      position,
      rtl,
      defaultClassName
    }) : cx(defaultClassName, parseClassName(className));
  }

  useEffect(() => {
    if (ref) {
      ref.current = containerRef.current;
    }
  }, []);
  return React.createElement("div", {
    ref: containerRef,
    className: "Toastify"
    /* Default.CSS_NAMESPACE */
    ,
    id: containerId
  }, getToastToRender((position, toastList) => {
    const containerStyle = !toastList.length ? { ...style,
      pointerEvents: 'none'
    } : { ...style
    };
    return React.createElement("div", {
      className: getClassName(position),
      style: containerStyle,
      key: "container-" + position
    }, toastList.map((_ref, i) => {
      let {
        content,
        props: toastProps
      } = _ref;
      return React.createElement(Toast, { ...toastProps,
        isIn: isToastActive(toastProps.toastId),
        style: { ...toastProps.style,
          '--nth': i + 1,
          '--len': toastList.length
        },
        key: "toast-" + toastProps.key
      }, content);
    }));
  }));
});
ToastContainer.displayName = 'ToastContainer';
ToastContainer.defaultProps = {
  position: POSITION.TOP_RIGHT,
  transition: Bounce,
  rtl: false,
  autoClose: 5000,
  hideProgressBar: false,
  closeButton: CloseButton,
  pauseOnHover: true,
  pauseOnFocusLoss: true,
  closeOnClick: true,
  newestOnTop: false,
  draggable: true,
  draggablePercent: 80
  /* Default.DRAGGABLE_PERCENT */
  ,
  draggableDirection: "x"
  /* Direction.X */
  ,
  role: 'alert',
  theme: 'light'
};

let containers = new Map();
let latestInstance;
let queue = [];
/**
 * Get the toast by id, given it's in the DOM, otherwise returns null
 */

function getToast(toastId, _ref) {
  let {
    containerId
  } = _ref;
  const container = containers.get(containerId || latestInstance);
  if (!container) return null;
  return container.getToast(toastId);
}
/**
 * Generate a random toastId
 */


function generateToastId() {
  return Math.random().toString(36).substring(2, 9);
}
/**
 * Generate a toastId or use the one provided
 */


function getToastId(options) {
  if (options && (isStr(options.toastId) || isNum(options.toastId))) {
    return options.toastId;
  }

  return generateToastId();
}
/**
 * If the container is not mounted, the toast is enqueued and
 * the container lazy mounted
 */


function dispatchToast(content, options) {
  if (containers.size > 0) {
    eventManager.emit(0
    /* Event.Show */
    , content, options);
  } else {
    queue.push({
      content,
      options
    });
  }

  return options.toastId;
}
/**
 * Merge provided options with the defaults settings and generate the toastId
 */


function mergeOptions(type, options) {
  return { ...options,
    type: options && options.type || type,
    toastId: getToastId(options)
  };
}

function createToastByType(type) {
  return (content, options) => dispatchToast(content, mergeOptions(type, options));
}

function toast(content, options) {
  return dispatchToast(content, mergeOptions(TYPE.DEFAULT, options));
}

toast.loading = (content, options) => dispatchToast(content, mergeOptions(TYPE.DEFAULT, {
  isLoading: true,
  autoClose: false,
  closeOnClick: false,
  closeButton: false,
  draggable: false,
  ...options
}));

function handlePromise(promise, _ref2, options) {
  let {
    pending,
    error,
    success
  } = _ref2;
  let id;

  if (pending) {
    id = isStr(pending) ? toast.loading(pending, options) : toast.loading(pending.render, { ...options,
      ...pending
    });
  }

  const resetParams = {
    isLoading: null,
    autoClose: null,
    closeOnClick: null,
    closeButton: null,
    draggable: null,
    delay: 100
  };

  const resolver = (type, input, result) => {
    // Remove the toast if the input has not been provided. This prevents the toast from hanging
    // in the pending state if a success/error toast has not been provided.
    if (input == null) {
      toast.dismiss(id);
      return;
    }

    const baseParams = {
      type,
      ...resetParams,
      ...options,
      data: result
    };
    const params = isStr(input) ? {
      render: input
    } : input; // if the id is set we know that it's an update

    if (id) {
      toast.update(id, { ...baseParams,
        ...params
      });
    } else {
      // using toast.promise without loading
      toast(params.render, { ...baseParams,
        ...params
      });
    }

    return result;
  };

  const p = isFn(promise) ? promise() : promise; //call the resolvers only when needed

  p.then(result => resolver('success', success, result)).catch(err => resolver('error', error, err));
  return p;
}

toast.promise = handlePromise;
toast.success = createToastByType(TYPE.SUCCESS);
toast.info = createToastByType(TYPE.INFO);
toast.error = createToastByType(TYPE.ERROR);
toast.warning = createToastByType(TYPE.WARNING);
toast.warn = toast.warning;

toast.dark = (content, options) => dispatchToast(content, mergeOptions(TYPE.DEFAULT, {
  theme: 'dark',
  ...options
}));
/**
 * Remove toast programmaticaly
 */


toast.dismiss = id => {
  if (containers.size > 0) {
    eventManager.emit(1
    /* Event.Clear */
    , id);
  } else {
    queue = queue.filter(t => isToastIdValid(id) && t.options.toastId !== id);
  }
};
/**
 * Clear waiting queue when limit is used
 */


toast.clearWaitingQueue = function (params) {
  if (params === void 0) {
    params = {};
  }

  return eventManager.emit(5
  /* Event.ClearWaitingQueue */
  , params);
};
/**
 * return true if one container is displaying the toast
 */


toast.isActive = id => {
  let isToastActive = false;
  containers.forEach(container => {
    if (container.isToastActive && container.isToastActive(id)) {
      isToastActive = true;
    }
  });
  return isToastActive;
};

toast.update = function (toastId, options) {
  if (options === void 0) {
    options = {};
  }

  // if you call toast and toast.update directly nothing will be displayed
  // this is why I defered the update
  setTimeout(() => {
    const toast = getToast(toastId, options);

    if (toast) {
      const {
        props: oldOptions,
        content: oldContent
      } = toast;
      const nextOptions = { ...oldOptions,
        ...options,
        toastId: options.toastId || toastId,
        updateId: generateToastId()
      };
      if (nextOptions.toastId !== toastId) nextOptions.staleId = toastId;
      const content = nextOptions.render || oldContent;
      delete nextOptions.render;
      dispatchToast(content, nextOptions);
    }
  }, 0);
};
/**
 * Used for controlled progress bar.
 */


toast.done = id => {
  toast.update(id, {
    progress: 1
  });
};
/**
 * Subscribe to change when a toast is added, removed and updated
 *
 * Usage:
 * ```
 * const unsubscribe = toast.onChange((payload) => {
 *   switch (payload.status) {
 *   case "added":
 *     // new toast added
 *     break;
 *   case "updated":
 *     // toast updated
 *     break;
 *   case "removed":
 *     // toast has been removed
 *     break;
 *   }
 * })
 * ```
 */


toast.onChange = callback => {
  eventManager.on(4
  /* Event.Change */
  , callback);
  return () => {
    eventManager.off(4
    /* Event.Change */
    , callback);
  };
};

toast.POSITION = POSITION;
toast.TYPE = TYPE;
/**
 * Wait until the ToastContainer is mounted to dispatch the toast
 * and attach isActive method
 */

eventManager.on(2
/* Event.DidMount */
, containerInstance => {
  latestInstance = containerInstance.containerId || containerInstance;
  containers.set(latestInstance, containerInstance);
  queue.forEach(item => {
    eventManager.emit(0
    /* Event.Show */
    , item.content, item.options);
  });
  queue = [];
}).on(3
/* Event.WillUnmount */
, containerInstance => {
  containers.delete(containerInstance.containerId || containerInstance);

  if (containers.size === 0) {
    eventManager.off(0
    /* Event.Show */
    ).off(1
    /* Event.Clear */
    ).off(5
    /* Event.ClearWaitingQueue */
    );
  }
});

export { Bounce, Flip, Icons, Slide, ToastContainer, Zoom, collapseToast, cssTransition, toast, useToast, useToastContainer };
//# sourceMappingURL=react-toastify.esm.mjs.map
