"use strict";

(function () {
  const portName = "ytm-translate-port",
    translateAction = "translate",
    backAction = "back",
    dataAction = "data",
    selectAction = "select",
    initAction = "init";

  const baseClass = "ytm-base",
    pageClass = "ytm-page",
    mainClass = "ytm-main",
    mainTextClass = "ytm-main-text",
    menuClass = "ytm-menu",
    menuTextClass = "ytm-menu-text",
    menuItemClass = "ytm-menu-item",
    menuItemSelectedClass = "ytm-menu-item-selected",
    menuItemSelectedTextClass = "ytm-menu-item-selected-text",
    menuItemLeftClass = "ytm-menu-item-left",
    menuItemRightClass = "ytm-menu-item-right",
    menuHotkeyClass = "ytm-hotkey";

  const paddingBottom = 20,
    keyMaxDuration = 250,
    timeoutHide = 750,
    timeoutSlide = 200,
    keyMenu = "Shift",
    borderColor = { R: 91, G: 192, B: 222, A: 0.2 },
    borderRGBA = `rgba(${borderColor.R},${borderColor.G},${borderColor.B},${borderColor.A})`,
    borderColorText = { R: 119, G: 202, B: 119, A: 0.2 },
    borderTextRGBA = `rgba(${borderColorText.R},${borderColorText.G},${borderColorText.B},${borderColorText.A})`,
    hideFrames = 10,
    waitFrames = 25,
    fps = 25;

  const firstSelect = 1,
    lastSelect = 2,
    prevSelect = 3,
    nextSelect = 4,
    keySelect = 5,
    backSelect = 6,
    indexSelect = 7;

  let portBS = chrome.runtime.connect({ name: portName });

  class Menu {
    constructor() {
      this.keyMenu = new Hotkey(keyMenu);
      this.keyMenuDown = false;
      this.keyMenuTime = 0;

      this._visible = false;
      this._activeElement = null;
      this._isTextSelected = false;
      this._isEnter = false;
      this._isFocused = false;

      this.items = [];
      this.enterY = null;
      this.menuTimerID = null;
      this.borderTimerID = null;
      this.showTop = `-${paddingBottom}px`;
      this.minWidth = 0;

      this.page = this.createPage();
      this.main = this.createMain();
      this.menu = this.createMenu();

      this.main.appendChild(this.menu);
      this.page.appendChild(this.main);

      this.audioFrame = document.createElement("IFRAME");
      this.audioFrame.style.display = "none";
      this.page.appendChild(this.audioFrame);

      portBS.onMessage.addListener(m => {
        if (m.action == dataAction) {
          let index = this.items.length - 1;
          this.items[index].name = "Previous page (" + m.countPreviousPages + ")";
          this.items[index].visible = m.countPreviousPages > 0;

          index = this.items.length - 2;
          this.items[index].visible = this.isTextSelected;

          this.setHideTop();

          this.selectItem(indexSelect, { index: m.selectedIndex });

          for (let i = 0; i < m.workItems.length; i++) {
            if (m.workItems[i] == 0) {
              this.items[i].actionName = "Create";
            } else {
              this.items[i].actionName = "Open";
            }
          }

          this.show();
        } else if (m.action == initAction) {
          this.init(m.workItems);
        }
      });

      portBS.postMessage({
        action: initAction
      });

      this.assignWindow(window);
    }

    init(workItems) {
      document.body.appendChild(this.page);

      let items = [];
      items.push(_google_translator());
      items.push(_cambridge_dictionary());
      items.push(_microsoft_translator());

      for (let i = 0; i < workItems.length; i++) {
        let index = items.findIndex(o => workItems[i].reURL.test(o.url));
        if (index == -1) {
          continue;
        }

        let item = items[index];
        this.addMenuItem(item.name, "", item.action, () => {
          item.onAction({
            text: this.getSelectedText(),
            port: portBS,
            index: i
          });
        });

        if (workItems[i].reURL.test(document.URL)) {
          item.init();
        }
      }

      this.addMenuItem("Microsoft Translator", "", "Speak English", () => {
        if (this.isTextSelected) {
          this.audioFrame.src =
            "https://www.bing.com/translator/api/language/Speak?locale=en-US&gender=male&media=audio/mp3&text=" +
            encodeURIComponent(this.getSelectedText());
        }
      });

      this.addMenuItem("Previous page", "", "Open", () => {
        this.selectItem(backSelect);
      });
    }

    preShow() {
      portBS.postMessage({
        action: dataAction
      });
    }

    show() {
      if (this.items.length > 0 && this.items.filter(o => o.isSelected).length == 0) {
        this.items[0].isSelected = true;
      }
      this.main.style.top = this.showTop;
      this.page.style.pointerEvents = "auto";

      this.main.style.borderColor = this.isTextSelected ? borderTextRGBA : borderRGBA;
    }

    hide() {
      this.enterY = null;
      this.main.style.top = this.hideTop;
      this.page.style.pointerEvents = "none";

      if (this.isEnter == false) {
        this.main.style.borderColor = "transparent";
      }
    }

    get activeElement() {
      return this._activeElement;
    }

    set activeElement(value) {
      if (this._activeElement != value) {
        this._activeElement = value;
      }

      this.isTextSelected = this.getSelectedText().length > 0;
    }

    get isFocused() {
      return this._isFocused;
    }

    set isFocused(value) {
      if (this._isFocused != value) {
        this._isFocused = value;
        if (this._isFocused == false) {
          this.isEnter = false;
        }
      }
    }

    get isEnter() {
      return this._isEnter;
    }

    set isEnter(value) {
      if (this._isEnter != value) {
        this._isEnter = value;

        if (this._isEnter) {
          this.cancelTransBorderTimer();
          this.main.style.borderColor = this.isTextSelected ? borderTextRGBA : borderRGBA;
        } else {
          this.main.style.borderColor = "transparent";
        }
      }
    }

    get isTextSelected() {
      return this._isTextSelected;
    }

    set isTextSelected(value) {
      if (this._isTextSelected != value) {
        this._isTextSelected = value;

        if (this._isTextSelected) {
          this.main.classList.add(mainTextClass);
          this.menu.classList.add(menuTextClass);
          for (let item of this.items) {
            if (item.isSelected) {
              item.node.classList.remove(menuItemSelectedClass);
              item.node.classList.add(menuItemSelectedTextClass);
            }
          }
        } else {
          this.main.classList.remove(mainTextClass);
          this.menu.classList.remove(menuTextClass);
          for (let item of this.items) {
            if (item.isSelected) {
              item.node.classList.remove(menuItemSelectedTextClass);
              item.node.classList.add(menuItemSelectedClass);
            }
          }

          this.transBorderTimer(borderColor.R, borderColor.G, borderColor.B, borderColor.A, hideFrames, hideFrames, waitFrames, fps);
        }
      }

      if (this.isTextSelected && this.visible == false) {
        this.transBorderTimer(borderColorText.R, borderColorText.G, borderColorText.B, borderColorText.A, hideFrames, hideFrames, waitFrames, fps);
      }
    }

    get visible() {
      return this._visible;
    }

    set visible(value) {
      this.cancelHideMenuTimer();

      if (this._visible != value) {
        this._visible = value;

        this.cancelTransBorderTimer();
        if (this._visible) {
          this.preShow();
        } else {
          this.hide();
        }
      }
    }

    cancelHideMenuTimer() {
      if (this.menuTimerID != null) {
        clearTimeout(this.menuTimerID);
        this.menuTimerID = null;
      }
    }

    hideMenuTimer() {
      this.cancelHideMenuTimer();

      this.menuTimerID = setTimeout(() => this.visible = false, timeoutHide);
    }

    cancelTransBorderTimer() {
      if (this.borderTimerID != null) {
        clearTimeout(this.borderTimerID);
        this.borderTimerID = null;
      }
    }

    transBorderTimer(r, g, b, a, start, time, wait, fps) {
      this.cancelTransBorderTimer();

      let timeout = 1000 / fps;
      let alpha = a;
      if (wait > 0) {
        wait = wait - 1;
      } else {
        alpha = a / start * time;
        time = time - 1;
      }

      if (time > 0) {
        this.main.style.borderColor = `rgba(${r},${g},${b},${a})`;

        this.borderTimerID = setTimeout(() => this.transBorderTimer(r, g, b, alpha, start, time, wait, fps), timeout);
      } else {
        this.main.style.borderColor = "transparent";
      }
    }

    addMenuItem(name, hotkeys, actionName, action) {
      let number = this.items.length + 1;
      let allHotkeys = number + "," + hotkeys + ",ArrowRight,Space,Enter";
      let menuItem = new MenuItem(name, allHotkeys, actionName, action);
      this.items.push(menuItem);
      this.menu.appendChild(menuItem.node);

      menuItem.onSelect = () => {
        for (let i = 0; i < this.items.length; i++) {
          let item = this.items[i];

          if (item == menuItem) {
            if (this.isTextSelected) {
              item.node.classList.add(menuItemSelectedTextClass);
            } else {
              item.node.classList.add(menuItemSelectedClass);
            }
            portBS.postMessage({
              action: selectAction,
              selectedIndex: i
            });
          } else if (item.isSelected) {
            item.isSelected = false;
            item.node.classList.remove(menuItemSelectedClass);
            item.node.classList.remove(menuItemSelectedTextClass);
          }
        }
      };

      menuItem.onHide = () => {
        if (menuItem.isSelected) {
          this.selectItem(firstSelect);
        }
      };

      this.setHideTop();
    }

    setHideTop() {
      let rect = this.main.getBoundingClientRect();
      let width = Math.ceil(rect.width);
      if (this.minWidth < width) {
        this.minWidth = width;
        this.main.style.minWidth = width + "px";
      }

      this.hideTop = (paddingBottom - rect.height) + "px";
      this.main.style.top = this.hideTop;
    }

    createMenu() {
      let node = document.createElement("div");
      node.classList.add(baseClass);
      node.classList.add(menuClass);

      return node;
    }

    createMain() {
      let node = document.createElement("div");
      node.classList.add(baseClass);
      node.classList.add(mainClass);

      let enterTimeStamp = 0;

      node.addEventListener("mouseenter", e => {
        if (e.buttons != 0) {
          return;
        }
        enterTimeStamp = getTimeStamp();

        this.isEnter = true;
        this.enterY = e.clientY;
        this.cancelHideMenuTimer();
      });

      node.addEventListener("mouseleave", e => {
        if (e.buttons != 0) {
          return;
        }

        if (e.clientX > node.offsetLeft && e.clientX < node.offsetLeft + node.offsetWidth) {
          if (this.enterY != null && e.clientY < node.clientHeight - paddingBottom && e.clientY > this.enterY) {
            if (getTimeStamp() - enterTimeStamp > timeoutSlide) {
              this.enterY = e.clientY;
              this.visible = true;
              return;
            }
          }
        }
        this.isEnter = false;
        this.hideMenuTimer();
      });

      node.addEventListener("mousedown", e => {
        e.stopPropagation();
        e.preventDefault();
        this.visible = !this.visible;
      });

      return node;
    }

    createPage() {
      let node = document.createElement("div");
      node.classList.add(baseClass);
      node.classList.add(pageClass);

      node.addEventListener("mousedown", e => {
        e.preventDefault();

        if (e.buttons == 4) {
          let itemIndex = this.selectedIndex();
          if (itemIndex != -1) {
            this.items[itemIndex].action();
          }
        } else {
          this.visible = false;
        }
      });

      node.addEventListener("wheel", e => {
        e.preventDefault();
        if (e.deltaY > 0) {
          this.selectItem(nextSelect);
        } else if (e.deltaY < 0) {
          this.selectItem(prevSelect);
        }
      });

      return node;
    }

    selectedIndex() {
      for (let i = 0; i < this.items.length; i++) {
        if (this.items[i].isSelected) {
          return i;
        }
      }
      return -1;
    }

    selectItem(select, event) {
      if (this.items.length == 0) {
        return;
      }

      let selected = -1, first = -1, last = -1, prev = -1, next = -1;
      for (let i = 0; i < this.items.length; i++) {
        if (this.items[i].isSelected) {
          selected = i;
        } else if (this.items[i].visible) {
          if (selected == -1) {
            prev = i;
          } else if (next == -1) {
            next = i;
          }
        }

        if (first == -1 && this.items[i].visible) {
          first = i;
        }
        if (this.items[i].visible) {
          last = i;
        }
      }
      if (prev == -1 || prev > selected) {
        prev = last;
      }
      if (next == -1) {
        next = first;
      }

      // FIX indices may not exist

      let run = false;

      switch (select) {
        case indexSelect:
          selected = event.index;
          break
        case firstSelect:
          selected = first;
          break;
        case lastSelect:
          selected = last;
          break;
        case prevSelect:
          selected = prev;
          break;
        case nextSelect:
          selected = next;
          break;
        case backSelect:
          portBS.postMessage({
            action: backAction
          });
          this.visible = false;
          break;
        case keySelect:
          if (selected != -1 && this.items[selected].hotkeys.equals(event)) {
            run = true;
          } else {
            for (let i = 0; i < this.items.length; i++) {
              if (this.items[i].hotkeys.equals(event)) {
                selected = i;
                run = true;
                break;
              }
            }
          }
          break;
      }

      if (this.items[selected].visible == false) {
        selected = 0;
      }

      this.items[selected].isSelected = true;

      if (run) {
        this.items[selected].action();
      }
    }

    menuKeyDown(event) {
      if (this.keyMenu.equals(event)) {
        if (this.keyMenuDown == false) {
          this.keyMenuTime = getTimeStamp();
          this.keyMenuDown = true;
        }
      } else {
        this.keyMenuTime = 0;
        this.keyMenuDown = false;
      }
    }

    menuKeyUp(event) {
      if (this.keyMenuDown == false) {
        return;
      }
      this.keyMenuDown = false;

      if (getTimeStamp() - this.keyMenuTime > keyMaxDuration) {
        return;
      }

      this.visible = !this.visible;
    }

    assignWindow(win) {
      win.addEventListener("keydown", e => {
        this.menuKeyDown(e);

        if (this.visible) {
          e.preventDefault();

          if (e.code == "Escape") {
            this.visible = false;
          } else if (e.code == "ControlLeft" || e.code == "ControlRight" || e.code == "Backquote" || e.code == "Backspace" || e.code == "ArrowLeft") {
            this.selectItem(backSelect);
          } else if (e.code == "Home") {
            this.selectItem(firstSelect);
          } else if (e.code == "End") {
            this.selectItem(lastSelect);
          } else if (e.code == "ArrowUp") {
            this.selectItem(prevSelect);
          } else if (e.code == "ArrowDown") {
            this.selectItem(nextSelect);
          } else {
            this.selectItem(keySelect, e);
          }
        }
      });

      win.addEventListener("keyup", e => {
        this.menuKeyUp(e);
        this.activeElement = e.view.document.activeElement;
      });

      win.addEventListener("click", e => {
        this.activeElement = e.view.document.activeElement;
      });

      win.addEventListener("focus", e => {
        this.isFocused = true;
      }, true);

      win.addEventListener("blur", e => {
        if (win.document.hasFocus()) {
          return;
        }
        if (this.visible) {
          this.visible = false;
        }
        this.isFocused = false;
      }, true);

     let observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
          mutation.addedNodes.forEach((node) => {
            if (node.tagName == 'IFRAME') {
              node.contentWindow.addEventListener("load", e => {
                this.assignWindow(node.contentWindow);
              });
            }
          });
        });
      });
      let config = { childList: true, subtree: true };
      observer.observe(win.document.body, config);

      for (let i = 0; i < win.frames.length; i++) {
        try {
          this.assignWindow(win.frames[i]);
        } catch (e) {
          console.log(e);
        }
      }
    }

    getSelectedText() {
      if (this.activeElement == null) {
        return "";
      }

      let target = this.activeElement;
      let element = target instanceof Window ? target.document.body :
        target instanceof HTMLDocument ? target.body : target;

      if (element.tagName == "TEXTAREA" || element.tagName == "INPUT") {
        return element.value.substring(element.selectionStart, element.selectionEnd).trim();
      }
      return element.ownerDocument.getSelection().toString().trim();
    }

  }

  class MenuItem {
    constructor(name, hotkeys, actionName, action) {
      this.hotkeys = new Hotkeys(hotkeys);
      this.action = action;
      this._actionName = "";
      this._name = "";

      this._firstHotkey = hotkeys.split(",")[0];

      this._visible = true;
      this._isSelected = false;
      this.onSelect = null;
      this.onHide = null;

      this._left = document.createElement("div");
      this._left.classList.add(baseClass);
      this._left.classList.add(menuItemLeftClass);

      this.name = name;

      this._right = document.createElement("div");
      this._right.classList.add(baseClass);
      this._right.classList.add(menuItemRightClass);

      this.actionName = actionName;

      this.node = document.createElement("div");
      this.node.classList.add(baseClass);
      this.node.classList.add(menuItemClass);
      this.node.appendChild(this._left);
      this.node.appendChild(this._right);

      this.node.addEventListener("mouseenter", e => {
        if (e.buttons != 0 || this.isFocused == false) {
          return;
        }
        this.isSelected = true;
      });

      this.node.addEventListener("mousedown", e => {
        e.stopPropagation();
        e.preventDefault();

        if (e.buttons != 1) {
          return;
        }

        if (this.isSelected == false) {
          this.isSelected = true;
        }
        this.action();
      });
    }

    get isSelected() {
      return this._isSelected;
    }

    set isSelected(value) {
      if (this._isSelected != value) {
        this._isSelected = value;

        if (this._isSelected && this.onSelect != null) {
          this.onSelect();
        }
      }
    }

    get visible() {
      return this._visible;
    }

    set visible(value) {
      if (this._visible != value) {
        this._visible = value;
        if (this._visible == false && this.onHide != null) {
          this.onHide();
        }

        this.node.style.display = value ? "" : "none";
      }
    }

    get name() {
      return this._name;
    }

    set name(value) {
      if (this._name != value) {
        this._name = value;
        this._left.innerHTML = `<span class="${menuHotkeyClass}">${this._firstHotkey}</span>${this._name}`;
      }
    }

    get actionName() {
      return this._actionName;
    }

    set actionName(value) {
      if (this._actionName != value) {
        this._actionName = value;
        this._right.innerHTML = this._actionName;
      }
    }
  }

  class Hotkeys {
    constructor(hotkeys) {
      this.items = [];

      let items = hotkeys.split(",");
      for (let item of items) {
        let hotkey = new Hotkey(item);
        this.items.push(hotkey);
      }

      this.toString = () => {
        return hotkeys;
      };
    }

    equals(event) {
      for (let item of this.items) {
        if (item.equals(event)) {
          return true;
        }
      }
      return false;
    }
  }

  class Hotkey {
    constructor(hotkey) {
      this.altKey = false;
      this.ctrlKey = false;
      this.metaKey = false;
      this.shiftKey = false;
      this.code = "";
      this.key = "";

      let keys = hotkey.split("-");
      for (let key of keys) {
        switch (key) {
          case "Alt":
            this.altKey = true; break;
          case "Control":
            this.ctrlKey = true; break;
          case "Meta":
            this.metaKey = true; break;
          case "Shift":
            this.shiftKey = true; break;
          default:
            this.code = key;
            this.key = key.toUpperCase();
        }
      }

      this.toString = () => {
        return hotkey;
      };
    }

    equals(event) {
      if (event.repeat) {
        return false;
      }
      if (event.altKey != this.altKey || event.ctrlKey != this.ctrlKey ||
        event.metaKey != this.metaKey || event.shiftKey != this.shiftKey) {
        return false;
      }
      if (event.key == "Shift" || event.key == "Meta" ||
        event.key == "Control" || event.key == "Alt") {
        return this.code == "";
      }
      return this.code == event.code || this.key == event.key.toUpperCase();
    }
  }

  function _google_translator() {

    const name = "Google Translator",
      action = "Open",
      url = "https://translate.google.com/",
      contentSourceID = "source",
      menuSourceID = "gt-src-is";

    class Helper {
      constructor() {
        this.name = name;
        this.action = action;
        this.url = url;
      }

      onAction(data) {
        data.port.postMessage({
          action: translateAction,
          content: data.text,
          url: this.url,
          index: data.index
        });
      }

      init() {
        let source = document.getElementById(contentSourceID);
        let menu = document.getElementById(menuSourceID);

        if (menu == undefined || source == undefined) {
          return;
        }

        source.addEventListener("drop", e => {
          source.value = "";
        });

        let content = '';

        let obs = new MutationObserver(function (mutations) {
          if (menu.style.display == '' && source.value == content) {
            let focus = document.activeElement == source;
            source.focus();
            source.blur();
            if (focus) {
              source.focus();
            }
          }
        });
        obs.observe(menu, { attributes: true, attributeFilter: ['style'] });

        chrome.runtime.onMessage.addListener(function (msg, sender, resp) {
          let id = 'extensionId' in sender ? sender.extensionId : sender.id;
          if (id != chrome.runtime.id) {
            return;
          }

          if (msg.content != '') {
            content = source.value = msg.content;
          }
          source.style.height = 'auto';
          source.style.height = source.scrollHeight + 'px';
          source.focus();
        });
      }
    }

    return new Helper();
  }

  function _cambridge_dictionary() {

    const name = "Cambridge Dictionary",
      action = "Open",
      url = "https://dictionary.cambridge.org/",
      searchInputID = "cdo-search-input",
      searchFormID = "cdo-search-form";

    class Helper {
      constructor() {
        this.name = name;
        this.action = action;
        this.url = url;
      }

      onAction(data) {
        data.port.postMessage({
          action: translateAction,
          content: data.text,
          url: this.url,
          index: data.index
        });
      }

      init() {
        let searchInput = document.getElementById(searchInputID);
        let searchForm = document.getElementById(searchFormID);

        if (searchForm == undefined || searchInput == undefined) {
          return;
        }

        searchInput.addEventListener("drop", e => {
          searchInput.value = "";
        });

        chrome.runtime.onMessage.addListener(function (msg, sender, resp) {
          let id = 'extensionId' in sender ? sender.extensionId : sender.id;
          if (id != chrome.runtime.id) {
            return;
          }

          if (msg.content != '') {
            searchInput.value = msg.content;
          }
          searchInput.focus();
          if (msg.content != '') {
            searchForm.submit();
          }
        });
      }
    }

    return new Helper();
  }

  function _microsoft_translator() {

    const name = "Microsoft Translator",
      action = "Open",
      url = "https://www.bing.com/translator/",
      srcTextID = "srcText",
      translateButtonID = "TranslateButton";

    class Helper {
      constructor() {
        this.name = name;
        this.action = action;
        this.url = url;
      }

      onAction(data) {
        data.port.postMessage({
          action: translateAction,
          content: data.text,
          url: this.url,
          index: data.index
        });
      }

      init() {
        let srcText = document.getElementById(srcTextID);
        let translateButton = document.getElementById(translateButtonID);

        if (srcText == undefined || translateButton == undefined) {
          return;
        }

        srcText.addEventListener("drop", e => {
          srcText.value = "";
        });

        chrome.runtime.onMessage.addListener(function (msg, sender, resp) {
          let id = 'extensionId' in sender ? sender.extensionId : sender.id;
          if (id != chrome.runtime.id) {
            return;
          }

          if (msg.content != '') {
            srcText.value = msg.content;
          }
          srcText.focus();
          if (msg.content != '') {
            translateButton.click();
          }
        });
      }
    }

    return new Helper();
  }

  function getTimeStamp() {
    return new Date().getTime();
  }

  let menu = new Menu();

})();
