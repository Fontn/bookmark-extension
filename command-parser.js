// '\n' and '\t' don't work in bookmark names, but
// for other usecases they can be added here as: 'n': '\n', 't': '\t'
var escapableChars = {
  '\"': '\"',
  '\'': '\'',
  '\\': '\\'
}

// Parses a string and returns a json object with the
// command(first part of input) and list of arguments.
function parse(string) {
  var output = {'command': '', 'args': []};
  if (typeof string !== 'string') {
    return;
  }

  var items = [];
  var quotes = false;
  var escaped = false;
  var currentItem = "";
  for (var i = 0, len = string.length; i < len; i++) {
    var c = string[i];
    if (c == '\\') {
      if (escaped) {
        escaped = false;
        currentItem += c;
      } else {
        escaped = true;
      }
    } else if (c == '\"' || c == '\'') {
      if (escaped) {
        escaped = false;
        currentItem += c;
      } else {
        if (quotes) {
          quotes = false;
        } else {
          quotes = true;
        }
      }
    } else {
      if (escaped) {
        escaped = false;
        if (escapableChars[c]) {
          currentItem += escapableChars[c]
        }
      } else {
        if (quotes) {
          currentItem += c;
        } else {
          if (c.trim() != '') {
            currentItem += c;
          }
        }
      }
    }
    // Add the current item to the list of items.
    if (c.trim() == '' && !quotes && i > 0) {
      if (string[i - 1].trim() != '') {
        items.push(currentItem);
        currentItem = "";
      }
    }
  }
  items.push(currentItem);
  if (items.length >= 1) {
    output.command = items.shift();
    output.args = items;
  }
  return output;
}

// Parses a string so that special chars are split up into '\\' + 'n'
// and surounds the string with quotes.
function escapeString(string){
  var escaped = false;
  var output = '\"';
  for (var i = 0, len = string.length; i < len; i++) {
    var c = string[i];
    escaped = false;
    for (var key in escapableChars) {
      if (escapableChars[key] == c) {
        output += "\\" + key;
        escaped = true;
        break;
      }
    }
    if (!escaped) {
      output += c;
    }
  }
  return output + '\"';
}
