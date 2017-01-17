/**
 * @file Define the dgtlife:navigate package
 * @author Derek Gransaull <derek@dgtlife.com>
 * @copyright DGTLife, LLC 2014
 */
Package.describe({
  summary: 'Navigate is a simple lightweight navigation package for ' +
           'Meteor-based web apps',
  version: '0.8.6',
  name: 'dgtlife:navigate',
  git: ''
});

Package.onUse((api) => {
  api.use('ecmascript', 'client');
  api.use('templating', 'client');
  api.use('reactive-dict', 'client');
  api.use('reactive-var', 'client');
  api.use('underscore', 'client');
  api.use('check', 'client');

  api.mainModule('nav.js', 'client');
});
