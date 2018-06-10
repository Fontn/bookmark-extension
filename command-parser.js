// Parses a string and returns a json object with the command(first part of input) and list of arguments.
function parse(string) {
  var output = {'command': '', 'args': []};
  if (typeof string !== 'string') {
    return;
  }

  var items = [];
  var quotes = false;
  var currentItem = "";
  for (var i = 0, len = string.length; i < len; i++) {
    var c = string[i];
    if (c == '\"' || c == '\'') {
      if (currentItem[currentItem.length - 1] == '\\') {
        currentItem += c;
      } else {
        if (quotes) {
          quotes = false;
        } else {
          quotes = true;
        }
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
