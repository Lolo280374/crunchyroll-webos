'use strict';

const path = require('path');

// This is a custom Jest transformer turning file imports into filenames.
// http://facebook.github.io/jest/docs/en/webpack.html

module.exports = {
	process(src, filename) {
		const assetFilename = JSON.stringify(path.basename(filename));
		return {
			code: `module.exports = ${assetFilename};`
		};
	}
};
