// Setup variables
var selectedIndex = 0;
var currentDepth = 0;
var commandWindowOpen = false;
var bookmarksLoaded = false;
var cwd = "/Bookmarks bar";
var cwdId = 1;
var currentSuggestion;

// Retrives all bookmarks
chrome.bookmarks.getTree(function(BookmarkTreeNodes){
  initBookmarkNavigation(BookmarkTreeNodes);
  $(".nav-folder-depth").eq(currentDepth).addClass("current");
  $(".nav-folder-depth.current").children().children().addClass("visible");
  $(".nav-folder-depth.current").children().children().eq(selectedIndex).addClass("selected");
  bookmarksLoaded = true;
  updateVisible();

  setItemEvents();

  $("#command-input").on("input", function(event){
    onCommandChangedHandler($(this).text());
  });

  // Lazy way of starting in the "Bookmarks bar"
  moveRight();
});

// Maps action functions to keycode press.
window.onkeydown = function (e) {
  if (!bookmarksLoaded) {
    return;
  }
  var code = e.keyCode ? e.keyCode : e.which;
  if (commandWindowOpen) {
    if (code === 27) {
      hideCommandWindow();
      hideMessage();
    } else if (code === 13) {
      executeCommand();
    } else if (code === 9) {
      autoComplete();
      return false;
    }
    return;
  }
  if (code === 27) {
    hideMessage();
  } else if (code === 37 || code === 74) {
    moveLeft();
  } else if (code === 38 || code === 73 ) {
    moveUp();
  } else if (code === 39 || code === 76) {
    moveRight();
  } else if (code === 40 || code === 75) {
    moveDown();
  } else if (code === 13) {
  } else if (code === 46) {
    var currentId = $(".current ul").children(".visible").eq(selectedIndex).attr("id");
    deleteBookmark(currentId);
  } else if (code === 190) {
    showCommandWindow("", undefined, undefined, cwd);
  } else if (code === 9) {
    return false; // I hate tabbing
  }
};

/*
 * Shows a message or error to the user.
 * type as int: 0=info, 1=warning. 2=error
 */
function showMessage(type, title, message) {
  var messageBox = $("#message-output");
  messageBox.addClass("visible");

  var border = type;
  if (type != 0 && type != 1 && type != 2) {
    border = 0;
  }
  // Clear message box
  messageBox.removeClass("border-0");
  messageBox.removeClass("border-1");
  messageBox.removeClass("border-2");
  messageBox.empty();

  // Appends the message
  messageBox.addClass("border-" + border);
  messageBox.append("<h3>" + title + "</h3>");
  messageBox.append("<pre>" + message + "</pre>");
  messageBox.append("<p>Press <code>'Esc'</code> to close</p>")
}

function hideMessage(){
  $("#message-output").removeClass("visible");
  $("#message-output").empty();
}

function autoComplete(){
  if (!currentSuggestion) {
    return;
  }
  if (!currentSuggestion.suggestion) {
    return;
  }
  var inputField = $("#command-input");
  var parsed = parse(inputField.text());
  var currentArgument = getCurrentArgument(parsed, inputField.text());

  var newInput;
  if (currentArgument) {
    newInput = currentArgument.input + currentSuggestion.suggestion;
    inputField.text(newInput);
    if (currentArgument.cmd.args[currentArgument.argNumber + 1]) {
    inputField.append("&nbsp;");
    }
  } else {
    newInput = currentSuggestion.suggestion;
    inputField.text(newInput).append("&nbsp;");
  }

  currentSuggestion = "";

  // move cursor to the end of input field.
  var range = document.createRange();
  range.selectNodeContents(inputField[0]);
  range.collapse(false);
  var selection = window.getSelection();
  selection.removeAllRanges();
  selection.addRange(range);

  onCommandChangedHandler(inputField.text());
}

function cmdSuggestions(cmd) {
  var suggestions = [];
  for (var c in listOfCommands) {
    var typeSuggestion = undefined;
    for (var i = listOfCommands[c].variants.length - 1; i >= 0; i--) {
      if (listOfCommands[c].variants[i].startsWith(cmd)) {
        typeSuggestion = {'suggestion': listOfCommands[c].variants[i], 'info': ""};
      }
    }
    if (typeSuggestion) {
      suggestions.push(typeSuggestion);
    }
  }
  return suggestions;
}

function getCurrentArgument(parsed, input){
  var currentArgument = {'cmd': '', 'argNumber': '', 'argInput': '', 'input': ''};
  var cmd = parsed.command;
  var argNumber = parsed.args.length - 1;
  var currentArg = parsed.args.pop();

  if (argNumber >= 0) {
    for (var c in listOfCommands) {
      if (listOfCommands[c].variants.includes(cmd)) {
        currentArgument.cmd = listOfCommands[c];
        var arg = listOfCommands[c].args[argNumber];
        if (!arg) {
          break;
        }
        currentArgument.argInput = currentArg;
        currentArgument.argNumber = argNumber;
        currentArgument.input = cmd + " " + parsed.args.join(" ") + "";
        if (currentArgument.input[currentArgument.input.length - 1] != " ") {
          currentArgument.input += " ";
        }
        return currentArgument;
      }
    }
  }
}

function argumentSuggestions(parsed, input){
  var suggestions = [];

  currentArgument = getCurrentArgument(parsed, input);
  if (!currentArgument) {
    return suggestions;
  }

  var arg = currentArgument.cmd.args[currentArgument.argNumber];
  var argInput = currentArgument.argInput;

  var type = arg.type;
  if (type == "item") {
    var items = $(".current ul").children(".visible").map(function() {
      return {'suggestion': $(this).attr("id"), 'info': $(this).children("a").text()};
    }).get();
    for (var i = 0, len = items.length; i < len; i++) {
      if (items[i].suggestion.startsWith(argInput) || items[i].info.startsWith(argInput) || !argInput) {
        suggestions.push(items[i]);
      }
    }
  } else if (type == "folder") {
    var items = $(".current ul").children(".folder.visible").map(function() {
      return {'suggestion': $(this).attr("id"), 'info': $(this).children("a").text()};
    }).get();
    if (!argInput){
      items.unshift({'suggestion': "0", 'info': "/"});
    }
    for (var i = 0, len = items.length; i < len; i++) {
      if (items[i].suggestion.startsWith(argInput) || items[i].info.startsWith(argInput) || !argInput) {
        suggestions.push(items[i]);
      }
    }
  } else if (type == "string") {
    suggestions.push({'suggestion': "", 'info': arg.info});
  } else if (type == "int") {
    suggestions.push({'suggestion': "", 'info': arg.info});
  } else if (type == "update-item") {
    var items = $(".current ul").children(".visible").map(function() {
      var updateUrl;
      if ($(this).hasClass("folder")) {
        updateUrl = "";
      } else {
        var updateUrl = " " + $(this).children("a").attr("href");
      }
      var updateSuggestion = $(this).attr("id") + " " + escapeString($(this).children("a").text()) + updateUrl;
      return {'suggestion': updateSuggestion, 'info': $(this).children("a").text()};
    }).get();
    for (var i = 0, len = items.length; i < len; i++) {
      if (items[i].suggestion.startsWith(argInput) || items[i].info.startsWith(argInput) || !argInput) {
        suggestions.push(items[i]);
      }
    }
  }
  return suggestions;
}

function onCommandChangedHandler(input) {
  var suggestions = [];
  var parsed = parse(input);
  var cmd = parsed.command;
  var args = parsed.args;
  if (args.length == 0) {
    suggestions = cmdSuggestions(cmd);
  } else {
    suggestions = argumentSuggestions(parsed, input);
  }

  currentSuggestion = suggestions[suggestions.length - 1];

  var html = "";
  $(".command-input-box").children("ul").children(".suggestions").remove();
  if (suggestions){
    for (var i = 0, len = suggestions.length; i < len; i++) {
      html += '<li class="suggestions">' + suggestions[i].suggestion.substring(0, 30);
      if (suggestions[i].info) {
        html += ': ' + suggestions[i].info.substring(0, 30);
      }
      html += '</li>\n';
    }
    $(".command-input-box").children("ul").prepend(html);
  }
}

var listOfCommands = {
  'help': {
    'variants': [":help"],
    'args': [],
    'description': "Shows all commands and their descriptions."
  },
  'delete': {
    'variants': [":delete", ":remove", ":rm"],
    'args': [
      {'type': "item", 'info': "item to remove"}
    ],
    'description': "Deletes the specified item, can be booth bookmark and folder."
  },
  'move': {
    'variants': [":move", ":mv"],
    'args': [
      {'type': "item", 'info': "item to move"},
      {'type': "folder", 'info': "destination"},
      {'type': "int", 'info': "position index (optional)"}
    ],
    'description': "Moves the specified item to a destination folder at optional index, can be booth bookmark and folder."
  },
  'new': {
    'variants': [":new", ":add", ":create"],
    'args': [
      {'type': "string", 'info': "title"},
      {'type': "string", 'info': "URL (optinal)"},
      {'type': "int", 'info': 'position index (optinal)'}
    ],
    'description': "Creats a new folder or bookmark in the current folder. If no URL is specified, then a folder will be created."
  },
  'update': {
    'variants': [":update", ":change"],
    'args': [
      {'type': "update-item", 'info': "item to update"},
      {'type': "string", 'info': "title (optinal)"},
      {'type': "string", 'info': "URL (optinal)"}
    ],
    'description': "Updates the title and/or the URL of an existing bookmark or folder."
  },
};

function executeCommand() {
  if(!commandWindowOpen) {
    return;
  }
  var input = $("#command-input").text();
  var parsed = parse(input);
  var args = parsed.args;
  var cmd = parsed.command;
  if (listOfCommands.help.variants.includes(cmd)) {
    showHelp();
    return;
  } else if (listOfCommands.delete.variants.includes(cmd)) {
    if (args.length == 1 && args[0]) {
      deleteBookmark(args[0]);
      return;
    }
    showMessage(1, "Error :delete", "Invalid arguments");
  } else if (listOfCommands.move.variants.includes(cmd)) {
    var index = parseInt(args[2]);
    if (isNaN(index) || index < 0) {
      index = undefined;
    }
    if (args[0] && !args[3]) {
      moveBookmark(args[0], args[1], index);
      return;
    }
    showMessage(1, "Error :move", "Invalid arguments");
  } else if (listOfCommands.new.variants.includes(cmd)) {
    var index = parseInt(args[2]);
    if (isNaN(index) || index < 0) {
      index = undefined;
    }
    if (args[0] && !args[3]) {
      createBookmark(cwdId, args[0], args[1], index);
      return;
    }
    showMessage(1, "Error :new", "Invalid arguments");
  } else if (listOfCommands.update.variants.includes(cmd)) {
    if (args[0] && !args[3]) {
      updateBookmark(args[0], args[1], args[2]);
      return;
    }
    showMessage(1, "Error :new", "Invalid arguments");
  } else {
    showMessage(1, "Error", "Invalid command");
  }
  hideCommandWindow();
}

function showCommandWindow(question, info, extraInfo, prefix) {
  commandWindowOpen = true;
  var pre;
  if (prefix) {
    pre = prefix;
  } else {
    pre = "";
  }
  $(".command-window").addClass("visible");
  $("#command-prefix").text(pre);
  $("#question").text(question);
  $(".current ul").children(".visible").eq(selectedIndex).children("a").blur();
  $("#command-input").text('');
  $("#command-input").focus();
  $("#command-input").focusout(function(){
    hideCommandWindow();
  });
}

function hideCommandWindow() {
  if(commandWindowOpen) {
    commandWindowOpen = false;
    $(".command-window").removeClass("visible");
  }
}

function showHelp() {
  var message = "";

  for (var c in listOfCommands) {
    message += listOfCommands[c].variants[0];
    message += "\n  Variants:  ";
    for (var v in listOfCommands[c].variants) {
      message += listOfCommands[c].variants[v] + ", ";
    }
    if (listOfCommands[c].args[0]) {
      message += "\n  Arguments:";
      for (var a in listOfCommands[c].args) {
        message += "\n    Arg" + a + ":";
        message += "  type:" + listOfCommands[c].args[a].type;
        message += "  info:" + listOfCommands[c].args[a].info;
      }
    }
    message += "\n  Description:";
    message += "\n    " + listOfCommands[c].description;
    message += "\n\n";
  }
  showMessage(0, "Help page", message);
  hideCommandWindow();
}

function deleteBookmark(id) {
  chrome.bookmarks.get(id, function(result){
    if(chrome.runtime.lastError) {
      showMessage(1, "Error :delete", "Not a valid id");
    } else {
      if (result) {
        if (!result[0].url) {
          chrome.bookmarks.removeTree(id, function(){
            $("#" + id).remove();
            updateVisible();
            //success
            hideCommandWindow();
          });
        } else {
          chrome.bookmarks.remove(id, function(){
            $("#" + id).remove();
            updateVisible();
            //success
            hideCommandWindow();
          });
        }
      }
    }
  });
}

function moveBookmark(id, destinationId, destinationIndex) {
  chrome.bookmarks.get(id, function(result){
    if(chrome.runtime.lastError) {
      showMessage(1, "Error :move", "Not a valid id");
    } else {
      chrome.bookmarks.get(destinationId, function(result){
        if(chrome.runtime.lastError) {
          showMessage(1, "Error :move", "Destination not a valid id");
        } else {
          var destination = {'parentId':destinationId, 'index':destinationIndex};
          chrome.bookmarks.move(id, destination, function(newBookmark){
            if(chrome.runtime.lastError) {
              showMessage(1, "Error :move", chrome.runtime.lastError.message);
            } else {
              //Removing and recreating the bookmark in its new position
              $("#" + id).remove();
              insertBookmarkToHtml(newBookmark);

              hideCommandWindow();
            }
          });
        }
      });
    }
  });
}

function createBookmark(parentId, title, url, index) {
  chrome.bookmarks.get(parentId, function(result){
    if(chrome.runtime.lastError) {
      showMessage(1, "Error :create", "Not a valid parent id");
    } else {
      if (result) {
        var bookmark = {'parentId': cwdId, 'index':index, 'title':title, 'url':url};
        chrome.bookmarks.create(bookmark, function(newBookmark){
          if(chrome.runtime.lastError) {
            showMessage(1, "Error :create", chrome.runtime.lastError.message);
          } else {
            //success
            insertBookmarkToHtml(newBookmark);
            hideCommandWindow();
          }
        });
      }
    }
  });
}

function updateBookmark(id, title, url) {
  chrome.bookmarks.get(id, function(result){
    if(chrome.runtime.lastError) {
      showMessage(1, "Error :update", "Not a valid id");
    } else {
      if (result) {
        var changes = {'title':title, 'url':''};

        // Not a folder, so the url can be changed.
        if (result[0].url) {
          changes.url = url;
        }
        chrome.bookmarks.update(id, changes, function(newBookmark){
          if(chrome.runtime.lastError) {
            showMessage(1, "Error :update", chrome.runtime.lastError.message);
          } else {
            //Removing and recreating the bookmark with its updated values
            $("#" + id).remove();

            insertBookmarkToHtml(newBookmark);
            hideCommandWindow();
          }
        });
      }
    }
  });
}

function insertBookmarkToHtml(bookmark) {
  var html = bookmarkItemToHtml(bookmark);
  var parentDepth = $("#" + bookmark.parentId).parent().parent().index();
  if ($(".parent-" + bookmark.parentId).length > 0) {
    if (bookmark.index == 0) {
      $(".nav-folder-depth").eq(parentDepth + 1).children("ul").children(".parent-" + bookmark.parentId).first().before(html);
    } else {
      $(".nav-folder-depth").eq(parentDepth + 1).children("ul").children(".parent-" + bookmark.parentId).eq(bookmark.index - 1).after(html);
    }
  } else {
    $(".nav-folder-depth").eq(parentDepth + 1).children("ul").append(html);
  }
  $("#" + bookmark.id).addClass("visible");
  updateVisible();
}

var timeoutId;
function setItemEvents() {
  $(".folder").click(function() {
    selectThisItem($(this));
    moveRight();
  });
  $(".image, .video, .youtube").hover(function() {
    if (!timeoutId) {
      var thisItem = $(this);
      timeoutId = window.setTimeout(function() {
        timeoutId = undefined;
        selectThisItem(thisItem);
      }, 1000);
    }
  },
  function () {
    if (timeoutId) {
      window.clearTimeout(timeoutId);
      timeoutId = undefined;
    }
  });
}

function selectThisItem(thisItem) {
  console.log("Do i spam?");
  var currentId = $(".current ul").children(".visible").eq(selectedIndex).attr("id");
  var prevDepth = currentDepth;

  currentList = thisItem.parent().parent();
  currentDepth = currentList.index();
  $("#" + currentId).children("a").blur();
  $(".current").removeClass("current");
  currentList.addClass("current");
  currentList.parent().children().each(function(index) {
    if (currentDepth <= index && index <= prevDepth) {
      $(this).children("ul").children(".selected").removeClass("selected");
    }
  });
  thisItem.addClass("selected").children("a").focus();
  selectedIndex = $(".current").children("ul").children(".visible").index($(".current").children("ul").children(".selected").first());
  updateVisible();
}

function moveLeft() {
  var currentId = $(".current ul").children(".visible").eq(selectedIndex).attr("id");
  if (currentDepth > 0) {
    currentDepth -= 1;
    selectedIndex = 0;
    $("#" + currentId).removeClass("selected").children("a").blur();
    var previous = $(".nav-folder-depth").eq(currentDepth);
    $(".current").removeClass("current");
    previous.addClass("current");
    previous.children("ul").children(".selected").first().children("a").focus();
    setCwd();
    updateVisible();
  }
}

function moveUp() {
  var currentList = $(".current ul").children(".visible");
  if (selectedIndex > 0) {
    selectedIndex -= 1;
    currentList.eq(selectedIndex + 1).children("a").blur();
    currentList.eq(selectedIndex).addClass("selected").siblings().removeClass("selected");
    currentList.eq(selectedIndex).children("a").focus();
    updateVisible();
  }
}

function moveRight() {
  if ($(".preview-window").length != 0) {
    $(".preview-window").click();
    return;
  }

  // If navigating beond existing folder depth, create a new depth layer.
  var preview = $(".nav-folder-depth").eq(currentDepth + 1);
  if (preview.length == 0) {
    addEmptyFolderDepth();
    preview = $(".nav-folder-depth").eq(currentDepth + 1);
  }

  var currentId = $(".current ul").children(".visible.selected").first().attr("id");
  if ($("#" + currentId).hasClass("folder")) {
    currentDepth += 1;
    selectedIndex = 0;
    $("#" + currentId).children("a").blur();
    $(".current").removeClass("current");
    preview.addClass("current");
    if (preview.children("ul").children(".visible").length != 0){
      preview.children("ul").children(".visible").first().addClass("selected").children("a").focus();
    }
    setCwd();
    updateVisible();
  }
}

function moveDown() {
  var currentList = $(".current ul").children(".visible");
  if (selectedIndex < currentList.length - 1) {
    selectedIndex += 1;
    currentList.eq(selectedIndex - 1).children("a").blur();
    currentList.eq(selectedIndex).addClass("selected").focus().siblings().removeClass("selected");
    currentList.eq(selectedIndex).children("a").focus();
    updateVisible();
  }
}

function setCwd(){
  var currentPath = $(".nav-folder-depth ul .selected").slice(0, currentDepth);
  var pathArray = currentPath.children("a").map(function() {
    return $(this).text();
  }).get();
  cwd = "/" + pathArray.join('/');
  cwdId = currentPath.last().attr("id");
}

function updateVisible() {
  var currentId = $(".current ul").children(".visible.selected").first().attr("id");
  if (!currentId) {
    if ($(".current ul").children(".visible").length <= selectedIndex) {
      selectedIndex -= 1;
    }
    var currentItem = $(".current ul").children(".visible").eq(selectedIndex);
    currentItem.children("a").focus();
    currentItem.addClass("selected");
    currentId = currentItem.attr("id");
  } else {
    selectedIndex = $(".current").children("ul").children(".visible").index($(".current").children("ul").children(".selected").first());
  }
  var preview = $(".nav-folder-depth").eq(currentDepth + 1).children("ul");
  var fog = $(".nav-folder-depth").eq(currentDepth + 2).children("ul");
  if (preview.length != 0) {
    preview.children().removeClass("visible");
    preview.children(".parent-" + currentId).addClass("visible");
  }
  if (fog.length != 0) {
    fog.children().removeClass("visible");
  }

  //if there was a previous url preview remove it
  var previewDepth = $(".nav-folder-depth").eq(currentDepth + 1)
  previewDepth.removeClass("preview-depth");
  $(".preview-window").remove();

  //Check if its an image and atempts to preview it:
  var url = $("#" + currentId).children("a").attr("href");
  var title = $("#" + currentId).children("a").text();
  var previewWindow = previewDepth.children("ul");
  var html = "";
  if($("#" + currentId).hasClass("image")) {
    html += '<li class="preview-window">';
    html += '<a>' + title + '</a>';
    html += '<img class="preview-content" src="' + url + '">';
    html += '</li>';
    previewWindow.append(html);
    previewDepth.addClass("preview-depth");
  } else if($("#" + currentId).hasClass("video")) {
    html += '<li class="preview-window">';
    html += '<a>' + title + '</a>';
    html += '<video class="preview-content" autoplay loop muted><source src="' + url + '"></video>';
    html += '</li>';
    previewWindow.append(html);
    previewDepth.addClass("preview-depth");
  } else if($("#" + currentId).hasClass("youtube")) {
    youtubeId = youtubeParser(url)
    html += '<li class="preview-window">';
    html += '<a>' + title + '</a>';
    html += '<img class="preview-content" src="https://i.ytimg.com/vi/' + youtubeId + '/maxresdefault.jpg">';
    html += '</li>';
    previewWindow.append(html);
    previewDepth.addClass("preview-depth");
    $(".preview-window").click(function() {
      var w = $(this).width();
      var h = $(this).height();
      $(this).children(".preview-content").replaceWith('<iframe width="' + w + '" height="' + h + '" class="preview-content" src="https://www.youtube.com/embed/' + youtubeId + '?autoplay=1"></iframe>');
    });
  }
}

function youtubeParser(url){
    var regExp = /^.*((youtu.be\/)|(v\/)|(\/u\/\w\/)|(embed\/)|(watch\?))\??v?=?([^#\&\?]*).*/;
    var match = url.match(regExp);
    return (match && match[7].length==11) ? match[7] : false;
}

function addEmptyFolderDepth(){
  var html = '<li class="nav-folder-depth"><ul></ul></li>';
  $(".bookmark-root .nav-folders").append(html);
}

// Creats the html for and appends all bookmarks.
function initBookmarkNavigation(BookmarkTree) {
  var root = BookmarkTree[0];
  var html = '<ul class="nav-folders">\n';
  var queue = root.children;
  var depth = 0;
  while (true) {
    html += '  <li class="nav-folder-depth">\n    <ul>\n';
    var len = queue.length;
    for (var i = 0; i < len; i++) {
      item = queue.shift();
      html += bookmarkItemToHtml(item);
      if (item.children) {
        queue = queue.concat(item.children);
      }
    }
    html += '\n    </ul>\n  </li>\n\n';
    if (queue.length <= 0) {
      break;
    }
  }
  html += '  <li class="nav-folder-depth">\n    <ul>\n    </ul>\n  </li>\n</ul>';
  $(".bookmark-root").append(html);
}

// Creats html based on a bookmark
function bookmarkItemToHtml(item) {
  var html = "";
  html += '      <li id="' + item.id + '" class="';
  if (item.parentId) {
    html += 'parent-' + item.parentId + ' ';
  }
  if (!item.url) {
    html += 'folder';
  } else {
    html += 'link';
    youtubeId = youtubeParser(item.url);
    if (/.*\.(gif|webp|jpe?g|bmp|png)$/.test(item.url) || /.*\.(gif|webp|jpe?g|bmp|png)\?[^\/]+$/.test(item.url)) {
      html += ' image';
    } else if (/.*\.(mp4|webm|ogg)$/.test(item.url) || /.*\.(mp4|webm|ogg)\?[^\/]+$/.test(item.url)) {
      html += ' video';
    } else if (youtubeId) {
      html += ' youtube';
    }
  }
  html += '">\n        ';
  if (!item.url) {
    html += '<a href=#folder-' + item.id + '>' + item.title + '</a>';
  } else {
    html += '<a href="' + item.url + '">' + item.title + '</a>';
  }
  html += '\n      </li>\n';
  return html;
}
