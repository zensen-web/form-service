# zensen-lit-pure

A pure component processor for LitElement

This module allows components pure components to be represented as pure functions in LitElement.

## Install

Using `npm`:

```
$ npm install @zensen/lit-pure
```

Using `yarn`:

```
$ yarn add @zensen/lit-pure
```

## API

Import the default function, and use it like so:

### `registerPure(name, fn, styles, props, refs)`

`name`: element name

`fn`: the pure function that returns a `html` tagged template literal

`styles`: a `css` tagged template literal

`props`: an object representing standard `LitElement` renderable prop declarations

`refs`: a set of selectors that makes this component useful for unit and integration testing

```js
import registerPure from '../../../src'

import { html, css } from 'lit-element'

const STYLES = css`
  *,
  *::before,
  *::after {
    box-sizing: border-box;
  }

  :host {
    display: block;
  }

  .text {
    font-size: 14px;
  }

  .text-header {
    font-size: 22px;
    font-weight: 700;
  }

  .text-caption {
    font-size: 10px;
  }
`

const PROPS = {
  title: String,
  onClick: Function,
}

export const fn = props => html`
  <p class="text text-header">${props.title}</p>

  <button @click="${props.onClick}">Click Me</button>
`

registerPure('zen-pure', fn, STYLES, PROPS)

```

`registerPure()` will automatically
