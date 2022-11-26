import Tool from '../DevTools/Tool'
import LunaObjectViewer from 'luna-object-viewer'
import Settings from '../Settings/Settings'
import { ajax, escape, trim, isStr, highlight } from '../lib/util'
import evalCss from '../lib/evalCss'

export default class Sources extends Tool {
  constructor() {
    super()

    this._style = evalCss(require('./Sources.scss'))

    this.name = 'sources'
    this._showLineNum = true

    this._loadTpl()
  }
  init($el, container) {
    super.init($el)

    this._container = container
    this._bindEvent()
    this._initCfg()
  }
  destroy() {
    super.destroy()

    evalCss.remove(this._style)
    this._rmCfg()
  }
  set(type, val) {
    if (type === 'img') {
      this._isFetchingData = true

      const img = new Image()

      const self = this

      img.onload = function () {
        self._isFetchingData = false
        self._data = {
          type: 'img',
          val: {
            width: this.width,
            height: this.height,
            src: val,
          },
        }

        self._render()
      }
      img.onerror = function () {
        self._isFetchingData = false
      }

      img.src = val

      return
    }

    this._data = { type, val }

    this._render()

    return this
  }
  show() {
    super.show()

    if (!this._data && !this._isFetchingData) {
      this._renderDef()
    }

    return this
  }
  _renderDef() {
    if (this._html) {
      this._data = {
        type: 'html',
        val: this._html,
      }

      return this._render()
    }

    if (this._isGettingHtml) return
    this._isGettingHtml = true

    ajax({
      url: location.href,
      success: (data) => (this._html = data),
      error: () => (this._html = 'Sorry, unable to fetch source code:('),
      complete: () => {
        this._isGettingHtml = false
        this._renderDef()
      },
      dataType: 'raw',
    })
  }
  _bindEvent() {
    this._container.on('showTool', (name, lastTool) => {
      if (name !== this.name && lastTool.name === this.name) {
        delete this._data
      }
    })
  }
  _loadTpl() {
    this._codeTpl = require('./code.hbs')
    this._imgTpl = require('./image.hbs')
    this._objTpl = require('./object.hbs')
    this._rawTpl = require('./raw.hbs')
    this._iframeTpl = require('./iframe.hbs')
  }
  _rmCfg() {
    const cfg = this.config

    const settings = this._container.get('settings')

    if (!settings) return

    settings.remove(cfg, 'showLineNum').remove('Sources')
  }
  _initCfg() {
    const cfg = (this.config = Settings.createCfg('sources', {
      showLineNum: true,
    }))

    if (!cfg.get('showLineNum')) this._showLineNum = false

    cfg.on('change', (key, val) => {
      switch (key) {
        case 'showLineNum':
          this._showLineNum = val
          return
      }
    })

    const settings = this._container.get('settings')
    settings
      .text('Sources')
      .switch(cfg, 'showLineNum', 'Show Line Numbers')
      .separator()
  }
  _render() {
    this._isInit = true

    const data = this._data

    switch (data.type) {
      case 'html':
      case 'js':
      case 'css':
        return this._renderCode()
      case 'img':
        return this._renderImg()
      case 'object':
        return this._renderObj()
      case 'raw':
        return this._renderRaw()
      case 'iframe':
        return this._renderIframe()
    }
  }
  _renderImg() {
    this._renderHtml(this._imgTpl(this._data.val))
  }
  _renderCode() {
    const data = this._data

    let code = data.val
    const len = data.val.length

    // If source code too big, don't process it.
    if (len < MAX_BEAUTIFY_LEN) {
      const curTheme = evalCss.getCurTheme()
      code = highlight(code, data.type, {
        keyword: `color:${curTheme.keywordColor}`,
        number: `color:${curTheme.numberColor}`,
        operator: `color:${curTheme.operatorColor}`,
        comment: `color:${curTheme.commentColor}`,
        string: `color:${curTheme.stringColor}`,
      })
    } else {
      code = escape(code)
    }

    if (len < MAX_LINE_NUM_LEN && this._showLineNum) {
      code = code.split('\n').map((line, idx) => {
        if (trim(line) === '') line = '&nbsp;'

        return {
          idx: idx + 1,
          val: line,
        }
      })
    }

    this._renderHtml(
      this._codeTpl({
        code,
        showLineNum: len < MAX_LINE_NUM_LEN && this._showLineNum,
      })
    )
  }
  _renderObj() {
    // Using cache will keep binding events to the same elements.
    this._renderHtml(this._objTpl(), false)

    let val = this._data.val

    try {
      if (isStr(val)) {
        val = JSON.parse(val)
      }
      /* eslint-disable no-empty */
    } catch (e) {}

    const objViewer = new LunaObjectViewer(
      this._$el.find('.eruda-json').get(0),
      {
        unenumerable: true,
        accessGetter: true,
      }
    )
    objViewer.set(val)
  }
  _renderRaw() {
    this._renderHtml(this._rawTpl({ val: this._data.val }))
  }
  _renderIframe() {
    this._renderHtml(this._iframeTpl({ src: this._data.val }))
  }
  _renderHtml(html, cache = true) {
    if (cache && html === this._lastHtml) return
    this._lastHtml = html
    this._$el.html(html)
    // Need setTimeout to make it work
    setTimeout(() => (this._$el.get(0).scrollTop = 0), 0)
  }
}

const MAX_BEAUTIFY_LEN = 100000
const MAX_LINE_NUM_LEN = 400000
