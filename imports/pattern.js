/**
 * @file Defines the Pattern namespace which holds patterns for Match.
 * @author Derek Gransaull <derek@dgtlife.com>
 * @copyright DGTLife, LLC 2016
 */
 /* eslint new-cap: ["error", { "capIsNewExceptionPattern": "^Match\.." }] */
import { Match } from 'meteor/check';

const Pattern = {
  // Match pattern for a non-empty string
  nonEmptyString: Match.Where((value) => {
    check(value, String);
    return value.length > 0;
  }),

  // Match pattern for function.
  function: Match.Where(val => val instanceof Function),

  // Match pattern for RegExp.
  regExp: Match.Where(val => val instanceof RegExp),

  // Match pattern for string or function.
  nonEmptyStringOrFunction: Match.Where(
    val => Match.test(val, Pattern.nonEmptyString) || (val instanceof Function)
  ),

  // Match pattern for null or function.
  nullOrFunction: Match.Where(
    val => Match.test(val, null) || (val instanceof Function)
  ),

  // Match pattern for undefined or function.
  undefinedOrFunction: Match.Where(
    val => Match.test(val, undefined) || (val instanceof Function)
  ),

  // Match pattern for boolean or function.
  booleanOrFunction: Match.Where(
    val => (typeof val === 'boolean') || (val instanceof Function)
  )
};

export default Pattern;
