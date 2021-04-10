import { FragmentNode } from './fragment.js'
import { execFor, execCommon } from '../sandbox/runtime.js'
import { Node, Text, Attribute } from '../parser/template/parser.js'

const cloneAttribute = (attr) => {
  return new Attribute(attr.key, attr.buf)
}

const cloneNode = (node, filterFor) => {
  const cloned = new Node(
    node.tagName,
    node.parent,
    node.position,
  )
  cloned.children = node.children.map(v => v)
  cloned.attributes = node.attributes.map(v => cloneAttribute(v))
  cloned.directives = !filterFor
    ? node.directives.map(v => v)
    : node.directives.filter(d => d.type !== 'for')
  return cloned
}

const concatDisplayStyle = (attributes, isShow) => {
  let style = attributes.find(v => v.key === 'style')
  const val = isShow ? 'block' : 'none'

  if (!style) {
    style = new Attribute('style', `display:${val}`)
    attributes.push(style)
  } else {
    const sheets = style.buf.split(';').map(v => v.split(':'))
    const display = sheets.find(v => /display/i.test(v[0]))
    display
      ? (display[1] = val)
      : sheets.push(['display', val])
    style.buf = sheets.map(v => v.join(':')).join(';')
  }
}

export function execDirectives(node, context, createEle) {
  node = cloneNode(node)
  let dom, needBreak
  const events = []
  const customDirectives = []
  const { position, directives, attributes } = node

  for (let i = 0, l = directives.length; i < l; i++) {
    const cur = directives[i]
    const { type, typeBuf, isCustom } = cur

    if (isCustom) {
      customDirectives.push(cur)
      continue
    } else if (needBreak) {
      continue
    } else {
      if (type === 'for') {
        dom = new FragmentNode()
        execFor(cur, context, () => {
          // 递归 v-for
          dom.appendChild(createEle(3, cloneNode(node, true)))
        })
        break
      } else if (type === 'if') {
        const canRender = Boolean(execCommon(cur, context)) === true
        if (!canRender) {
          dom = createEle(1, node)
          needBreak = true
        }
      } else if (type === 'bind') {
        const val = String(execCommon(cur, context))
        const attr = attributes.find(v => v.key === typeBuf)
        attr
          ? attr.buf = val
          : attributes.push(new Attribute(typeBuf, val))
      } else if (type === 'on') {
        events.push(dom => dom[`on${typeBuf}`] = execCommon(cur, context))
      } else if (type === 'show') {
        const canShow = Boolean(execCommon(cur, context)) === true
        concatDisplayStyle(attributes, canShow)
      } else if (type === 'text') {
        node.children = [new Text(execCommon(cur, context), position)]
      } else if (type === 'transition') {

      }
    }
  }
  if (!dom) dom = createEle(2, node)
  // TODO: 自定义指令
  // customDirectives.forEach(({ buf, type }) => {
  //   console.log('customDirective', type, buf);
  // })
  events.forEach(fn => fn(dom))
  return dom
}