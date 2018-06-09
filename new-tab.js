// Setup variables
var selectedIndex = 0;
var currentDepth = 0;
var commandWindowOpen = false;
var bookmarksLoaded = false;
var cwd = "/";
var cwdId = 0;
var currentSuggestion;

// Retrives all bookmarks
chrome.bookmarks.getTree(function(BookmarkTreeNodes){
  initBookmarkNavigation(BookmarkTreeNodes);
  $("#0").addClass("selected").addClass("visible");
  $(".nav-folder-depth").eq(currentDepth).addClass("current");
  bookmarksLoaded = true;
  updateVisible();

  setFolderEvents();

  $("#command-input").on("input", function(event){
    onCommandChangedHandler($(this).text());
  });

  // Lazy way of starting in the "Bookmarks bar"
  moveRight();
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
    } else if (code === 13) {
      console.log("enter");
      executeCommand();
    } else if (code === 9) {
      autoComplete();
      return false;
    }
    return;
  }
  if (code === 37 || code === 74) {
    moveLeft();
  } else if (code === 38 || code === 73 ) {
    moveUp();
  } else if (code === 39 || code === 76) {
    moveRight();
  } else if (code === 40 || code === 75) {
    moveDown();
  } else if (code === 13) {
    console.log("enter");
  } else if (code === 46) {
    var currentId = $(".current ul").children(".visible").eq(selectedIndex).attr("id");
    deleteBookmark(currentId);
  } else if (code === 190) {
    showCommandWindow("", undefined, undefined, cwd);
  } else if (code === 9) {
    return false; // I hate tabbing
  }
};

function autoComplete(){
  if (!currentSuggestion) {
    return;
  }
  if (!currentSuggestion.suggestion) {
    return;
  }
  var inputField = $("#command-input");
  var currentArgument = getCurrentArgument(inputField.text());

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
  console.log(newInput);

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
  cmd = cmd[0];
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

function getCurrentArgument(input){
  var currentArgument = {'cmd': '', 'argNumber': '', 'argInput': '', 'input': ''};
  var allArgs = input.match(/("[^"]+$|'.*?'|".*?"|\S+)/g);
  if (!allArgs) {
    allArgs = [];
  }
  var cmd = allArgs.shift();
  var argNumber = allArgs.length - 1;
  var currentArg = allArgs.pop();

  if (/\s$/.test(input) && !/\s$/.test(currentArg)) {
    argNumber += 1;
    currentArg = "";
  }

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
        currentArgument.input = input.substring(0, input.length - currentArg.length);
        return currentArgument;
      }
    }
  }
}

function argumentSuggestions(input){
  var suggestions = [];

  currentArgument = getCurrentArgument(input);
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
  }
  return suggestions;
}

function onCommandChangedHandler(input) {
  var suggestions = [];
  var cmd = input.match(/^\:\w*$/);
  if (cmd) {
    suggestions = cmdSuggestions(cmd);
  } else {
    suggestions = argumentSuggestions(input);
  }

  currentSuggestion = suggestions[suggestions.length - 1];

  var html = "";
  $(".command-input-box").children("ul").children(".suggestions").remove();
  if (suggestions){
    for (var i = 0, len = suggestions.length; i < len; i++) {
      html += '<li class="suggestions">' + suggestions[i].suggestion;
      if (suggestions[i].info) {
        html += ': ' + suggestions[i].info.substring(0, 30);
      }
      html += '</li>\n';
    }
    $(".command-input-box").children("ul").prepend(html);
  }
}

var listOfCommands = {
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
  }
};

function executeCommand() {
  if(!commandWindowOpen) {
    return;
  }
  var input = $("#command-input").text();
  var args = input.split(' ');
  var cmd;
  if (Array.isArray(args)) {
    cmd = args.shift();
  } else {
    cmd = args;
  }
  console.log(input.match(/'(.*?)'|"(.*?)"|(\S)+/g));
  if (listOfCommands.delete.variants.includes(cmd)) {
    if (args.length == 1 && args[0]) {
      deleteBookmark(args[0]);
      return;
    }
    console.warn("Error: :delete invalid arguments");
  } else if (listOfCommands.move.variants.includes(cmd)) {
    if (args.length == 2 && args[0] && args[1]) {
    }
    console.warn("Error: :move invalid arguments");
  } else if (listOfCommands.new.variants.includes(cmd)) {
    console.warn("Error: :new invalid arguments");
  } else {
    console.warn("invalid command");
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

function deleteBookmark(id) {
  chrome.bookmarks.get(id, function(result){
    if(chrome.runtime.lastError) {
      console.warn("Error: :delete not a valid id");
    } else {
      if (result) {
        if (result.children) {
          chrome.bookmarks.removeTree(id, function(){
            moveUp();
            $("#" + id).remove();
          });
        } else {
          chrome.bookmarks.remove(id, function(){
            moveUp();
            $("#" + id).remove();
          });
        }
      }
    }
  });
}

function setFolderEvents() {
  $(".folder").click(function() {
    var currentId = $(".current ul").children(".visible").eq(selectedIndex).attr("id");
    var prevDepth = currentDepth;

    currentList = $(this).parent().parent();
    currentDepth = currentList.index();
    $("#" + currentId).removeClass("selected").children("a").blur();
    $(".current").removeClass("current");
    currentList.addClass("current");
    currentList.parent().children().each(function(index) {
      if (currentDepth <= index && index < prevDepth) {
        console.log(index)
        $(this).children("ul").children(".selected").removeClass("selected");
      }
    });
    $(this).addClass("selected").children("a").focus();
    selectedIndex = $(".current").children("ul").children(".selected").first().index();
    updateVisible();
    moveRight();
  });
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
    selectedIndex = previous.children("ul").children(".selected").first().index();
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
  var currentId = $(".current ul").children(".visible").eq(selectedIndex).attr("id");
  var preview = $(".nav-folder-depth").eq(currentDepth + 1);
  if ($(".preview-window").length != 0) {
    $(".preview-window").click();
    return;
  }
  if (preview.children("ul").children(".visible").length != 0) {
    currentDepth += 1;
    selectedIndex = 0;
    $("#" + currentId).children("a").blur();
    $(".current").removeClass("current");
    preview.addClass("current");
    preview.children("ul").children(".visible").first().addClass("selected").children("a").focus();
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
  var currentPath = $(".nav-folder-depth ul .selected:not(:last)");
  var pathArray = currentPath.children("a").map(function() {
    return $(this).text();
  }).get();
  cwd = pathArray.join('/');
  cwdId = currentPath.last().attr("id");
}

function updateVisible() {
  var currentId = $(".current ul").children(".visible").eq(selectedIndex).attr("id");
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
    return (match&&match[7].length==11)? match[7] : false;
}

// Creats the html for and appends all bookmarks.
function initBookmarkNavigation(BookmarkTree) {
  // $(".bookmark-root");
  var root = BookmarkTree[0];
  root.title = "\/";
  console.log(root)
  var html = '<ul class="nav-folders">\n';
  var queue = new Array(root);
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
  if (item.children) {
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
  if (item.children) {
    html += '<a href=#folder-' + item.id + '>' + item.title + '</a>';
  } else {
    html += '<a href="' + item.url + '">' + item.title + '</a>';
  }
  html += '\n      </li>\n';
  return html;
}