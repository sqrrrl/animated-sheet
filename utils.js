
function buildResizeRequests(height, width, rowOffset = 0, columnOffset = 0) {
  const requests = [];
  requests.push({
    updateSheetProperties: {
      properties: {
        gridProperties: {
          rowCount: height + rowOffset,
          columnCount: width + columnOffset,
        },
      },
      fields: 'gridProperties.rowCount, gridProperties.columnCount',
    },
  });
  // Resize cells
  requests.push({
    updateDimensionProperties: {
      range: {
        dimension: 'ROWS',
        startIndex: rowOffset,
      },
      properties: {
        pixelSize: 4,
      },
      fields: '*',
    },
  });
  requests.push({
    updateDimensionProperties: {
      range: {
        dimension: 'COLUMNS',
        startIndex: columnOffset,
      },
      properties: {
        pixelSize: 4,
      },
      fields: '*',
    },
  });
  return requests;
}

function numberToColor(color) {
  return {
    red: ((color >>> 16) & 0xFF) / 255,
    green: ((color >>> 8) & 0xFF) / 255,
    blue: ((color) & 0xFF) / 255,
    alpha: 1,
  };
}

function getColorForPixel(gif, x, y, frameIndex) {
  for (let i = frameIndex; i >= 0; --i) {
    const frame = gif.frames[i];
    if (x >= frame.xOffset && x < frame.xOffset + frame.bitmap.width &&
                y >= frame.yOffset && y < frame.yOffset + frame.bitmap.height) {
      // Drop the alpha channel
      return frame.getRGBA(x - frame.xOffset, y - frame.yOffset) >>> 8;
    }
  }
}

exports.buildResizeRequests = buildResizeRequests;
exports.numberToColor = numberToColor;
exports.getColorForPixel = getColorForPixel;

