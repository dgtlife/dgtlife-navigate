/**
 * @file Defines the functions for Browser Mode
 * @author Derek Gransaull <derek@dgtlife.com>
 * @copyright DGTLife, LLC 2016
 */
import { Meteor } from 'meteor/meteor';
import {
  config,
  screens,
  pathLookup,
  toScreen,
  waitForCondition
} from './nav-common.js';

/**
* Register an event listener for clicks on the Back and Forward buttons of
* the browser in order to support navigation along the browser history.
*/
export const handleBrowserBackAndForward = () => {
  window.addEventListener('popstate', (event) => {
    if (event.state) {
      /*
       * Go to the screen indicated by the state object, but don't update the
       * browser history. Supply any screen data that the state object
       * contains.
       */
      const options = { shouldUpdateBrowserHistory: false };
      if (event.state.screenData) {
        _.extend(options, { screenData: event.state.screenData });
      }

      toScreen(event.state.name, options);
    }
  });
};

/**
 * Load an allowed screen in browser mode, with any included screen data.
 * @param {object} screenSpec - an object that contains the 'name' key, of the
 *                              screen object and optionally a 'screenData'
 *                              object
 */
export const loadTargetScreenInBrowserMode = (screenSpec) => {
  const name = screenSpec.name;
  const options = _.omit(screenSpec, 'name');

  // Check if
  if (window.history.state) {
    //  A browser history object exists.
    if (name === window.history.state.name) {
      /**
       * The current screen is the requested one, so we are reloading. Wait on
       * any relevant conditions, but do not update the browser history.
       */
      waitForCondition(
        'okToReload',
        () => {
          _.extend(options, { shouldUpdateBrowserHistory: false });
          toScreen(name, options);
        }
      );
    } else {
      // Go to this new screen.
      toScreen(name, options);
    }
  } else {
    /**
     * This is likely a first load in a new window or tab, so go to this
     * screen, after any relevant conditions are ready.
     */
    waitForCondition(
      'okToLoad',
      () => {
        toScreen(name, options);
      }
    );
  }
};

/**
 * A helper function for processing access control. It loads a screen if it
 * 'is allowed', or loads 'Access Denied' if it is not.
 * @param {object} screenSpec - an object that contains the 'name' key, of the
 *                              screen object and optionally a 'screenData'
 *                              object
 * @param {boolean} isAllowed - TRUE if the screen is allowed for the user
 */
const applyAccessControl = (screenSpec, isAllowed) => {
  if (isAllowed) {
    // The light is green.
    loadTargetScreenInBrowserMode(screenSpec);
  } else {
    // The light is red. Show 'Access Denied'
    toScreen('Access Denied');
  }
};

/**
 * Evaluate the 'isAllowed' function, if one is associated with the screen.
 * Otherwise, just use the boolean.
 * @param {object} screenSpec - an object that contains the 'name' and
 *                              'isAllowed' keys, of the screen object and
 *                              optionally a 'screenData' object
 */
const isScreenAllowed = (screenSpec) => {
  let screen = screenSpec;
  const isAllowed = screen.isAllowed;
  screen = _.omit(screen, 'isAllowed');

  // Evaluate the screen access control function, or apply the boolean.
  if (_.isFunction(isAllowed)) {
    /*
     * If it's a user session, we may need to wait for Meteor.user() to be
     * defined before evaluating the access control function.
     */
    if (Meteor.userId && Meteor.userId()) {
      if (Meteor.user()) {
        // The user object is ready, so evaluate the function.
        applyAccessControl(screen, isAllowed());
      } else {
        // The user object is not ready, so wait for it, ...
        waitForCondition(
          Meteor.user,
          () => {
            // ... then evaluate the function.
            applyAccessControl(screen, isAllowed());
          }
        );
      }
    } else {
      // It's not a user session, so proceed.
      applyAccessControl(screen, isAllowed());
    }
  } else {
    // It's a simple boolean.
    applyAccessControl(screen, isAllowed);
  }
};

/**
 * Retrieve the screen data associated with the parameter(s) in a path.
 * @param {array} execResult - the result of calling the 'exec' method of the
 *                             RegExp pattern against the path
 * @param {object} screenSpec - an object that contains the 'name',
 *                              'isAllowed', and 'getDataFromParams' keys of the
 *                              screen object
 */
const retrieveScreenData = (execResult, screenSpec) => {
  let screen = screenSpec;
  if (!screen.getDataFromParams) {
    throw new Error(
      'Missing "getDataFromParams" method for this parameterized path'
    );
  }

  /*
   * It is likely that the screen data result will depend on calls to the
   * database, so 'getDataFromParams' must use a callback to send its result.
   */
  screen.getDataFromParams(execResult, (result, error) => {
    if (!error) {
      /*
       * Remove the 'getDataFromParams' key from the screenSpec. Add in the
       * screen data. Then check whether the screen is allowed.
       */
      screen = _.omit(screen, 'getDataFromParams');
      screen = _.extend(screen, { screenData: result });
      isScreenAllowed(screen);
    } else {
      throw new Error(`Error retrieving data for ${screen.name}`);
    }
  });
};

/**
 * Check whether the path is a parameterized path or not.
 * @param {object} registeredPath - the registered path object that contains
 *                                  the RegExp pattern that matches the path
 * @param {string} path - the path
 */
const checkForPathParameters = (registeredPath, path) => {
  const screen = _.findWhere(screens, { name: registeredPath.name });

  // Use the 'exec' method on the RegExp to check for parameters.
  const execResult = registeredPath.pathPattern.exec(path);
  let screenSpec;
  if (execResult.length === 1) {
    /*
     * There are no parameters in this path. So check whether the screen is
     * allowed.
     */
    screenSpec = _.pick(screen, 'name', 'isAllowed');
    isScreenAllowed(screenSpec);
  } else {
    /*
     * One or more parameters will need to be extracted, and this means we
     * will need to retrieve screen data in order to render the screen.
     */
    screenSpec = _.pick(screen, 'name', 'isAllowed', 'getDataFromParams');
    retrieveScreenData(execResult, screenSpec);
  }
};

/**
 * Find the registered path that contains the RegExp pattern that matches
 * (is satisfied by) a path.
 * @param {string} path - the path
 */
const findPathPatternMatch = (path) => {
  const matchedPath = _.find(pathLookup, registeredPath =>
    registeredPath.pathPattern.test(path));

  if (matchedPath) {
    /*
     * We have a matched path pattern, and matchedPath is the stored path
     * object that produced the match. Now, check for path parameters.
     */
    checkForPathParameters(matchedPath, path);
  } else {
    /*
     * We have no matched path pattern. The path is not known, so show the
     * 'Not Found' screen.
     */
    toScreen('Not Found');
  }
};

/**
 * Account for the trailing slash, i.e. remove it if required by the config.
 * @param {string} path - a path with or without a trailing slash
 * @returns {string} - a path with or without a trailing slash
 */
const accountForTrailingSlash = (path) => {
  // If it's '/', we're done.
  if (path === '/') {
    return path;
  }

  // Remove the trailing slash, if the option is set in config.
  if ((path.slice(-1) === '/') && (config.ignoreTrailingSlash)) {
    return path.slice(0, -1);
  }

  return path;
};

/**
 * Start the processing that (eventually) loads the screen that corresponds to
 * the path in the browser.
 * @param {string} path - the current path in the browser
 */
export const startBrowserMode = path =>
  findPathPatternMatch(accountForTrailingSlash(path));

/**
 * Update the browser history to enable support for Back and Forward buttons
 * used in Browser mode.
 * @param {string} name - the name of the current screen
 * @param {string} path - the path (unparameterized case) associated with the
 *                        screen
 * @param {string} pathMask - the mask for a parameterized path
 * @param {function} generatePath - the definition for the function that
 *                                  generates the path from the path mask and
 *                                  the screen data (it's screen-specific)
 * @param {object} screenData - the screen data associated with a
 *                              parameterized path
 */
export const updateBrowserHistory =
  (name, path, pathMask, generatePath, screenData) => {
    // Initialize the screen state object.
    const screenState = {
      sid: (function getSid() {
        if (_.isNull(window.history.state)) {
          return 1;
        }

        return 1 + window.history.state.sid;
      }()),
      name: name
    };

    // Add screen data if it is provided.
    let params;
    if (screenData) {
      _.extend(screenState, { screenData: screenData });
      params = screenData.params;
    } else {
      params = null;
    }

    if (pathMask && params && !path) {
      /*
       * This is a parameterized path. Construct the pathname by using the
       * path mask and the parameters provided.
       */
      const parameterizedPath = generatePath(pathMask, params);

      // Push the state, document.title, and path into browser history.
      window.history.pushState(screenState, document.title, parameterizedPath);
    } else {
      /*
       * This is a literal path. Push the state, document.title, and path into
       * the browser history.
       */
      window.history.pushState(screenState, document.title, path);
    }
  };
