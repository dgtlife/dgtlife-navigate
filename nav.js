/**
 * @file Defines and exports the Nav object.
 * @author Derek Gransaull <derek@dgtlife.com>
 * @copyright DGTLife, LLC 2016
 */
import {
  registerScreen,
  run,
  toScreen,
  currentScreen,
  getScreen,
  screenData,
  navStackLength,
  isLoading,
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
  isLoading,
  toHome,
  getPreviousTitle,
  back,
  resetNavStack
};
