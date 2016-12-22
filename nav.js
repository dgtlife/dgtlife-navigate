/**
 * @file Defines and exports the Nav object.
 * @author Derek Gransaull <derek@dgtlife.com>
 * @copyright DGTLife, LLC 2016
 *
 * Created on 12/14/16
 */
import {
  registerScreen,
  run,
  toScreen,
  currentScreen,
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
  screenData,
  navStackLength,
  isLoading,
  toHome,
  getPreviousTitle,
  back,
  resetNavStack
};
