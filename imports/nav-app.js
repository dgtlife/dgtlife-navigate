/**
 * @file Defines the functions for App Mode
 * @author Derek Gransaull <derek@dgtlife.com>
 * @copyright DGTLife, LLC 2016
 */
import { Meteor } from 'meteor/meteor';
import {
  config,
  navStackLength,
  toScreen,
  waitForCondition
} from './nav-common.js';

/*
 * The navigation stack (nav stack) keeps track of the screen transition
 * history for App Mode, i.e. when browser history is not being.
 */
export const navStack = [];

/**
 * Start app mode, i.e. without support for an entered URL or reload of a
 * specific screen. Instead, go to the public "Home" screen or user "Home"
 * screen on load.
 * @param {string} publicHome - the screen that public users start at
 * @param {string} userHome - the screen that authenticated users start at
 */
export const startAppMode = (publicHome, userHome) => {
  if (navStack.length === 0) {
    // We are loading (for the first time).
    if (Meteor.userId && Meteor.userId()) {
      // It's a user session, but wait for the user object to be ready.
      waitForCondition(
        Meteor.user,
        () => {
          // Wait for any other conditions to be ready.
          waitForCondition(
            'okToLoad',
            () => {
              toScreen(userHome);
            }
          );
        }
      );
    } else {
      // It's not a user session, so just wait for any other conditions.
      waitForCondition(
        'okToLoad',
        () => {
          toScreen(publicHome);
        }
      );
    }
  } else {
    // It's an app reload, so go to the screen at the top of the navStack??
    // ToDo: Investigate a mechanism to store/retrieve state for mobile case
    toScreen(navStack[navStack.length - 1], { shouldUpdateNavStack: false });
  }
};

/**
 * Whether we are in App mode or not.
 */
export const inAppMode = () =>
  config.inAppModeOnIos || config.inAppModeOnAndroid;

/**
 * Update the navigation stack (in App mode only).
 * @param {string} name - the name of the current screen
 * @param {string|function} title - the title property of the screen
 * @param {object} screenData - the screen data associated with a
 *                              parameterized path
 */
export const updateNavStack = (name, title, screenData) => {
  const pushToNavStackAndUpdateLength = (screenState, _title) => {
    // Add the title to the screen state.
    _.extend(screenState, { title: _title });

    // Update the nav stack and the reactive variable with its length.
    navStack.push(screenState);
    navStackLength.set(navStack.length);
  };

  if (inAppMode()) {
    // We are in app mode. Initialize the screen state object.
    const screenState = {
      name: name
    };

    // Add screen data if it is provided.
    if (screenData) {
      _.extend(screenState, { screenData: screenData });
    }

    if (_.isFunction(title)) {
      // Compute the title.
      Tracker.autorun((comp) => {
        if (title()) {
          pushToNavStackAndUpdateLength(screenState, title());
          comp.stop();
        }
      });
    } else {
      // Assign the title.
      pushToNavStackAndUpdateLength(screenState, title);
    }
  }
};

/**
 * Reset the navigation stack, i.e. clear it and use the named screen as the
 * new starting point of navigation.
 * @param {string} name - the name of the screen
 */
export const resetNavStack = (name) => {
  if (inAppMode()) {
    check(name, String);
    navStack.length = 0;
    toScreen(name);
  }
};
