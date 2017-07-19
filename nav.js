/**
 * @file Defines exports for the Navigate package
 * @author Derek Gransaull <derek@dgtlife.com>
 * @copyright DGTLife, LLC 2017
 */
import {
  registerScreen,
  run,
  toScreen,
  currentScreen,
  getScreen,
  screenData,
  navStackLength,
  isComputing,
  toHome,
  getPreviousTitle,
  back
} from './imports/nav-common.js';
import { resetNavStack } from './imports/nav-app.js';

export {
  registerScreen,
  run,
  toScreen,
  currentScreen,
  getScreen,
  screenData,
  navStackLength,
  isComputing,
  toHome,
  getPreviousTitle,
  back,
  resetNavStack
};
