/**
 * @file Defines the common functions and structures
 * @author Derek Gransaull <derek@dgtlife.com>
 * @copyright DGTLife, LLC 2016
 *
 * Created on 12/14/16
 */
/* eslint new-cap: ["error", { "capIsNewExceptionPattern": "^Match\.." }] */
import { ReactiveVar } from 'meteor/reactive-var';
import { ReactiveDict } from 'meteor/reactive-dict';
import { _ } from 'meteor/underscore';
import { Template } from 'meteor/templating';
import { check, Match } from 'meteor/check';
import Pattern from './pattern.js';
import {
  updateBrowserHistory,
  handleBrowserBackAndForward,
  startBrowserMode
} from './nav-browser.js';
import {
  navStack,
  inAppMode,
  updateNavStack,
  resetNavStack,
  startAppMode
} from './nav-app.js';

// The config object, which holds properties for Nav.
export const config = {
  /*
   * The array of content helpers used to provide content dynamically to
   * screens. Initialize it.
   */
  contentHelpers: [],

  /*
   * Enable/disable support for loading a specific screen using its full URL
   * entered in the browser, and reloading a specific screen in the browser.
   */
  supportUrls: true,

  /*
   * Enable/disable support for navigating with or without a trailing '/'.
   * If a trailing slash is included, it is removed before attempting to
   * match the path.
   */
  ignoreTrailingSlash: true,

  /*
   * Enable/disable support for using the Back/Forward buttons of the
   * browser.
   */
  useBrowserBackAndForward: true,

  /*
   * A Boolean that is TRUE when the app is running in full-screen/standalone
   * mode on an iOS device. It is initialized as false.
   */
  inAppModeOnIos: false,

  /*
   * A Boolean that is TRUE when the app is running in full-screen/standalone
   * mode on an Android device. It is initialized as false.
   */
  inAppModeOnAndroid: false,

  // The first screen that loads in a non-authenticated session in App Mode.
  appModePublicHome: 'Home',

  // The first screen that loads in an authenticated session in App Mode.
  appModeUserHome: 'Home',

  // The Not Found template (name).
  notFoundTemplate: 'not_found',

  // The Access Denied template (name).
  accessDeniedTemplate: 'access_denied',

  // A function that runs before each and every screen is rendered.
  beforeScreens: null,

  // A function that runs after each and every screen is rendered.
  afterScreens: null,

  /*
   * An object in which each key is an array of functions. Each function
   * returns a Boolean. All functions must return TRUE before the function
   * (typically loading a screen) that the overall condition gates is
   * called. Users can add their own named conditions to the defaults in the
   * constructor.
   */
  conditionsToWaitFor: {
    okToLoad: [],
    okToReload: []
  }
};

// The array of screen objects.
export const screens = [];

/*
 * An array of objects containing the name-pathPattern pairs associated with
 * screens, and used to match a path to a screen when URLs are supported.
 */
export const pathLookup = [];

// Reactive variables.
export const currentScreen = new ReactiveVar(null);
export const screenData = new ReactiveVar({});
export const navStackLength = new ReactiveVar(0);
export const isLoading = new ReactiveVar(false);
const reactive = new ReactiveDict();

/**
 * Set the config based on the options supplied to Nav.run by the user.
 * @param {object} options - the options provided
 */
const setConfig = (options) => {
  // Update the config values.
  _.each(options, (value, key) => {
    config[key] = value;
  });
};

/**
 * Go to a screen, i.e. make this screen the current one. Options can be
 * provided:
 *   * {boolean} shouldUpdateBrowserHistory - indicates whether the browser
 *                                            history should be updated or not
 *   * {boolean} shouldUpdateNavStack - indicates whether the navigation stack
 *                                      should be updated or not
 *   * {object} screenData - an object containing any data that is essential
 *                           to render the screen
 * @param {string} name - the name of the screen
 * @param {object} [options] - other screen properties
 */
export const toScreen = (name, options) => {
  // Check the name first.
  check(name, Pattern.nonEmptyString);

  // Avoid errors when this function is called with no options.
  // const _options = options || {};

  // Get the screen object.
  const screen = _.findWhere(screens, { name: name });

  // If the screen exists,
  if (screen) {
    // ... and we are already on that screen, ignore early and return.
    if (currentScreen.get() === name) {
      return false;
    }

    // Check the optional options ;-).
    if (options) {
      check(options, {
        shouldUpdateBrowserHistory: Match.Optional(Boolean),
        shouldUpdateNavStack: Match.Optional(Boolean),
        screenData: Match.Optional(Object)
      });
    }

    /*
     * Clear all reactive variables for content helper-template mappings from
     * the previous screen, so that they do not persist if they are not
     * re-mapped in the upcoming screen transition.
     */
    _.each(config.contentHelpers, (helper) => {
      reactive.set(helper, null);
    });

    // Clear any screen data from the previous screen.
    screenData.set({});

    // Run any global 'before' function.
    if (config.beforeScreens) {
      config.beforeScreens();
    }

    // Set any screen data for this (soon to be current) screen.
    const _screenData = options && options.screenData;
    if (_screenData) {
      screenData.set(_screenData);
    }

    // Run any screen-specific 'before' function.
    if (screen.before) {
      screen.before();
    }

    /*
     * Define an onRendered callback to set the window title, and run global
     * and screen-specific 'after' functions.
     */
    Template[screen.contentHelperMap[0].template].onRendered(
      function onRenderedScreen() {
        // Set the screen title.
        const title = screen.title;
        if (_.isFunction(title)) {
          // Consider using 'this.autorun'
          this.autorun((comp) => {
            if (title()) {
              document.title = title();
              comp.stop();
            }
          });
        } else {
          document.title = title;
        }

        // Run any screen-specific 'after' function
        if (screen.after) {
          screen.after();
        }

        // Run any global 'after' function.
        if (config.afterScreens) {
          config.afterScreens();
        }
      }
    );

    /*
     * "Go" to the screen, by setting the value of the reactive variable for
     * each content helper. The value of the reactive variable is the name of
     * the template to be rendered into that helper on the current screen.
     * This effectively triggers the screen transition.
     */
    if (screen.contentHelperMap && screen.contentHelperMap.length > 0) {
      _.each(screen.contentHelperMap, (helperMapping) => {
        reactive.set(helperMapping.helper, helperMapping.template);
      });
    }

    // Track the name of the current screen in a reactive variable.
    currentScreen.set(name);

    // Assign a shouldUpdateBrowserHistory variable.
    const shouldUpdateBrowserHistoryOption =
      options && options.shouldUpdateBrowserHistory;
    let shouldUpdateBrowserHistory;
    if (!_.isUndefined(shouldUpdateBrowserHistoryOption)) {
      shouldUpdateBrowserHistory = shouldUpdateBrowserHistoryOption;
    } else {
      shouldUpdateBrowserHistory = true;
    }

    // Update the browser history, unless it's explicitly prevented.
    if (shouldUpdateBrowserHistory) {
      updateBrowserHistory(
        name, screen.path, screen.pathMask, screen.generatePath, screenData);
    }

    // Assign a shouldUpdateNavStack variable.
    const shouldUpdateNavStackOption =
      options && options.shouldUpdateNavStack;
    let shouldUpdateNavStack;
    if (!_.isUndefined(shouldUpdateNavStackOption)) {
      shouldUpdateNavStack = shouldUpdateNavStackOption;
    } else {
      shouldUpdateNavStack = true;
    }

    // Update the navigation stack, unless it's explicitly prevented.
    if (shouldUpdateNavStack) {
      updateNavStack(name, screen.title, screenData);
    }
  } else {
    throw new Error(`A screen named ${name} has not been registered.`);
  }

  return true;
};

/**
 * Register a 'data-navlink' attribute to enable HTML 'pseudo-links' to a
 * screen from any element with that attribute. This is meant for app mode but
 * works in all modes.
 * @param {string} name - the name of the screen
 */
const registerNavLink = (name) => {
  const eventMap = {};
  const eventKey =
          `click [data-navlink=
          to-${name.replace(/\s+/g, '-').toLowerCase()}]`;
  eventMap[eventKey] = (event) => {
    event.preventDefault();
    toScreen(name);
  };

  // Register this event handler with the body template.
  Template.body.events(eventMap);
};

/**
 * Get the screen object when given the name of the screen.
 * @param {string} name - the name of the screen
 */
const getScreen = name => _.findWhere(screens, { name: name });

/**
 * Register a screen.
 * The 'screen' object has the following properties assumed by the package:
 *   * name {string} - the name of the screen (required)
 *   * contentHelperMap {array} - an array of objects, each of which provides
 *     the helper-to-template mapping for the screen content (required). Each
 *     template is reactively rendered into the corresponding helper.
 *   * title {string|function} - the title on the browser tab (required)
 *   * path {string} - the relative path associated with the screen (when URLs
 *     are supported).
 *   * pathMask {string} - the mask for the relative path associated with the
 *     screen (when URLs are supported). The mask defines the location of
 *     parameters.
 *   * pathPattern {RegExp} - the RegExp pattern that only this path or path
 *     mask will match (when URLs are supported).
 *   * generatePath {function} - a function to generate a path based on the
 *     path mask and screen data.
 *   * getDataFromParams {function} - a function to generate screen data based
 *     on the parameters extracted from a path.
 *   * isAllowed {boolean|function} - TRUE for screens that are public. For
 *     screens that are not public, it is a function that computes to
 *     TRUE for users allowed to access it, and false for everyone else.
 *   * before {function} - a function to run before this screen is rendered;
 *     this function will run after any function stored in
 *     'beforeScreens'
 *   * after {function} - a function to run after this screen is rendered;
 *     this function will run before any function stored in
 *     'afterScreens'
 *
 * The 'title', and 'isAllowed' properties require the input
 * of the type indicated, or a function that returns the required type.
 *
 * The package user can add any additional properties to the screen object, as
 * desired, and must provide the code to check, retrieve, and use those
 * properties.
 * @param {string} name - the name of the screen
 * @param {object} options - other screen properties and their values
 */
export const registerScreen = (name, options) => {
  // Throw an error if no options are provided.
  if (!options) {
    throw new Error('Screen registration requires a minimal set of options');
  }

  // Check the options.
  check(name, Pattern.nonEmptyString);
  check(options, Match.ObjectIncluding({
    contentHelperMap: [Object],
    title: Pattern.nonEmptyStringOrFunction
  }));
  check(options.path, Match.Optional(Pattern.nonEmptyString));
  check(options.pathMask, Match.Optional(Pattern.nonEmptyString));
  check(options.pathPattern, Match.Optional(Pattern.regExp));
  check(options.generatePath, Match.Optional(Pattern.function));
  check(options.getDataFromParams, Match.Optional(Pattern.function));
  check(options.isAllowed, Match.Optional(Pattern.booleanOrFunction));
  check(options.before, Match.Optional(Pattern.function));
  check(options.after, Match.Optional(Pattern.function));

  // Check that all path-related options are provided.
  if (options.path && !options.pathPattern) {
    // This screen is missing the required path pattern.
    throw new Error(
      `The path pattern was not provided for path ${options.path}`
    );
  }
  if (options.pathMask && !options.pathPattern) {
    // This screen is missing the required path pattern.
    throw new Error(
      `The path pattern was not provided for path mask ${options.pathMask}`
    );
  }
  if (options.pathMask && !options.generatePath) {
    // This screen is missing the required function to generate the path.
    throw new Error(
      `The generatePath function was not provided for path mask
       ${options.pathMask}`
    );
  }

  if (options.pathMask && !options.getDataFromParams) {
    /*
     * This screen is missing the required function to get screen data from
      * path parameters.
     */
    throw new Error(
      `The getDataFromParams function was not provided for path mask
       ${options.pathMask}`
    );
  }

  // If the screen is not already registered, then register it.
  if (!getScreen(name)) {
    // Initialize a screen object.
    let screen = {
      name: name
    };

    // Assign the 'isAllowed' property of the screen.
    screen.isAllowed = options.isAllowed || true;

    // Assign the other screen properties provided in the options.
    screen = _.extend(screen, options);

    // Add this screen object to the 'screens' array.
    screens.push(screen);

    // Add the path pattern object to the path lookup array.
    if (options.path || options.pathMask) {
      pathLookup.push({
        name: name,
        pathPattern: options.pathPattern
      });
    }

    /*
     * Define the event handler for the convenience 'data-navlink' attribute
     * for this screen.
     */
    registerNavLink(name);
  } else {
    // The screen already exists, so throw an error.
    throw new Error(`A screen named ${name} has already been registered.`);
  }
};

/**
 * Register the content helpers for each content block. Each helper will render
 * the corresponding content template (if any) assigned to it by the current
 * screen. This will effect reactive rendering of the complete screen.
 * @param {[string]} contentHelpers - the array of content helpers
 */
const registerContentHelpers = (contentHelpers) => {
  _.each(contentHelpers, (contentHelper) => {
    Template.registerHelper(contentHelper, () =>
      Template[reactive.get(contentHelper)] || null);
  });
};

/**
 * Start a navigation session, i.e. start navigation in one of the following
 * modes:
 *   * app mode
 *       * in native mode on iOS and Android
 *       * on iOS in standalone mode (i.e saved to Home screen on device)
 *       * on Android (both browser and Home screen app)
 *   * browser mode
 *       * on everything else
 * @param {object} [options] - options provided by the package user
 */
export const run = (options) => {
  if (!options) {
    throw new Error('Nav run must be called on a config object.');
  }

  // Check the config options.
  check(options.contentHelpers, Match.Optional([String]));
  check(options.supportUrls, Match.Optional(Boolean));
  check(options.ignoreTrailingSlash, Match.Optional(Boolean));
  check(options.useBrowserBackAndForward, Match.Optional(Boolean));
  check(options.inAppModeOnIos, Match.Optional(Boolean));
  check(options.inAppModeOnAndroid, Match.Optional(Boolean));
  check(options.appModePublicHome, Match.Optional(String));
  check(options.appModeUserHome, Match.Optional(String));
  check(options.notFoundTemplate, Match.Optional(String));
  check(options.accessDeniedTemplate, Match.Optional(String));
  check(options.beforeScreens, Match.Optional(Pattern.function));
  check(options.afterScreens, Match.Optional(Pattern.function));
  check(options.conditionsToWaitFor, Match.Optional(Object));
  if (options.conditionsToWaitFor) {
    check(options.conditionsToWaitFor.okToLoad, Match.Optional(Array));
    _.each(options.conditionsToWaitFor.okToLoad, (member) => {
      check(member, Pattern.function);
    });
    check(options.conditionsToWaitFor.okToReload, Match.Optional(Array));
    _.each(options.conditionsToWaitFor.okToReload, (member) => {
      check(member, Pattern.function);
    });
  }

  // Update the config.
  setConfig(options);

  // Register the content helpers.
  registerContentHelpers(config.contentHelpers);

  // Branch based on mode.
  if (inAppMode()) {
    /*
     * We're in app mode on a mobile device, so we'll behave like a native
     * app, i.e. no URL entry, no page reloads, and no window.history. Update
     * the config with some additional properties.
     */
    config.supportUrls = false;
    config.useBrowserBackAndForward = false;

    // Run in App Mode and (eventually) load the App Mode start screen.
    startAppMode(config.appModePublicHome, config.appModeUserHome);
  } else {
    /*
     * We're in browser mode (on any device), so respond to Back and Forward
     * buttons.
     */
    if (config.useBrowserBackAndForward) {
      handleBrowserBackAndForward();
    }

    /*
     * Run in browser mode and (eventually) load the screen that corresponds
     * to the URL (path) entered directly in the browser, or indirectly via a
     * browser reload.
     */
    startBrowserMode(window.location.pathname);
  }
};

/**
 * Wait for a condition to be TRUE before running a function. This is used to
 * ensure that data is there before calling a function that needs that data.
 * @param {string|function} condition - a conditionId (e.g. okToLoad),
 *                                      function name, or a function
 *                                      definition
 * @param {function} func - the name or definition of the function that waits
 * @param {boolean} showLoading - TRUE to show the Loading screen
 * @param {object} context - a data context that may be needed
 */
export const waitForCondition = (condition, func, showLoading, context) => {
  let conditionSatisfied;

  /**
   * Retrieves the array of condition functions associated with an identified
   * condition, and evaluates the aggregate status of the identified
   * condition.
   * @returns {boolean}
   */
  const evaluateConditions = () =>
    _.every(config.conditionsToWaitFor[condition], conditionFunc =>
      !((conditionFunc() === false) || (_.isUndefined(conditionFunc()))));

  // Check for proper inputs.
  check(condition, Pattern.nonEmptyStringOrFunction);
  check(func, Pattern.function);
  check(showLoading, Boolean);

  // Context may not be a plain object.
  if (!_.isUndefined(context)) {
    check(context, Match.Where(val => _.isObject(val)));
  }

  // Determine how to evaluate the condition.
  if (condition instanceof Function) {
    // It's a function, so we can use it directly.
    conditionSatisfied = condition;
  } else if (_.has(config.conditionsToWaitFor, condition)) {
    // It's a condition id, so we must evaluate the associated conditions.
    conditionSatisfied = evaluateConditions;
  } else {
    throw new Error('Invalid condition or unknown condition id was supplied.');
  }

  Tracker.autorun((comp) => {
    if (!conditionSatisfied()) {
      if (showLoading) {
        // Show the 'Loading' screen, and set the 'Loading' state.
        isLoading.set(true);
        reactive.set(config.contentHelpers[0], 'loading');
      }
    } else {
      if (showLoading) {
        isLoading.set(false);
      }

      /*
       * Call the function that waits for the condition to be TRUE, passing
       * the data context to it, if necessary.
       */
      if (_.isUndefined(context)) {
        func();
      } else {
        func().bind(context);
      }
      comp.stop();
    }
  });
};

/**
 * Convenience function to go to the Home screen. On the Home screen of
 * mobile devices, the navStack is reset to meet expected app mode behavior.
 */
export const toHome = () => {
  if (inAppMode()) {
    resetNavStack('Home');
  } else {
    toScreen('Home');
  }
};

/**
 * Returns the title of the previous screen in app mode only.
 */
export const getPreviousTitle = () => {
  if (inAppMode()) {
    // We are in App mode.
    const stackLength = navStackLength.get();
    if (stackLength > 1) {
      return navStack[stackLength - 2].title;
    }

    // There is no previous screen.
    return false;
  }

  // We are not in App mode
  return false;
};

/**
 * Go to the previous screen.
 */
export const back = () => {
  if (config.supportUrls) {
    // We are in Browser mode. Use the browser history to move back.
    window.history.back();
    return true;
  }

  // We are in App mode on a mobile device. Use the nav stack to move back.
  if (navStack.length === 1) {
    // We are at the navigation root, so we stop.
    return false;
  }

  // Remove the current screen at the top of the nav stack.
  navStack.pop();

  // Set the new length of the nav stack.
  navStackLength.set(navStack.length);

  /*
   * Go to the screen at the top of the nav stack without updating the nav
   * stack on this reverse transition. First, initialize the screen options.
   */
  let options = { shouldUpdateNavStack: false };
  const previousScreen = navStack[navStack.length - 1];

  // Add screen data to the options, if necessary.
  if (previousScreen && previousScreen.screenData) {
    options = _.extend(options, { screenData: previousScreen.screenData });
  }

  // Go to the screen.
  toScreen(previousScreen.name, options);
  return true;
};
